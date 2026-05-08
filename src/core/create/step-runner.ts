import type { SkillFormData, CreateStep, StepResult } from './types.js';
import { StepRegistry } from './step-registry.js';
import type { DraftManager, DraftData } from './draft-manager.js';

export class StepRunner {
  private registry: StepRegistry;
  private draftManager: DraftManager | null;
  private skillPath: string;

  constructor(registry: StepRegistry, options?: { draftManager?: DraftManager; skillPath?: string }) {
    this.registry = registry;
    this.draftManager = options?.draftManager ?? null;
    this.skillPath = options?.skillPath ?? '.';
  }

  /**
   * 从草稿恢复表单数据
   */
  private restoreFromDraft(draft: DraftData, formData: SkillFormData): SkillFormData {
    return {
      ...formData,
      ...draft.formData,
    };
  }

  /**
   * 构建草稿数据
   */
  private buildDraftData(
    formData: Partial<SkillFormData>,
    completedSteps: string[],
    nextStep: string
  ): DraftData {
    return {
      formData,
      completedSteps,
      nextStep,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * 检查是否存在草稿
   */
  async hasDraft(): Promise<boolean> {
    if (!this.draftManager) return false;
    return this.draftManager.exists();
  }

  /**
   * 加载草稿数据
   */
  async loadDraft(): Promise<DraftData | null> {
    if (!this.draftManager) return null;
    return this.draftManager.load();
  }

  /**
   * 清除草稿
   */
  async clearDraft(): Promise<void> {
    if (!this.draftManager) return;
    return this.draftManager.clear();
  }

  /**
   * 从草稿恢复执行
   * 返回恢复后的表单数据
   */
  async resumeFromDraft(formData: SkillFormData): Promise<{ restoredData: SkillFormData; draft: DraftData }> {
    const draft = await this.loadDraft();
    if (!draft) {
      throw new Error('没有可恢复的草稿');
    }
    const restoredData = this.restoreFromDraft(draft, formData);
    return { restoredData, draft };
  }

  /**
   * 执行所有步骤
   * 支持从指定步骤开始执行（用于草稿恢复）
   */
  async runAll(
    formData: SkillFormData,
    options?: { skipSteps?: string[] }
  ): Promise<SkillFormData> {
    const steps = this.registry.getSteps();
    const currentData = { ...formData };
    const skipSteps = options?.skipSteps ?? [];
    const completedStepNames: string[] = [];

    for (const step of steps) {
      // 草稿恢复：跳过已完成的步骤
      if (skipSteps.includes(step.name)) {
        console.log(`⏭ 步骤 "${step.name}" 已存在草稿，跳过`);
        completedStepNames.push(step.name);
        continue;
      }

      console.log(`\n=== ${step.name} ===`);

      const result: StepResult = await step.execute(currentData);

      if (result.completed && !result.skipped) {
        Object.assign(currentData, result.data);
        completedStepNames.push(step.name);

        // 每完成一个步骤后自动保存草稿
        if (this.draftManager) {
          // 找到下一步骤
          const currentIndex = steps.indexOf(step);
          const nextStep = steps[currentIndex + 1]?.name ?? 'done';

          const draftData = this.buildDraftData(currentData, completedStepNames, nextStep);
          await this.draftManager.save(draftData);
        }
      }

      if (!result.completed && step.isRequired) {
        console.log(`⚠ 必要步骤 "${step.name}" 未完成，流程终止`);
        throw new Error(`必要步骤 ${step.name} 未完成`);
      }
    }

    return currentData;
  }
}
