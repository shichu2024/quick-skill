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
    // 解析现有内容的 frontmatter 和章节
    const existingFrontmatter = this.parseFrontmatter(existingContent);
    const existingBody = this.extractBody(existingContent);
    const existingSections = this.parseSections(existingBody);

    // 更新 frontmatter 中的 name 和 description
    const newName = formData.name ?? existingFrontmatter.name ?? '';
    const newDescription = formData.description ?? existingFrontmatter.description ?? '';

    // 章节字段到标题的映射
    const sectionTitleMap: Record<string, string> = {
      whenToUse: 'When to use this',
      whenNotToUse: 'When NOT to use this',
      whatToBuild: 'What to build',
      steps: 'Steps',
      definitionOfDone: 'Definition of done',
    };

    // 构建更新后的章节内容
    const updatedSections: Record<string, string> = {};
    for (const [field, title] of Object.entries(sectionTitleMap)) {
      const key = field as keyof SkillFormData;
      // 如果 formData 中有新值，使用新值；否则保留原有章节内容
      if (formData[key] !== undefined && formData[key] !== '') {
        updatedSections[title] = formData[key] as string;
      } else {
        // 尝试从现有内容中查找该章节（支持中英文标题）
        const existingValue = this.findExistingSection(existingSections, title, key);
        updatedSections[title] = existingValue ?? '';
      }
    }

    // 重新生成完整内容
    return this.buildMergedContent(newName, newDescription, updatedSections);
  }

  /**
   * 从现有章节中查找对应字段的值（支持中英文标题变体）
   */
  private findExistingSection(
    existingSections: Record<string, string>,
    englishTitle: string,
    fieldKey: string
  ): string | undefined {
    // 直接匹配英文标题
    if (existingSections[englishTitle.toLowerCase()]) {
      return existingSections[englishTitle.toLowerCase()];
    }

    // 中文标题映射
    const chineseTitleMap: Record<string, string> = {
      whenToUse: '何时使用',
      whenNotToUse: '何时不使用',
      whatToBuild: '构建目标',
      steps: '步骤',
      definitionOfDone: '完成定义',
    };

    const chineseTitle = chineseTitleMap[fieldKey];
    if (chineseTitle && existingSections[chineseTitle.toLowerCase()]) {
      return existingSections[chineseTitle.toLowerCase()];
    }

    return undefined;
  }

  /**
   * 构建合并后的完整 SKILL.md 内容
   */
  private buildMergedContent(
    name: string,
    description: string,
    sections: Record<string, string>
  ): string {
    const lines: string[] = [];

    // YAML front matter
    lines.push('---');
    lines.push(`name: ${name}`);
    lines.push(`description: ${description}`);
    lines.push('---');
    lines.push('');

    // 按标准顺序输出章节
    const sectionOrder = [
      'When to use this',
      'When NOT to use this',
      'What to build',
      'Steps',
      'Definition of done',
    ];

    for (const title of sectionOrder) {
      const content = sections[title];
      if (content && content.trim()) {
        lines.push(`# ${title}`);
        lines.push('');
        lines.push(content.trim());
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 解析 YAML frontmatter（简化实现）
   */
  private parseFrontmatter(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return result;

    const frontmatterBlock = match[1];
    for (const line of frontmatterBlock.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          result[key] = value;
        }
      }
    }
    return result;
  }

  /**
   * 提取 frontmatter 之后的正文内容
   */
  private extractBody(content: string): string {
    const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
    if (match) {
      return content.substring(match[0].length);
    }
    return content;
  }

  /**
   * 解析正文中的各个章节
   */
  private parseSections(body: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const headingRegex = /^#{1,2}\s+(.+)$/gm;

    const headings: Array<{ title: string; startIndex: number }> = [];
    let match;

    while ((match = headingRegex.exec(body)) !== null) {
      headings.push({
        title: match[1].trim(),
        startIndex: match.index,
      });
    }

    for (let i = 0; i < headings.length; i++) {
      const current = headings[i];
      const next = headings[i + 1];
      const startOfContent = body.indexOf('\n', current.startIndex) + 1;
      const endOfContent = next ? next.startIndex : body.length;

      const sectionContent = body.substring(startOfContent, endOfContent).trim();
      sections[current.title.toLowerCase()] = sectionContent;
    }

    return sections;
  }
}