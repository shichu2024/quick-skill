import * as path from 'path';
import type { CreateMode, SkillFormData } from '../core/create/types.js';
import { StepRegistry } from '../core/create/step-registry.js';
import { StepRunner } from '../core/create/step-runner.js';
import { CategoryStep } from '../core/create/steps/category-step.js';
import { MissionStep } from '../core/create/steps/mission-step.js';
import { BoundaryStep, StandardStep } from '../core/create/steps/boundary-step.js';
import { StepsStep } from '../core/create/steps/steps-step.js';
import { SkillMdWriter } from '../core/create/skill-md-writer.js';
import { SkillLoader } from '../core/create/skill-loader.js';
import { EditMode } from '../core/create/edit-mode.js';
import { FileDraftManager } from '../core/create/draft-manager.js';
import { EvalSyncTriggerImpl } from '../core/create/eval-sync-trigger.js';
import inquirer from 'inquirer';

interface CreateOptions {
  edit?: boolean;
  category?: string;
  name?: string;
}

export default async function createCommand(options: CreateOptions) {
  const mode: CreateMode = options.edit ? 'edit' : 'create';

  console.log(`\n=== Skill 创建向导 (${mode === 'edit' ? '编辑模式' : '创建模式'}) ===`);

  // ========== 编辑模式分支 (D-01) ==========
  if (mode === 'edit') {
    await runEditMode(options);
    return;
  }

  // ========== 创建模式分支 ==========
  await runCreateMode(options);
}

/**
 * 运行编辑模式流程
 *
 * 调用链：SkillLoader.findSkill() → EditMode.loadSkill() → EditMode.runEditFlow() → SkillMdWriter.update()
 */
async function runEditMode(options: CreateOptions): Promise<void> {
  // 获取要编辑的 Skill 名称
  const skillName = options.name;
  if (!skillName) {
    console.error('\n✗ 编辑模式需要指定 Skill 名称: quick-skill create --edit <skill-name>');
    process.exit(1);
  }

  try {
    // 1. 加载 SkillLoader 并查找 Skill
    const loader = new SkillLoader();
    const editMode = new EditMode(loader);

    // 2. 加载已有 Skill 内容
    const currentData = await editMode.loadSkill(skillName);

    // 3. 运行交互式编辑流程
    const updatedData = await editMode.runEditFlow(currentData);

    // 4. 确定 Skill 所在目录（从 loader 查找结果获取）
    const skillMdFilePath = await loader.findSkill(skillName);
    if (!skillMdFilePath) {
      throw new Error(`未找到 Skill 文件: ${skillName}`);
    }
    // skillMdFilePath 是 SKILL.md 的完整路径，取其目录
    const skillDir = path.dirname(skillMdFilePath);

    // 5. 调用 SkillMdWriter.update() 更新文件 (D-07)
    const writer = new SkillMdWriter();
    const updatedPath = await writer.update(skillDir, updatedData);

    // 6. 区分"新建"和"更新"状态的确认信息 (D-06)
    console.log(`\n✓ SKILL.md 已更新: ${updatedPath}`);
    console.log('  状态: 更新（编辑模式）');

    // 7. 调用 eval-sync 联动触发器 (D-03)
    await triggerEvalSync(skillDir, 'edit');

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n✗ 编辑流程失败: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * 运行创建模式流程
 *
 * 包含：草稿恢复 (D-02)、步骤执行、文件生成、eval-sync 联动 (D-03)
 */
async function runCreateMode(options: CreateOptions): Promise<void> {
  const registry = new StepRegistry();
  const formData: SkillFormData = {};

  // 注册步骤
  registry.register(new CategoryStep());
  registry.register(new MissionStep());
  registry.register(new BoundaryStep());
  registry.register(new StandardStep());
  registry.register(new StepsStep());

  if (options.category) {
    formData.category = options.category;
    console.log(`✓ 已指定分类: ${options.category}`);
  }

  // 创建 DraftManager 并注入 StepRunner (D-02)
  // 草稿存储在当前工作目录下
  const draftManager = new FileDraftManager('.');
  const runner = new StepRunner(registry, { draftManager, skillPath: '.' });

  try {
    // 检查是否存在草稿
    const hasDraft = await runner.hasDraft();
    let skipSteps: string[] = [];

    if (hasDraft) {
      const draft = await runner.loadDraft();
      if (draft) {
        console.log(`\n📋 发现未完成的草稿（保存于 ${new Date(draft.savedAt).toLocaleString()}）`);

        const { action } = await inquirer.prompt<{ action: string }>([
          {
            type: 'list',
            name: 'action',
            message: '请选择操作:',
            choices: [
              { name: '继续上次进度', value: 'resume' },
              { name: '重新开始', value: 'restart' },
            ],
          },
        ]);

        if (action === 'resume') {
          // 从草稿恢复数据
          const { restoredData, draft: draftData } = await runner.resumeFromDraft(formData);
          Object.assign(formData, restoredData);
          skipSteps = draftData.completedSteps;
          console.log('✓ 已从草稿恢复进度');
        } else {
          // 重新开始，清除草稿
          await runner.clearDraft();
          console.log('✓ 已清除草稿，重新开始');
        }
      }
    }

    // 执行所有步骤
    const result = await runner.runAll(formData, { skipSteps });

    // 生成 SKILL.md 文件
    const writer = new SkillMdWriter();
    const skillMdPath = await writer.create(result);

    // 创建成功后清除草稿
    await runner.clearDraft();

    // 区分"新建"和"更新"状态的确认信息 (D-06)
    console.log('\n=== 创建完成 ===');
    console.log(`✓ SKILL.md 已生成: ${skillMdPath}`);
    console.log('  状态: 新建（创建模式）');
    console.log(`✓ evals/ 目录已创建`);

    // 调用 eval-sync 联动触发器 (D-03)
    // 需要获取 skill 目录（从 skillMdPath 去掉文件名）
    const skillDir = path.dirname(skillMdPath);
    await triggerEvalSync(skillDir, 'create');

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n✗ 创建流程失败: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * 触发 eval-sync 联动
 *
 * 创建模式：提示是否生成测试用例 (eval-gen)
 * 编辑模式：提示是否同步更新测试用例 (eval-sync)
 */
async function triggerEvalSync(skillPath: string, mode: 'create' | 'edit'): Promise<void> {
  const trigger = new EvalSyncTriggerImpl();

  if (mode === 'create') {
    await trigger.promptGenerateCases(skillPath);
  } else {
    await trigger.promptSyncCases(skillPath);
  }
}
