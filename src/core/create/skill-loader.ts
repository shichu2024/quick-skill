import * as fs from 'fs';
import * as path from 'path';
import type { SkillFormData } from './types.js';

/**
 * 章节标题到 SkillFormData 字段的映射（支持中英文）
 */
const SECTION_FIELD_MAP: Record<string, keyof SkillFormData> = {
  // 英文标题
  'when to use this': 'whenToUse',
  'when not to use this': 'whenNotToUse',
  'what to build': 'whatToBuild',
  steps: 'steps',
  'definition of done': 'definitionOfDone',
  // 中文标题
  '何时使用': 'whenToUse',
  '何时不使用': 'whenNotToUse',
  '构建目标': 'whatToBuild',
  '步骤': 'steps',
  '完成定义': 'definitionOfDone',
  // 常见变体
  '先读': 'whenToUse',
};

export class SkillLoader {
  private skillsPath: string;

  constructor(skillsPath: string = './skills') {
    this.skillsPath = skillsPath;
  }

  /**
   * 在 skillsPath 下所有分类子目录中查找指定名称的 SKILL.md
   * @param skillName Skill 名称（对应 SKILL.md frontmatter 中的 name 字段）
   * @returns 找到的 SKILL.md 文件路径，未找到返回 null
   */
  async findSkill(skillName: string): Promise<string | null> {
    if (!fs.existsSync(this.skillsPath)) {
      return null;
    }

    // 递归遍历所有子目录，查找 SKILL.md
    const skillFiles = this.findAllSkillFiles(this.skillsPath);

    for (const filePath of skillFiles) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const name = this.extractFrontmatterName(content);
      if (name === skillName) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * 解析 SKILL.md 文件，提取各章节内容为 SkillFormData
   * @param filePath SKILL.md 文件路径
   * @returns 解析后的 SkillFormData
   */
  async parseSkillMd(filePath: string): Promise<SkillFormData> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const data: SkillFormData = {};

    // 解析 YAML frontmatter
    const frontmatter = this.parseFrontmatter(content);
    if (frontmatter.name) {
      data.name = frontmatter.name;
    }
    if (frontmatter.description) {
      data.description = frontmatter.description;
    }

    // 从文件路径提取 category（skillsPath 下的第一级子目录名）
    const relativePath = path.relative(this.skillsPath, filePath);
    const parts = relativePath.split(path.sep);
    if (parts.length > 0) {
      data.category = parts[0];
    }

    // 解析正文中的各章节
    const body = this.extractBody(content);
    const sections = this.parseSections(body);

    for (const [sectionKey, fieldValue] of Object.entries(sections)) {
      const field = SECTION_FIELD_MAP[sectionKey.toLowerCase()];
      if (field && fieldValue.trim()) {
        data[field] = fieldValue.trim();
      }
    }

    return data;
  }

  /**
   * 递归查找指定目录下所有 SKILL.md 文件
   */
  private findAllSkillFiles(dir: string): string[] {
    const results: string[] = [];

    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...this.findAllSkillFiles(fullPath));
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * 从 Markdown 内容中提取 YAML frontmatter 中的 name 字段
   */
  private extractFrontmatterName(content: string): string | null {
    const frontmatter = this.parseFrontmatter(content);
    return frontmatter.name || null;
  }

  /**
   * 解析 YAML frontmatter（简化实现，仅处理 name 和 description）
   */
  private parseFrontmatter(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    // 匹配 --- 包裹的 frontmatter
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) {
      return result;
    }

    const frontmatterBlock = match[1];
    const lines = frontmatterBlock.split('\n');

    for (const line of lines) {
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
   * 解析正文中的各个章节（以 # 或 ## 开头的标题为分隔符）
   */
  private parseSections(body: string): Record<string, string> {
    const sections: Record<string, string> = {};
    // 匹配 # 或 ## 开头的标题及其内容（兼容不同 SKILL.md 格式）
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
