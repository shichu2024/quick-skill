import { createHash } from 'crypto';
import { SkillAnchor } from '../types/skill.js';
import { SkillSnapshot } from '../types/snapshot.js';
import { ChangeDetectionResult, SectionChange, ChangeType } from '../types/change.js';

/**
 * SKILL.md 章节名称到 SkillAnchor 字段名的映射
 */
const SECTION_KEYS: Array<keyof SkillAnchor> = [
  'name',
  'description',
  'whenToUse',
  'whenNotToUse',
  'definitionOfDone',
  'whatToBuild',
  'steps',
];

/**
 * 对比当前 SKILL.md 与快照版本,识别章节级别的变更
 * 
 * @param currentAnchor - 当前 SKILL.md 解析后的锚点
 * @param snapshot - 历史快照(包含旧版本 SKILL.md 内容)
 * @returns 变更检测结果
 * 
 * 规则:
 * - 快照不存在时,所有章节标记为 'added'
 * - 以章节为最小单位,不做段落内 diff
 * - 无差异时 hasChanges=false,changes 为空数组
 */
export function detectChanges(
  currentAnchor: SkillAnchor,
  snapshot: SkillSnapshot | null
): ChangeDetectionResult {
  // 快照不存在,视为全新
  if (!snapshot) {
    const changes: SectionChange[] = SECTION_KEYS.map((key) => ({
      section: key,
      changeType: 'added',
      previousContent: '',
      currentContent: currentAnchor[key] || '',
    }));

    return {
      hasChanges: true,
      changes,
    };
  }

  // 先通过哈希快速判断是否完全相同
  const currentContent = buildSkillMdContent(currentAnchor);
  const currentHash = computeSha256(currentContent);
  
  if (currentHash === snapshot.hash) {
    return {
      hasChanges: false,
      changes: [],
    };
  }

  // 哈希不同,需要逐章节对比
  // 从快照内容解析出旧的 SkillAnchor
  let previousAnchor: SkillAnchor;
  try {
    previousAnchor = parseSkillMdFromContent(snapshot.content);
  } catch (error) {
    // 解析失败,保守处理:返回全部变更
    return {
      hasChanges: true,
      changes: SECTION_KEYS.map((key) => ({
        section: key,
        changeType: 'modified',
        previousContent: '',
        currentContent: currentAnchor[key] || '',
      })),
    };
  }

  // 逐章节对比
  const changes: SectionChange[] = [];

  for (const key of SECTION_KEYS) {
    const previousContent = previousAnchor[key];
    const currentContent = currentAnchor[key];

    // 判断变更类型
    let changeType: ChangeType | null = null;

    if (!previousContent && currentContent) {
      // 新增
      changeType = 'added';
    } else if (previousContent && !currentContent) {
      // 删除
      changeType = 'removed';
    } else if (previousContent !== currentContent) {
      // 修改
      changeType = 'modified';
    }

    if (changeType) {
      changes.push({
        section: key,
        changeType,
        previousContent: previousContent || '',
        currentContent: currentContent || '',
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
  };
}

/**
 * 从 SkillAnchor 重建 SKILL.md 内容(用于哈希对比)
 */
function buildSkillMdContent(anchor: SkillAnchor): string {
  let content = `---
name: ${anchor.name}
description: ${anchor.description}
---

## When to use this

${anchor.whenToUse}

## When NOT to use this

${anchor.whenNotToUse}

## Definition of done

${anchor.definitionOfDone}

## What to build

${anchor.whatToBuild}`;

  // 仅在存在 steps 内容时才追加 Steps 章节，避免无变更时哈希不一致
  if (anchor.steps) {
    content += `

## Steps

${anchor.steps}`;
  }

  content += '\n';

  return content;
}

/**
 * 计算 SHA-256 哈希
 */
function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 从 SKILL.md 内容字符串解析出 SkillAnchor
 */
function parseSkillMdFromContent(content: string): SkillAnchor {
  // 提取 YAML front matter
  const frontMatter = extractFrontMatter(content);

  // 提取 Markdown 章节
  const sections = extractSections(content);

  return {
    name: frontMatter.name || '',
    description: frontMatter.description || '',
    whenToUse: sections.whenToUse || '',
    whenNotToUse: sections.whenNotToUse || '',
    definitionOfDone: sections.definitionOfDone || '',
    whatToBuild: sections.whatToBuild || '',
    steps: sections.steps || '',
  };
}

interface FrontMatterData {
  name?: string;
  description?: string;
}

function extractFrontMatter(content: string): FrontMatterData {
  const result: FrontMatterData = {};

  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return result;
  }

  const frontMatterContent = frontMatterMatch[1];

  const nameMatch = frontMatterContent.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
  }

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

  const body = content.replace(/^---\n[\s\S]*?\n---/, '');

  result.whenToUse = extractSection(body, 'When to use this');
  result.whenNotToUse = extractSection(body, 'When NOT to use this');
  result.definitionOfDone = extractSection(body, 'Definition of done');
  result.whatToBuild = extractSection(body, 'What to build');
  result.steps = extractSection(body, 'Steps');

  return result;
}

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

  const contentLines: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s+/.test(line.trim())) {
      break;
    }
    contentLines.push(line);
  }

  return contentLines.join('\n').trim();
}
