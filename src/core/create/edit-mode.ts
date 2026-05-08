import inquirer from 'inquirer';
import type { SkillFormData } from './types.js';
import type { SkillLoader } from './skill-loader.js';

/**
 * 编辑模式接口
 */
export interface EditModeInterface {
  loadSkill(skillName: string): Promise<SkillFormData>;
  runEditFlow(currentData: SkillFormData): Promise<SkillFormData>;
}

/**
 * 可编辑的字段列表及其显示标签
 */
const EDITABLE_FIELDS: Array<{ key: keyof SkillFormData; label: string; type: 'input' | 'editor' }> = [
  { key: 'category', label: '业务分类 (category)', type: 'input' },
  { key: 'name', label: 'Skill 名称 (name)', type: 'input' },
  { key: 'description', label: '描述 (description)', type: 'input' },
  { key: 'whenToUse', label: '何时使用 (When to use this)', type: 'editor' },
  { key: 'whenNotToUse', label: '何时不使用 (When NOT to use this)', type: 'editor' },
  { key: 'whatToBuild', label: '构建目标 (What to build)', type: 'editor' },
  { key: 'steps', label: '步骤 (Steps)', type: 'editor' },
  { key: 'definitionOfDone', label: '完成定义 (Definition of done)', type: 'editor' },
];

export class EditMode implements EditModeInterface {
  private loader: SkillLoader;
  private skillsPath: string;

  constructor(loader: SkillLoader, skillsPath: string = './skills') {
    this.loader = loader;
    this.skillsPath = skillsPath;
  }

  /**
   * 加载已有 Skill 的内容
   * @param skillName Skill 名称
   * @returns 解析后的 SkillFormData
   */
  async loadSkill(skillName: string): Promise<SkillFormData> {
    const skillPath = await this.loader.findSkill(skillName);

    if (!skillPath) {
      throw new Error(`未找到 Skill: ${skillName}`);
    }

    console.log(`📄 找到 Skill 文件: ${skillPath}`);
    return this.loader.parseSkillMd(skillPath);
  }

  /**
   * 运行交互式编辑流程
   * 逐章节展示当前值，用户可修改或保留不变
   * @param currentData 当前 Skill 数据
   * @returns 修改后的 SkillFormData
   */
  async runEditFlow(currentData: SkillFormData): Promise<SkillFormData> {
    const newData: SkillFormData = { ...currentData };
    let hasModification = false;

    console.log('\n📝 进入编辑模式 - 逐章节修改（按 Enter 保留原值）\n');

    for (const field of EDITABLE_FIELDS) {
      const currentValue = newData[field.key] || '';
      const displayValue = currentValue ? currentValue : '(空)';

      console.log(`--- ${field.label} ---`);
      console.log(`当前值: ${displayValue}\n`);

      const answer = await inquirer.prompt([
        {
          type: field.type === 'editor' ? 'editor' : 'input',
          name: 'value',
          message: `输入新值（保留原值直接按 Enter）:`,
          default: '',
        },
      ]);

      const userInput = (answer as { value: string }).value;

      if (userInput !== undefined && userInput !== '') {
        newData[field.key] = userInput;
        hasModification = true;
        console.log(`✅ 已更新`);
      } else {
        console.log(`⏭ 保留原值`);
      }

      console.log('');
    }

    if (!hasModification) {
      throw new Error('未做任何修改，编辑流程已取消');
    }

    console.log('✅ 编辑完成，共修改了部分章节\n');
    return newData;
  }
}
