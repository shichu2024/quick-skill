import fs from 'fs';
import path from 'path';
import { SkillAnchor, SkillParseError } from '../types/skill.js';

export { SkillParseError };

/**
 * 解析 SKILL.md 文件，提取 YAML front matter 和 Markdown 章节中的结构化锚点。
 * 必填字段：name、description、whenToUse、whenNotToUse
 * 可选字段：definitionOfDone、whatToBuild（缺失时返回空字符串）
 */
export function parseSkillMd(filePath: string): SkillAnchor {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new SkillParseError(`SKILL.md 文件不存在: ${absolutePath}`, ['file']);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  if (!content.trim()) {
    throw new SkillParseError('SKILL.md 文件为空', ['content']);
  }

  // 提取 YAML front matter
  const frontMatter = extractFrontMatter(content);

  // 提取 Markdown 章节
  const sections = extractSections(content);

  const anchor: SkillAnchor = {
    name: frontMatter.name || '',
    description: frontMatter.description || '',
    whenToUse: sections.whenToUse || '',
    whenNotToUse: sections.whenNotToUse || '',
    definitionOfDone: sections.definitionOfDone || '',
    whatToBuild: sections.whatToBuild || '',
    steps: sections.steps || '',
  };

  // 校验必填字段
  const missingFields: string[] = [];
  if (!anchor.name) missingFields.push('name');
  if (!anchor.description) missingFields.push('description');
  if (!anchor.whenToUse) missingFields.push('When to use this');
  if (!anchor.whenNotToUse) missingFields.push('When NOT to use this');

  if (missingFields.length > 0) {
    throw new SkillParseError(
      `SKILL.md 缺少必填章节: ${missingFields.join(', ')}`,
      missingFields
    );
  }

  return anchor;
}

interface FrontMatterData {
  name?: string;
  description?: string;
}

function extractFrontMatter(content: string): FrontMatterData {
  const result: FrontMatterData = {};

  // 匹配 YAML front matter (--- ... ---)
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return result;
  }

  const frontMatterContent = frontMatterMatch[1];

  // 提取 name 字段
  const nameMatch = frontMatterContent.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // 提取 description 字段
  const descMatch = frontMatterContent.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  return result;
}

interface SectionData {
  whenToUse?: string;
  whenNotToUse?: string;
  definitionOfDone?: string;
  whatToBuild?: string;
  steps?: string;
}

function extractSections(content: string): SectionData {
  const result: SectionData = {};

  // 移除 front matter 部分
  const body = content.replace(/^---\n[\s\S]*?\n---/, '');

  // 提取 "When to use this" 章节
  result.whenToUse = extractSection(body, 'When to use this');

  // 提取 "When NOT to use this" 章节
  result.whenNotToUse = extractSection(body, 'When NOT to use this');

  // 提取 "Definition of done" 章节
  result.definitionOfDone = extractSection(body, 'Definition of done');

  // 提取 "What to build" 章节
  result.whatToBuild = extractSection(body, 'What to build');

  // 提取 "Steps" 章节（可选）
  result.steps = extractSection(body, 'Steps');

  return result;
}

/**
 * 提取指定标题下的内容，使用逐行解析方式避免正则表达式 lookahead 问题
 */
function extractSection(content: string, heading: string): string {
  const lines = content.split('\n');
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRegex = new RegExp(`^#{2,3}\\s+${escapedHeading}\\s*$`);
  
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i].trim())) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) {
    return '';
  }

  // 从标题下一行开始收集内容，直到遇到同级或更高级标题
  const contentLines: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    // 检查是否是 ## 或 ### 开头的标题（同级或更高级）
    if (/^#{1,3}\s+/.test(line.trim())) {
      break;
    }
    contentLines.push(line);
  }

  return contentLines.join('\n').trim();
}
