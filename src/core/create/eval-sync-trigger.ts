import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';

/**
 * eval-sync 联动触发接口
 *
 * 职责：
 * - 创建完成后提示"是否立即生成测试用例" -> 确认后调用 eval-gen 处理器
 * - 编辑完成后提示"是否同步更新测试用例" -> 确认后调用 eval-sync 处理器
 * - 联动仅为提示性引导，不阻塞创建/编辑流程
 * - 联动调用失败时不影响 Skill 创建/编辑的最终结果
 * - 联动提示仅在 SKILL.md 实际发生变化时出现
 */
export interface EvalSyncTrigger {
  promptGenerateCases(skillPath: string): Promise<void>;
  promptSyncCases(skillPath: string): Promise<void>;
}

/** 可选的外部处理器，由调用方注入 */
export interface EvalSyncTriggerHandlers {
  /** eval-gen 处理器：生成初始测试用例 */
  onGenerateCases?: (skillPath: string) => Promise<void>;
  /** eval-sync 处理器：同步更新测试用例 */
  onSyncCases?: (skillPath: string) => Promise<void>;
}

/** SKILL.md 变更检测函数类型 */
export type HasSkillChangedFn = (skillPath: string) => boolean;

/**
 * 默认的 SKILL.md 变更检测实现
 *
 * 检测逻辑：检查 SKILL.md 文件是否存在且非空。
 * - 创建模式：writer 成功后文件必然存在，视为"已变化"
 * - 编辑模式：调用方应在写入后调用，文件存在即视为"已变化"
 */
export function defaultHasSkillChanged(skillPath: string): boolean {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return false;
  }
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  return content.trim().length > 0;
}

/**
 * eval-sync 联动触发器实现
 *
 * 在 Skill 创建或编辑完成后，引导用户是否要生成/同步测试用例。
 * 所有操作均为非阻塞式：用户拒绝、处理器缺失或调用失败均不影响主流程。
 */
export class EvalSyncTriggerImpl implements EvalSyncTrigger {
  private handlers: EvalSyncTriggerHandlers;
  private hasSkillChanged: HasSkillChangedFn;

  constructor(
    handlers: EvalSyncTriggerHandlers = {},
    hasSkillChanged: HasSkillChangedFn = defaultHasSkillChanged
  ) {
    this.handlers = handlers;
    this.hasSkillChanged = hasSkillChanged;
  }

  /**
   * 创建完成后提示是否生成测试用例
   *
   * 流程：
   * 1. 检测 SKILL.md 是否实际发生变化
   * 2. 若未变化，跳过提示
   * 3. 向用户展示"是否立即生成测试用例"提示
   * 4. 用户确认后调用 eval-gen 处理器
   * 5. 处理器不可用时输出降级提示
   * 6. 调用失败时不阻塞主流程
   */
  async promptGenerateCases(skillPath: string): Promise<void> {
    if (!this.hasSkillChanged(skillPath)) {
      return;
    }

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>({
      type: 'confirm',
      name: 'confirmed',
      message: '是否立即生成测试用例？',
      default: false,
    });

    if (!confirmed) {
      return;
    }

    if (!this.handlers.onGenerateCases) {
      console.log(
        '[降级] eval-gen 功能不可用，请稍后手动执行: quick-skill eval-gen'
      );
      return;
    }

    try {
      await this.handlers.onGenerateCases(skillPath);
      console.log('[eval-gen] 测试用例生成完成');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.warn(`[eval-gen] 生成测试用例失败: ${message}`);
    }
  }

  /**
   * 编辑完成后提示是否同步更新测试用例
   *
   * 流程：
   * 1. 检测 SKILL.md 是否实际发生变化
   * 2. 若未变化，跳过提示
   * 3. 向用户展示"是否同步更新测试用例"提示
   * 4. 用户确认后调用 eval-sync 处理器
   * 5. 处理器不可用时输出降级提示
   * 6. 调用失败时不阻塞主流程
   */
  async promptSyncCases(skillPath: string): Promise<void> {
    if (!this.hasSkillChanged(skillPath)) {
      return;
    }

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>({
      type: 'confirm',
      name: 'confirmed',
      message: '是否同步更新测试用例？',
      default: false,
    });

    if (!confirmed) {
      return;
    }

    if (!this.handlers.onSyncCases) {
      console.log(
        '[降级] eval-sync 功能不可用，请稍后手动执行: quick-skill eval-sync'
      );
      return;
    }

    try {
      await this.handlers.onSyncCases(skillPath);
      console.log('[eval-sync] 测试用例同步完成');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.warn(`[eval-sync] 同步测试用例失败: ${message}`);
    }
  }
}
