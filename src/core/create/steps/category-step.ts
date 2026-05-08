import inquirer from 'inquirer';
import type { CreateStep, SkillFormData, StepResult } from '../types.js';
import { CategoryResolver } from '../category-resolver.js';

export class CategoryStep implements CreateStep {
  name = '业务分类选择';
  isRequired = true;
  private resolver: CategoryResolver;

  constructor(resolver?: CategoryResolver) {
    this.resolver = resolver || new CategoryResolver();
  }

  async execute(formData: SkillFormData): Promise<StepResult> {
    if (formData.category) {
      console.log(`✓ 已通过参数指定分类: ${formData.category}`);
      return {
        stepName: this.name,
        completed: true,
        skipped: true,
        data: { category: formData.category },
      };
    }

    const existingCategories = this.resolver.getExistingCategories();
    const choices = [
      ...existingCategories.map(cat => ({ name: cat, value: cat })),
      { name: '+ 创建新分类', value: '__new__' },
    ];

    const answer = await inquirer.prompt<{
      category: string;
      newCategory?: string;
    }>([
      {
        type: 'list',
        name: 'category',
        message: '选择业务分类:',
        choices,
      },
    ]);

    if (answer.category === '__new__') {
      const newCategoryAnswer = await inquirer.prompt<{
        newCategory: string;
      }>([
        {
          type: 'input',
          name: 'newCategory',
          message: '输入新分类名称（kebab-case 格式）:',
          validate: (input: string) => {
            const converted = this.resolver.convertToKebabCase(input);
            if (!converted) {
              return '分类名称不能为空';
            }
            if (!this.resolver.validateCategoryName(converted)) {
              return '请使用 kebab-case 格式（如: public、需求分析改为 requirements）';
            }
            if (existingCategories.includes(converted)) {
              return `分类 "${converted}" 已存在`;
            }
            return true;
          },
        },
      ]);

      const newCategory = this.resolver.convertToKebabCase(newCategoryAnswer.newCategory);
      console.log(`✓ 新分类: ${newCategory}`);

      return {
        stepName: this.name,
        completed: true,
        skipped: false,
        data: { category: newCategory },
      };
    }

    console.log(`✓ 已选择分类: ${answer.category}`);
    return {
      stepName: this.name,
      completed: true,
      skipped: false,
      data: { category: answer.category },
    };
  }
}