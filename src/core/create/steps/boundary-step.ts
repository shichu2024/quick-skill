import inquirer from 'inquirer';
import type { CreateStep, SkillFormData, StepResult } from '../types.js';

export class BoundaryStep implements CreateStep {
  name = '触发边界定义';
  isRequired = true;

  async execute(formData: SkillFormData): Promise<StepResult> {
    const whenToUseAnswer = await inquirer.prompt<{
      whenToUse: string;
    }>([
      {
        type: 'editor',
        name: 'whenToUse',
        message: 'When to use this（何时使用此 Skill）:',
        default: formData.whenToUse || '',
      },
    ]);

    const whenNotToUseAnswer = await inquirer.prompt<{
      whenNotToUse: string;
    }>([
      {
        type: 'editor',
        name: 'whenNotToUse',
        message: 'When NOT to use this（何时不应使用此 Skill）:',
        default: formData.whenNotToUse || '',
      },
    ]);

    console.log('✓ 触发边界已定义');

    return {
      stepName: this.name,
      completed: true,
      skipped: false,
      data: {
        whenToUse: whenToUseAnswer.whenToUse,
        whenNotToUse: whenNotToUseAnswer.whenNotToUse,
      },
    };
  }
}

export class StandardStep implements CreateStep {
  name = '成功标准定义';
  isRequired = true;

  async execute(formData: SkillFormData): Promise<StepResult> {
    const whatToBuildAnswer = await inquirer.prompt<{
      whatToBuild: string;
    }>([
      {
        type: 'editor',
        name: 'whatToBuild',
        message: 'What to build（产出物、规范要求、用户约束）:',
        default: formData.whatToBuild || '',
      },
    ]);

    const definitionOfDoneAnswer = await inquirer.prompt<{
      definitionOfDone: string;
    }>([
      {
        type: 'editor',
        name: 'definitionOfDone',
        message: 'Definition of done（可量化的完成标准）:',
        default: formData.definitionOfDone || '',
      },
    ]);

    console.log('✓ 成功标准已定义');

    return {
      stepName: this.name,
      completed: true,
      skipped: false,
      data: {
        whatToBuild: whatToBuildAnswer.whatToBuild,
        definitionOfDone: definitionOfDoneAnswer.definitionOfDone,
      },
    };
  }
}