import type { CreateMode, SkillFormData } from '../core/create/types.js';
import { StepRegistry } from '../core/create/step-registry.js';
import { StepRunner } from '../core/create/step-runner.js';
import { CategoryStep } from '../core/create/steps/category-step.js';
import { MissionStep } from '../core/create/steps/mission-step.js';
import { BoundaryStep, StandardStep } from '../core/create/steps/boundary-step.js';
import { StepsStep } from '../core/create/steps/steps-step.js';
import { SkillMdWriter } from '../core/create/skill-md-writer.js';

interface CreateOptions {
  edit?: boolean;
  category?: string;
  name?: string;
}

export default async function createCommand(options: CreateOptions) {
  const mode: CreateMode = options.edit ? 'edit' : 'create';
  
  console.log(`\n=== Skill 创建向导 (${mode === 'edit' ? '编辑模式' : '创建模式'}) ===`);

  const registry = new StepRegistry();
  const runner = new StepRunner(registry);
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

  try {
    const result = await runner.runAll(formData);
    
    console.log('\n=== 创建完成 ===');
    
    // 生成 SKILL.md 文件
    const writer = new SkillMdWriter();
    const skillMdPath = await writer.create(result);
    
    console.log(`✓ SKILL.md 已生成: ${skillMdPath}`);
    console.log(`✓ evals/ 目录已创建`);
    
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n✗ 创建流程失败: ${error.message}`);
    }
    process.exit(1);
  }
}