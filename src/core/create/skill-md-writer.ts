import * as fs from 'fs';
import * as path from 'path';
import { generateSkillMdTemplate } from './templates/skill-md-template.js';
import type { SkillFormData } from './types.js';

export class SkillMdWriter {
  private skillsPath: string;

  constructor(skillsPath: string = './skills') {
    this.skillsPath = skillsPath;
  }

  async create(formData: SkillFormData): Promise<string> {
    if (!formData.category || !formData.name) {
      throw new Error('category 和 name 为必填字段');
    }

    const skillDir = path.join(this.skillsPath, formData.category, formData.name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const evalsPath = path.join(skillDir, 'evals');

    // 创建 Skill 目录
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    // 创建 evals 目录
    if (!fs.existsSync(evalsPath)) {
      fs.mkdirSync(evalsPath, { recursive: true });
    }

    // 生成 SKILL.md 内容
    const content = generateSkillMdTemplate({
      name: formData.name!,
      description: formData.description || '',
      whenToUse: formData.whenToUse,
      whenNotToUse: formData.whenNotToUse,
      whatToBuild: formData.whatToBuild,
      steps: formData.steps,
      definitionOfDone: formData.definitionOfDone,
    });

    // 写入 SKILL.md
    await fs.promises.writeFile(skillMdPath, content, 'utf-8');

    return skillMdPath;
  }

  async update(skillPath: string, formData: Partial<SkillFormData>): Promise<string> {
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`SKILL.md 不存在: ${skillMdPath}`);
    }

    // 备份旧版本
    const backupPath = path.join(skillPath, 'SKILL.md.bak');
    const existingContent = await fs.promises.readFile(skillMdPath, 'utf-8');
    await fs.promises.writeFile(backupPath, existingContent, 'utf-8');

    // 解析现有内容并合并更新
    const updatedContent = this.mergeContent(existingContent, formData);

    // 写入新内容
    await fs.promises.writeFile(skillMdPath, updatedContent, 'utf-8');

    return skillMdPath;
  }

  private mergeContent(existingContent: string, formData: Partial<SkillFormData>): string {
    // 简化实现：如果 formData 包含完整数据，重新生成整个文件
    if (formData.name && formData.description) {
      return generateSkillMdTemplate({
        name: formData.name,
        description: formData.description,
        whenToUse: formData.whenToUse,
        whenNotToUse: formData.whenNotToUse,
        whatToBuild: formData.whatToBuild,
        steps: formData.steps,
        definitionOfDone: formData.definitionOfDone,
      });
    }

    // 否则返回原内容（未实现章节级别的合并）
    return existingContent;
  }
}