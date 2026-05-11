import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { parseConstraint } from './constraint-parser.js';
import { CONSTRAINT_SECTION_MAP } from '../types/constraint.js';
import type { ConstraintType, ParsedConstraint } from '../types/constraint.js';
import { TestCase } from '../types/test-case.js';
import { SkillAnchor } from '../types/skill.js';
import { parseSkillMd } from './skill-parser.js';
import { readCasesFromCsv } from '../io/csv-reader.js';
import { writeCasesToCsv } from '../io/csv-writer.js';
import { generateSnapshot } from '../io/snapshot-manager.js';
import { backupFile } from '../io/backup.js';
import { generateImplicitCases } from './explicit-implicit-generator.js';
import { generateNegativeCases } from './context-negative-generator.js';

/**
 * 约束应用结果
 */
export interface ConstraintApplyResult {
  /** 写入了哪些 SKILL.md 章节 */
  writtenSections: string[];
  /** 新增用例数量 */
  addedCaseCount: number;
  /** 修改用例数量 */
  modifiedCaseCount: number;
  /** 快照是否已更新 */
  snapshotUpdated: boolean;
}

/**
 * 章节标题到 SkillAnchor 字段名的映射
 */
const SECTION_TO_FIELD: Record<string, keyof SkillAnchor> = {
  'When to use this': 'whenToUse',
  'When NOT to use this': 'whenNotToUse',
  'Definition of done': 'definitionOfDone',
  'What to build': 'whatToBuild',
};

/**
 * 将约束追加到 SKILL.md 指定章节的末尾
 *
 * @param skillMdPath - SKILL.md 文件路径
 * @param sectionName - 章节标题（如 "When to use this"）
 * @param constraintText - 约束文本
 */
function appendToSection(skillMdPath: string, sectionName: string, constraintText: string): void {
  let content = fs.readFileSync(skillMdPath, 'utf-8');

  // 查找章节标题位置
  const escapedHeading = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRegex = new RegExp(`^(#{2,3})\\s+${escapedHeading}\\s*$`, 'm');
  const match = content.match(headingRegex);

  if (!match) {
    // 如果章节不存在，则在文件末尾创建新章节
    const newSection = `\n\n## ${sectionName}\n\n- ${constraintText}\n`;
    content += newSection;
  } else {
    // 找到章节标题，在其内容末尾追加约束
    const headingStart = match.index!;
    const headingLineEnd = content.indexOf('\n', headingStart);

    // 查找下一个同级或更高级标题的位置
    let nextHeadingIndex = -1;
    const headingLevel = match[1].length; // ## 或 ###
    const linesAfterHeading = content.substring(headingLineEnd + 1).split('\n');

    let charOffset = headingLineEnd + 1;
    for (const line of linesAfterHeading) {
      const headingMatch = line.match(/^(#{1,3})\s+/);
      if (headingMatch && headingMatch[1].length <= headingLevel) {
        nextHeadingIndex = charOffset;
        break;
      }
      charOffset += line.length + 1; // +1 for \n
    }

    // 确定插入位置
    const insertPosition = nextHeadingIndex === -1 ? content.length : nextHeadingIndex;

    // 在章节内容末尾追加约束（作为列表项）
    const beforeInsert = content.substring(0, insertPosition);
    const afterInsert = content.substring(insertPosition);

    // 检查章节末尾是否已有内容
    const currentSectionContent = beforeInsert.substring(headingLineEnd + 1).trim();
    const appendText = currentSectionContent
      ? `\n- ${constraintText}\n`
      : `- ${constraintText}\n`;

    content = beforeInsert + appendText + afterInsert;
  }

  fs.writeFileSync(skillMdPath, content, 'utf-8');
}

/**
 * 基于正向触发约束生成隐式调用用例
 *
 * @param anchor - Skill 锚点信息
 * @param constraintText - 约束文本
 * @param existingCases - 当前已有的用例列表
 * @returns 新生成的用例列表
 */
function generateCasesForPositiveTrigger(
  anchor: SkillAnchor,
  constraintText: string,
  existingCases: TestCase[]
): TestCase[] {
  const newCases: TestCase[] = [];
  const skillName = anchor.name || 'unknown-skill';
  const existingIds = new Set(existingCases.map((c) => c.id));

  // 基于约束文本生成隐式调用用例
  const implicitCase: TestCase = {
    id: `${skillName}-implicit-constraint-${Date.now()}`,
    should_trigger: true,
    prompt: `当${constraintText.replace(/当|时|可使用此技能|可使用/g, '').trim()}时，我该怎么办？`,
    pass_criteria: anchor.definitionOfDone || '功能按预期工作',
    custom: false,
    deprecated: false,
  };

  if (!existingIds.has(implicitCase.id)) {
    newCases.push(implicitCase);
  }

  return newCases;
}

/**
 * 基于负向禁止约束生成负例控制用例
 *
 * @param anchor - Skill 锚点信息
 * @param constraintText - 约束文本
 * @param existingCases - 当前已有的用例列表
 * @returns 新生成的用例列表
 */
function generateCasesForNegativeProhibition(
  anchor: SkillAnchor,
  constraintText: string,
  existingCases: TestCase[]
): TestCase[] {
  const newCases: TestCase[] = [];
  const skillName = anchor.name || 'unknown-skill';
  const existingIds = new Set(existingCases.map((c) => c.id));

  // 基于约束文本生成负例控制用例
  const negativeCase: TestCase = {
    id: `${skillName}-negative-constraint-${Date.now()}`,
    should_trigger: false,
    prompt: `我需要${constraintText.replace(/禁止|在|中使用此技能|中/g, '').trim()}，请帮我处理`,
    pass_criteria: 'Skill 不应被触发; 场景与约束冲突',
    custom: false,
    deprecated: false,
  };

  if (!existingIds.has(negativeCase.id)) {
    newCases.push(negativeCase);
  }

  return newCases;
}

/**
 * 更新正向用例（should_trigger=true）的 pass_criteria，加入约束内容
 *
 * @param cases - 当前用例列表
 * @param constraintText - 约束文本
 * @param constraintType - 约束类型
 * @returns { modifiedCount: 修改数量, updatedCases: 更新后的用例列表 }
 */
function updatePositiveCaseCriteria(
  cases: TestCase[],
  constraintText: string,
  constraintType: ConstraintType
): { modifiedCount: number; updatedCases: TestCase[] } {
  let modifiedCount = 0;

  const updatedCases = cases.map((testCase) => {
    // 只更新正向用例（should_trigger=true）且非自定义、非停用的用例
    if (testCase.should_trigger && !testCase.custom && !testCase.deprecated) {
      // 根据约束类型生成不同的 pass_criteria 补充说明
      let criteriaSuffix: string;
      switch (constraintType) {
        case 'success-criteria':
          criteriaSuffix = `; 约束: ${constraintText}`;
          break;
        case 'execution-flow':
          criteriaSuffix = `; 流程约束: ${constraintText}`;
          break;
        case 'style-norm':
          criteriaSuffix = `; 风格约束: ${constraintText}`;
          break;
        default:
          criteriaSuffix = `; 约束: ${constraintText}`;
      }

      // 避免重复追加相同约束
      if (!testCase.pass_criteria.includes(constraintText)) {
        modifiedCount++;
        return {
          ...testCase,
          pass_criteria: testCase.pass_criteria + criteriaSuffix,
        };
      }
    }
    return testCase;
  });

  return { modifiedCount, updatedCases };
}

/**
 * 应用约束到 SKILL.md 和对应用例
 *
 * 流程:
 * 1. 解析约束 -> ParsedConstraint
 * 2. 备份 SKILL.md
 * 3. 将约束追加到对应章节末尾
 * 4. 基于约束类型生成/修改用例
 * 5. 更新快照
 *
 * @param skillDir - Skill 目录路径（包含 SKILL.md 和 evals/ 子目录）
 * @param constraintText - 用户输入的约束文本
 * @returns 约束应用结果
 */
export function applyConstraint(
  skillDir: string,
  constraintText: string
): ConstraintApplyResult {
  const absoluteSkillDir = path.resolve(skillDir);
  const skillMdPath = path.join(absoluteSkillDir, 'SKILL.md');
  const evalsDir = path.join(absoluteSkillDir, 'evals');
  const csvPath = path.join(evalsDir, 'test-cases.csv');
  const backupDir = path.join(evalsDir, '.backup');

  // 初始化结果
  const result: ConstraintApplyResult = {
    writtenSections: [],
    addedCaseCount: 0,
    modifiedCaseCount: 0,
    snapshotUpdated: false,
  };

  // ===== 步骤 1：解析约束 =====
  const parsed = parseConstraint(constraintText);

  // 如果约束无法分类（模糊），不修改任何文件
  if (parsed.isAmbiguous || parsed.categories.length === 0) {
    console.log('[eval-sync] 约束无法明确分类，请补充更多信息');
    console.log(`  约束内容: ${constraintText}`);
    return result;
  }

  // ===== 步骤 2：备份 SKILL.md =====
  if (fs.existsSync(skillMdPath)) {
    backupFile(skillMdPath, backupDir);
  }

  // ===== 步骤 3：将约束追加到对应章节末尾 =====
  for (const category of parsed.categories) {
    const sectionName = CONSTRAINT_SECTION_MAP[category];
    if (sectionName) {
      appendToSection(skillMdPath, sectionName, constraintText);
      result.writtenSections.push(sectionName);
    }
  }

  // ===== 步骤 4：基于约束类型生成/修改用例 =====
  // 重新解析 SKILL.md 以获取更新后的锚点
  const anchor = parseSkillMd(skillMdPath);

  // 读取当前用例
  let currentCases: TestCase[] = [];
  if (fs.existsSync(csvPath)) {
    currentCases = readCasesFromCsv(csvPath);
  }

  let addedCount = 0;
  let modifiedCount = 0;

  for (const category of parsed.categories) {
    switch (category) {
      case 'positive-trigger':
        // 正向触发 → 新增隐式调用用例
        const implicitCases = generateCasesForPositiveTrigger(
          anchor,
          constraintText,
          currentCases
        );
        currentCases = [...currentCases, ...implicitCases];
        addedCount += implicitCases.length;
        break;

      case 'negative-prohibition':
        // 负向禁止 → 新增负例控制用例
        const negativeCases = generateCasesForNegativeProhibition(
          anchor,
          constraintText,
          currentCases
        );
        currentCases = [...currentCases, ...negativeCases];
        addedCount += negativeCases.length;
        break;

      case 'success-criteria':
        // 成功标准 → 更新所有正向用例 pass_criteria
        const successResult = updatePositiveCaseCriteria(
          currentCases,
          constraintText,
          category
        );
        currentCases = successResult.updatedCases;
        modifiedCount += successResult.modifiedCount;
        break;

      case 'execution-flow':
        // 执行流程 → 更新相关用例 pass_criteria
        const flowResult = updatePositiveCaseCriteria(
          currentCases,
          constraintText,
          category
        );
        currentCases = flowResult.updatedCases;
        modifiedCount += flowResult.modifiedCount;
        break;

      case 'style-norm':
        // 风格规范 → 更新相关用例 pass_criteria
        const styleResult = updatePositiveCaseCriteria(
          currentCases,
          constraintText,
          category
        );
        currentCases = styleResult.updatedCases;
        modifiedCount += styleResult.modifiedCount;
        break;
    }
  }

  result.addedCaseCount = addedCount;
  result.modifiedCaseCount = modifiedCount;

  // ===== 步骤 5：写入 CSV =====
  writeCasesToCsv(csvPath, currentCases);

  // ===== 步骤 6：更新快照 =====
  const caseHashes: Record<string, string> = {};
  for (const testCase of currentCases) {
    // 仅记录非 custom 用例的哈希
    if (!testCase.custom) {
      const hash = createHash('sha256')
        .update(testCase.prompt + testCase.pass_criteria, 'utf-8')
        .digest('hex');
      caseHashes[testCase.id] = hash;
    }
  }

  generateSnapshot(skillMdPath, evalsDir, caseHashes);
  result.snapshotUpdated = true;

  // ===== 步骤 7：终端输出约束落地结果 =====
  console.log('[eval-sync] 约束落地完成');
  console.log(`  写入章节: ${result.writtenSections.join(', ')}`);
  console.log(`  新增用例: ${result.addedCaseCount} 条`);
  console.log(`  修改用例: ${result.modifiedCaseCount} 条`);
  console.log(`  快照已更新: ${result.snapshotUpdated ? '是' : '否'}`);
  console.log('');
  console.log('提示: 可执行 `quick-skill eval` 验证约束效果');

  return result;
}
