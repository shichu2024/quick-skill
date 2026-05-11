import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import { parseSkillMd } from './skill-parser.js';
import { detectChanges } from './change-detector.js';
import { mapChangesToImpacts } from './impact-mapper.js';
import { detectConflicts, computeContentHash } from './conflict-detector.js';
import { deprecateCases } from './case-deprecator.js';
import {
  generateExplicitCases,
  generateImplicitCases,
} from './explicit-implicit-generator.js';
import { generateContextCases, generateNegativeCases } from './context-negative-generator.js';
import { readCasesFromCsv } from '../io/csv-reader.js';
import { writeCasesToCsv } from '../io/csv-writer.js';
import { readSnapshot, generateSnapshot } from '../io/snapshot-manager.js';
import { backupFile } from '../io/backup.js';
import { TestCase } from '../types/test-case.js';
import { ConflictResolution } from '../types/conflict.js';
import { CaseType, ImpactAction } from '../types/impact.js';

/**
 * 同步选项
 */
export interface SyncOptions {
  /** 跳过冲突用例（不处理冲突，直接跳过） */
  skipConflicts?: boolean;
  /** 冲突解决策略映射，key 为用例 id */
  conflictResolutions?: Map<string, ConflictResolution>;
}

/**
 * 同步结果汇总
 */
export interface SyncResult {
  /** 新增用例数量 */
  added: number;
  /** 修改用例数量 */
  modified: number;
  /** 停用用例数量 */
  deprecated: number;
  /** 冲突用例数量 */
  conflicts: number;
  /** 跳过的用例 id 列表 */
  skipped: string[];
}

/**
 * 增量同步 Skill 用例
 *
 * 流程: 变更检测 -> 影响映射 -> 冲突检测 -> 用例调整 -> 备份 -> CSV 写入 -> 快照更新
 * 无变更时直接返回，不修改任何文件
 * custom=true 用例始终跳过
 *
 * @param skillDir - Skill 目录路径（包含 SKILL.md 和 evals/ 子目录）
 * @param options - 同步选项
 * @returns 同步结果汇总
 */
export function syncSkillCases(skillDir: string, options: SyncOptions = {}): SyncResult {
  const absoluteSkillDir = path.resolve(skillDir);
  const skillMdPath = path.join(absoluteSkillDir, 'SKILL.md');
  const evalsDir = path.join(absoluteSkillDir, 'evals');
  const csvPath = path.join(evalsDir, 'test-cases.csv');
  const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
  const backupDir = path.join(evalsDir, '.backup');

  // 初始化结果
  const result: SyncResult = {
    added: 0,
    modified: 0,
    deprecated: 0,
    conflicts: 0,
    skipped: [],
  };

  // ===== 步骤 1：解析当前 SKILL.md =====
  const currentAnchor = parseSkillMd(skillMdPath);

  // ===== 步骤 2：读取快照 =====
  const snapshot = readSnapshot(snapshotPath);

  // ===== 步骤 3：变更检测 =====
  const changeResult = detectChanges(currentAnchor, snapshot);

  // 无变更时直接返回，不修改任何文件
  if (!changeResult.hasChanges) {
    console.log('[eval-sync] 无变更，无需同步');
    return result;
  }

  // ===== 步骤 4：影响映射 =====
  const impactResult = mapChangesToImpacts(changeResult.changes);

  // ===== 步骤 5：备份当前 CSV 文件 =====
  if (fs.existsSync(csvPath)) {
    backupFile(csvPath, backupDir);
  }

  // ===== 步骤 6：读取当前用例 =====
  let currentCases: TestCase[] = [];
  if (fs.existsSync(csvPath)) {
    currentCases = readCasesFromCsv(csvPath);
  }

  // ===== 步骤 7：冲突检测 =====
  const originalHashes = new Map<string, string>();
  if (snapshot?.caseHashes) {
    for (const [caseId, hash] of Object.entries(snapshot.caseHashes)) {
      originalHashes.set(caseId, hash);
    }
  }

  const conflictInfos = detectConflicts(currentCases, originalHashes);
  const conflictCaseIds = new Set(
    conflictInfos.filter((c) => c.isConflict).map((c) => c.caseId)
  );
  result.conflicts = conflictCaseIds.size;

  // ===== 步骤 8：处理冲突 =====
  const skippedCaseIds = new Set<string>();

  for (const caseId of conflictCaseIds) {
    const resolution = options.conflictResolutions?.get(caseId);

    if (resolution === 'keep_user') {
      // 保留用户版本：标记为 custom=true 以保护
      const idx = currentCases.findIndex((c) => c.id === caseId);
      if (idx !== -1) {
        currentCases[idx] = { ...currentCases[idx], custom: true };
      }
    } else if (resolution === 'manual_merge') {
      // 手动合并：跳过该用例
      skippedCaseIds.add(caseId);
    } else if (resolution === 'override_system') {
      // 覆盖为系统版本：不做特殊处理，正常更新
    } else if (options.skipConflicts) {
      // 跳过所有冲突
      skippedCaseIds.add(caseId);
    } else {
      // 无解决策略且未设置 skipConflicts：跳过冲突用例
      skippedCaseIds.add(caseId);
    }
  }

  result.skipped = Array.from(skippedCaseIds);

  // ===== 步骤 9：用例停用 =====
  const deprecationResult = deprecateCases(currentCases, impactResult.impacts);
  currentCases = deprecationResult.remainingCases;
  result.deprecated = deprecationResult.deprecatedCaseIds.length;

  // ===== 步骤 10：按动作类型分组影响 =====
  const addImpacts = impactResult.impacts.filter((i) => i.action === 'add');
  const updateImpacts = impactResult.impacts.filter((i) => i.action === 'update');

  // ===== 步骤 11：处理新增用例 =====
  const existingCaseIds = new Set(currentCases.map((c) => c.id));
  const newCases: TestCase[] = [];

  for (const impact of addImpacts) {
    const generated = generateCasesByType(currentAnchor, impact.affectedCaseType);
    for (const newCase of generated) {
      // 仅添加不存在的新用例
      if (!existingCaseIds.has(newCase.id) && !skippedCaseIds.has(newCase.id)) {
        newCases.push(newCase);
        existingCaseIds.add(newCase.id);
        result.added++;
      }
    }
  }

  // ===== 步骤 12：处理更新用例 =====
  const modifiedCaseIds = new Set<string>();

  for (const impact of updateImpacts) {
    const generated = generateCasesByType(currentAnchor, impact.affectedCaseType);
    const generatedIds = new Set(generated.map((c) => c.id));

    // 检查当前是否已有该类型的用例
    const hasExistingOfType = currentCases.some((c) =>
      isCaseType(c.id, impact.affectedCaseType) && !c.custom
    );

    if (!hasExistingOfType) {
      // 无现有用例时，将生成的用例作为新增处理
      for (const newCase of generated) {
        if (!existingCaseIds.has(newCase.id) && !skippedCaseIds.has(newCase.id)) {
          newCases.push(newCase);
          existingCaseIds.add(newCase.id);
          result.added++;
        }
      }
      continue;
    }

    // 替换匹配的非 custom、非冲突、非跳过的现有用例
    currentCases = currentCases.map((existingCase) => {
      // custom 用例始终跳过
      if (existingCase.custom) return existingCase;
      // 冲突且未选择 override_system 的跳过
      if (conflictCaseIds.has(existingCase.id) && !skippedCaseIds.has(existingCase.id)) {
        // 检查是否有 override_system 决议
        const res = options.conflictResolutions?.get(existingCase.id);
        if (res !== 'override_system') return existingCase;
      }
      // 跳过的用例不修改
      if (skippedCaseIds.has(existingCase.id)) return existingCase;
      // 已停用的用例不修改
      if (existingCase.deprecated) return existingCase;
      // 匹配类型且 ID 在新生成列表中则替换
      if (isCaseType(existingCase.id, impact.affectedCaseType) && generatedIds.has(existingCase.id)) {
        const replacement = generated.find((c) => c.id === existingCase.id);
        if (replacement) {
          modifiedCaseIds.add(existingCase.id);
          return replacement;
        }
      }
      return existingCase;
    });
  }

  result.modified = modifiedCaseIds.size;

  // ===== 步骤 13：合并新增用例 =====
  currentCases = [...currentCases, ...newCases];

  // ===== 步骤 14：写入 CSV =====
  writeCasesToCsv(csvPath, currentCases);

  // ===== 步骤 15：计算用例哈希并更新快照 =====
  const caseHashes: Record<string, string> = {};
  for (const testCase of currentCases) {
    // 仅记录非 custom 用例的哈希
    if (!testCase.custom) {
      caseHashes[testCase.id] = computeContentHash(testCase);
    }
  }

  generateSnapshot(skillMdPath, evalsDir, caseHashes);

  // ===== 步骤 16：输出同步结果汇总 =====
  console.log('[eval-sync] 同步完成');
  console.log(`  新增: ${result.added}`);
  console.log(`  修改: ${result.modified}`);
  console.log(`  停用: ${result.deprecated}`);
  console.log(`  冲突: ${result.conflicts}`);
  if (result.skipped.length > 0) {
    console.log(`  跳过: ${result.skipped.join(', ')}`);
  }

  return result;
}

/**
 * 根据用例类型生成对应的用例列表
 */
function generateCasesByType(anchor: ReturnType<typeof parseSkillMd>, caseType: CaseType): TestCase[] {
  switch (caseType) {
    case 'explicit':
      return generateExplicitCases(anchor);
    case 'implicit':
      return generateImplicitCases(anchor);
    case 'context':
      return generateContextCases(anchor);
    case 'negative':
      return generateNegativeCases(anchor);
    default:
      return [];
  }
}

/**
 * 根据用例 id 判断是否匹配指定类型
 */
function isCaseType(caseId: string, caseType: CaseType): boolean {
  return caseId.includes(`-${caseType}-`);
}
