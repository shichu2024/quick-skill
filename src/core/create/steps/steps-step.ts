import inquirer from 'inquirer';
import type { CreateStep, SkillFormData, StepResult } from '../types.js';

export class StepsStep implements CreateStep {
  name = '执行步骤定义';
  isRequired = false;

  async execute(formData: SkillFormData): Promise<StepResult> {
    const skipAnswer = await inquirer.prompt<{
      skip: boolean;
    }>([
      {
        type: 'confirm',
        name: 'skip',
        message: '是否跳过执行步骤定义？',
        default: false,
      },
    ]);

    if (skipAnswer.skip) {
      console.log('✓ 已跳过执行步骤定义');
      return {
        stepName: this.name,
        completed: false,
        skipped: true,
        data: {},
      };
    }

    const steps: string[] = [];
    let continueAdding = true;

    while (continueAdding) {
      const stepAnswer = await inquirer.prompt<{
        step: string;
      }>([
        {
          type: 'input',
          name: 'step',
          message: `步骤 ${steps.length + 1} 描述:`,
        },
      ]);

      if (stepAnswer.step.trim()) {
        steps.push(stepAnswer.step.trim());
      }

      const continueAnswer = await inquirer.prompt<{
        continue: boolean;
      }>([
        {
          type: 'confirm',
          name: 'continue',
          message: '是否继续添加步骤？',
          default: false,
        },
      ]);

      continueAdding = continueAnswer.continue;
    }

    const stepsText = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    console.log(`✓ 已定义 ${steps.length} 个步骤`);

    return {
      stepName: this.name,
      completed: true,
      skipped: false,
      data: { steps: stepsText },
    };
  }
}