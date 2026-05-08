import type { SkillFormData, CreateStep, StepResult } from './types.js';
import { StepRegistry } from './step-registry.js';

export class StepRunner {
  private registry: StepRegistry;

  constructor(registry: StepRegistry) {
    this.registry = registry;
  }

  async runAll(formData: SkillFormData): Promise<SkillFormData> {
    const steps = this.registry.getSteps();
    const currentData = { ...formData };

    for (const step of steps) {
      console.log(`\n=== ${step.name} ===`);
      
      const result: StepResult = await step.execute(currentData);
      
      if (result.completed && !result.skipped) {
        Object.assign(currentData, result.data);
      }
      
      if (!result.completed && step.isRequired) {
        console.log(`⚠ 必要步骤 "${step.name}" 未完成，流程终止`);
        throw new Error(`必要步骤 ${step.name} 未完成`);
      }
    }

    return currentData;
  }
}