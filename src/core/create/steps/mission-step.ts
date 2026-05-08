import inquirer from 'inquirer';
import type { CreateStep, SkillFormData, StepResult } from '../types.js';
import { NameValidator } from '../name-validator.js';

export class MissionStep implements CreateStep {
  name = 'Skill 使命定义';
  isRequired = true;
  private validator: NameValidator;

  constructor(validator?: NameValidator) {
    this.validator = validator || new NameValidator();
  }

  async execute(formData: SkillFormData): Promise<StepResult> {
    const category = formData.category || '';

    const nameAnswer = await inquirer.prompt<{
      name: string;
    }>([
      {
        type: 'input',
        name: 'name',
        message: 'Skill 名称（kebab-case 格式）:',
        validate: (input: string) => {
          if (!input.trim()) {
            return '名称不能为空';
          }

          const converted = this.validator.convertToKebabCase(input);
          if (!converted) {
            return '名称格式无效';
          }

          if (!this.validator.validateNameFormat(converted)) {
            return `将转换为: ${converted}，是否符合预期？`;
          }

          if (!this.validator.validateUniqueName(category, converted)) {
            return `Skill "${converted}" 在分类 "${category}" 下已存在`;
          }

          return true;
        },
      },
    ]);

    let skillName = this.validator.convertToKebabCase(nameAnswer.name);
    
    if (skillName !== nameAnswer.name) {
      const confirmAnswer = await inquirer.prompt<{
        confirm: boolean;
      }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: `名称将转换为 "${skillName}"，是否确认？`,
          default: true,
        },
      ]);

      if (!confirmAnswer.confirm) {
        return {
          stepName: this.name,
          completed: false,
          skipped: false,
          data: {},
        };
      }
    }

    const descriptionAnswer = await inquirer.prompt<{
      description: string;
    }>([
      {
        type: 'input',
        name: 'description',
        message: 'Skill 描述（简要说明 Skill 的用途）:',
        validate: (input: string) => {
          if (!input.trim()) {
            return '描述不能为空';
          }
          return true;
        },
      },
    ]);

    console.log(`✓ 名称: ${skillName}`);
    console.log(`✓ 描述: ${descriptionAnswer.description}`);

    return {
      stepName: this.name,
      completed: true,
      skipped: false,
      data: {
        name: skillName,
        description: descriptionAnswer.description,
      },
    };
  }
}