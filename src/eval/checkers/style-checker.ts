import fs from 'fs';
import path from 'path';
import type { CheckContext } from './result-checker.js';

/**
 * 风格检查结果接口
 * 风格目标检查器的输出
 */
export interface StyleCheckResult {
  /** 检查器标识 */
  checkerId: 'style';
  /** 是否通过 */
  pass: boolean;
  /** 得分（0-25，满分 25） */
  score: number;
  /** 检查详情列表 */
  details: string[];
  /** 缺少 "What to build" 章节时为 true */
  notApplicable: boolean;
}

/**
 * 从 whatToBuild 中提取的路径项
 */
interface ExtractedPathItem {
  /** 原始描述文本 */
  description: string;
  /** 提取的路径 */
  targetPath: string;
  /** 是否为目录（以 / 结尾或包含"目录"关键词） */
  isDirectory: boolean;
}

/**
 * 格式检查结果
 */
interface FormatCheckItem {
  /** 检查项描述 */
  description: string;
  /** 是否通过 */
  passed: boolean;
  /** 详情信息 */
  message: string;
}

/**
 * 风格目标检查器
 *
 * 验证产出风格是否符合约定：
 * 1. 文件结构是否与 "What to build" 中提到的路径一致
 * 2. 文件/目录命名是否符合 kebab-case 规范
 * 3. 代码/配置格式是否符合预设规则（缩进、行长等）
 *
 * 评分分配：
 * - 文件结构检查：10 分（按路径匹配比例计分）
 * - 命名规则检查：8 分（按命名合规比例计分）
 * - 格式约束检查：7 分（按格式合规比例计分）
 * - 总计：25 分
 *
 * @param context 检查上下文
 * @returns 检查结果
 */
export function checkStyle(context: CheckContext): StyleCheckResult {
  const { skillAnchor, sandbox } = context;

  // 检查 whatToBuild 是否存在且非空
  if (!skillAnchor.whatToBuild || skillAnchor.whatToBuild.trim() === '') {
    return {
      checkerId: 'style',
      pass: false,
      score: 0,
      details: ['缺少 "What to build" 章节，无法进行风格检查'],
      notApplicable: true,
    };
  }

  // 从 whatToBuild 提取路径项
  const pathItems = extractPathItems(skillAnchor.whatToBuild);

  // 如果无法提取任何路径项，标记为不适用
  if (pathItems.length === 0) {
    return {
      checkerId: 'style',
      pass: false,
      score: 0,
      details: ['"What to build" 中未找到可检查的文件或目录路径'],
      notApplicable: true,
    };
  }

  // 验证沙箱目录存在
  if (!fs.existsSync(sandbox.sandboxDir)) {
    return {
      checkerId: 'style',
      pass: false,
      score: 0,
      details: [`沙箱目录不存在: ${sandbox.sandboxDir}`],
      notApplicable: false,
    };
  }

  // 1. 文件结构检查（10 分）
  const structureResult = checkFileStructure(sandbox.sandboxDir, pathItems);

  // 2. 命名规则检查（8 分）
  const namingResult = checkNamingConvention(pathItems, sandbox.sandboxDir);

  // 3. 格式约束检查（7 分）— 仅对存在的文件执行
  const existingFiles = pathItems
    .filter(item => !item.isDirectory)
    .map(item => path.join(sandbox.sandboxDir, item.targetPath))
    .filter(filePath => fs.existsSync(filePath));

  const formatResult = checkFormatConstraints(existingFiles);

  // 汇总得分
  const score = structureResult.score + namingResult.score + formatResult.score;
  const allPassed = structureResult.pass && namingResult.pass && formatResult.pass;

  return {
    checkerId: 'style',
    pass: allPassed,
    score,
    details: [structureResult.message, namingResult.message, formatResult.message],
    notApplicable: false,
  };
}

/**
 * 从 whatToBuild 文本中提取路径项
 *
 * 支持的格式：
 * - "1. src/index.ts — 入口文件"
 * - "- src/utils/ — 工具目录"
 * - "* src/config.ts"
 * - "src/index.ts"（无前缀）
 * - "dist/ — 构建产物目录"（目录）
 */
function extractPathItems(whatToBuild: string): ExtractedPathItem[] {
  const lines = whatToBuild.split('\n').map(line => line.trim()).filter(Boolean);
  const items: ExtractedPathItem[] = [];

  for (const line of lines) {
    // 清理行首的编号/符号（如 "1."、"-"、"*"、"•" 等）
    const cleaned = line.replace(/^[\d\-\*\•\.\s]+/, '').trim();

    if (!cleaned) continue;

    // 提取路径：匹配看起来像文件/目录路径的部分
    // 路径可能包含字母、数字、下划线、连字符、点、斜杠
    const pathMatch = cleaned.match(/^([\w\-./\\]+[.\w/]+)/);

    if (!pathMatch) continue;

    let targetPath = pathMatch[1].trim();

    // 判断是否为目录
    const isDirectory = targetPath.endsWith('/') ||
      cleaned.includes('目录') ||
      cleaned.includes('文件夹');

    // 如果是目录且路径以 / 结尾，去掉末尾的 /
    if (isDirectory && targetPath.endsWith('/')) {
      targetPath = targetPath.slice(0, -1);
    }

    if (!targetPath) continue;

    items.push({
      description: cleaned,
      targetPath,
      isDirectory,
    });
  }

  return items;
}

/**
 * 检查文件结构是否与 whatToBuild 中提到的路径一致
 *
 * 满分 10 分，按路径存在比例计分
 */
function checkFileStructure(
  sandboxDir: string,
  pathItems: ExtractedPathItem[]
): { pass: boolean; score: number; message: string } {
  if (pathItems.length === 0) {
    return {
      pass: true,
      score: 10,
      message: '✓ 结构检查: 无路径需要检查',
    };
  }

  const results: { item: ExtractedPathItem; exists: boolean }[] = [];

  for (const item of pathItems) {
    const fullPath = path.join(sandboxDir, item.targetPath);
    let exists: boolean;

    if (item.isDirectory) {
      exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    } else {
      exists = fs.existsSync(fullPath);
    }

    results.push({ item, exists });
  }

  const existingCount = results.filter(r => r.exists).length;
  const totalCount = results.length;
  const ratio = totalCount > 0 ? existingCount / totalCount : 1;
  const score = Math.round(ratio * 10);

  if (score === 10) {
    return {
      pass: true,
      score: 10,
      message: '✓ 结构检查: 所有文件/目录均已存在',
    };
  }

  const missingItems = results.filter(r => !r.exists).map(r => r.item.targetPath);
  return {
    pass: false,
    score,
    message: `✗ 结构检查: ${missingItems.length} 个文件/目录缺失（${missingItems.join('、')}）`,
  };
}

/**
 * 检查文件/目录命名是否符合 kebab-case 规范
 *
 * kebab-case 规则：
 * - 文件名/目录名仅包含小写字母、数字、连字符
 * - 不包含大写字母、下划线、空格
 * - 扩展名前的部分需要符合 kebab-case
 *
 * 满分 8 分，按命名合规比例计分
 */
function checkNamingConvention(
  pathItems: ExtractedPathItem[],
  sandboxDir: string
): { pass: boolean; score: number; message: string } {
  if (pathItems.length === 0) {
    return {
      pass: true,
      score: 8,
      message: '✓ 命名检查: 无路径需要检查命名',
    };
  }

  const results: { item: ExtractedPathItem; compliant: boolean; reason: string }[] = [];

  for (const item of pathItems) {
    const fullPath = path.join(sandboxDir, item.targetPath);

    // 如果文件/目录不存在，跳过命名检查（由结构检查覆盖）
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    // 提取路径中的每个段进行检查
    const segments = item.targetPath.split(/[\\/]/).filter(Boolean);
    const issues: string[] = [];

    for (const segment of segments) {
      // 分离文件名和扩展名
      const namePart = segment.includes('.')
        ? segment.substring(0, segment.lastIndexOf('.'))
        : segment;

      if (namePart && !isKebabCase(namePart)) {
        issues.push(segment);
      }
    }

    results.push({
      item,
      compliant: issues.length === 0,
      reason: issues.length > 0 ? `命名不符合 kebab-case: ${issues.join('、')}` : '',
    });
  }

  if (results.length === 0) {
    return {
      pass: true,
      score: 8,
      message: '⚠ 命名检查: 无存在的文件可检查命名',
    };
  }

  const compliantCount = results.filter(r => r.compliant).length;
  const totalCount = results.length;
  const ratio = totalCount > 0 ? compliantCount / totalCount : 1;
  const score = Math.round(ratio * 8);

  if (score === 8) {
    return {
      pass: true,
      score: 8,
      message: '✓ 命名检查: 所有文件/目录命名符合 kebab-case 规范',
    };
  }

  const nonCompliant = results
    .filter(r => !r.compliant)
    .map(r => r.item.targetPath);

  return {
    pass: false,
    score,
    message: `✗ 命名检查: ${nonCompliant.length} 个文件/目录命名不符合规范（${nonCompliant.join('、')}）`,
  };
}

/**
 * 检查给定名称是否符合 kebab-case 规范
 *
 * kebab-case: 仅包含小写字母、数字、连字符，且不以连字符开头或结尾
 */
function isKebabCase(name: string): boolean {
  if (!name) return true;

  // 允许纯数字（如版本号）
  if (/^\d+$/.test(name)) return true;

  // kebab-case 正则：小写字母、数字、连字符，不以连字符开头或结尾
  const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return kebabCaseRegex.test(name);
}

/**
 * 检查代码/配置格式是否符合预设规则
 *
 * 检查项：
 * 1. 缩进：使用 2 空格缩进（不使用 Tab）
 * 2. 行长：单行不超过 120 字符
 * 3. JSON 文件格式化：.json 文件应为有效 JSON
 *
 * 满分 7 分，按格式合规比例计分
 */
function checkFormatConstraints(filePaths: string[]): { pass: boolean; score: number; message: string } {
  if (filePaths.length === 0) {
    return {
      pass: true,
      score: 7,
      message: '⚠ 格式检查: 无文件需要检查格式',
    };
  }

  const formatChecks: FormatCheckItem[] = [];

  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // 检查缩进：是否使用了 Tab
    const hasTabIndent = content.includes('\t');
    formatChecks.push({
      description: `${fileName} 缩进检查`,
      passed: !hasTabIndent,
      message: hasTabIndent
        ? `✗ ${fileName}: 使用了 Tab 缩进，应使用空格`
        : `✓ ${fileName}: 缩进格式正确`,
    });

    // 检查行长：是否有超过 120 字符的行
    const lines = content.split('\n');
    const longLines = lines.filter(line => line.length > 120);
    formatChecks.push({
      description: `${fileName} 行长检查`,
      passed: longLines.length === 0,
      message: longLines.length > 0
        ? `✗ ${fileName}: ${longLines.length} 行超过 120 字符限制`
        : `✓ ${fileName}: 行长符合规范`,
    });

    // JSON 文件格式化检查
    if (ext === '.json') {
      try {
        JSON.parse(content);
        formatChecks.push({
          description: `${fileName} JSON 格式检查`,
          passed: true,
          message: `✓ ${fileName}: JSON 格式有效`,
        });
      } catch {
        formatChecks.push({
          description: `${fileName} JSON 格式检查`,
          passed: false,
          message: `✗ ${fileName}: JSON 格式无效`,
        });
      }
    }
  }

  const passedCount = formatChecks.filter(c => c.passed).length;
  const totalCount = formatChecks.length;
  const ratio = totalCount > 0 ? passedCount / totalCount : 1;
  const score = Math.round(ratio * 7);

  if (score === 7) {
    return {
      pass: true,
      score: 7,
      message: '✓ 格式检查: 所有文件格式符合规范（缩进、行长）',
    };
  }

  const failedChecks = formatChecks.filter(c => !c.passed);
  const failedDetails = failedChecks.map(c => {
    // 提取关键问题类型（缩进、行长、JSON 等）
    if (c.message.includes('Tab')) return '缩进';
    if (c.message.includes('行长')) return '行长';
    if (c.message.includes('JSON')) return 'JSON 格式';
    return c.description;
  });
  return {
    pass: false,
    score,
    message: `✗ 格式检查: ${failedChecks.length} 项格式不符合规范（${failedDetails.join('、')}）`,
  };
}
