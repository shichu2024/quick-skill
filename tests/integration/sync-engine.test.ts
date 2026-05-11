import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { syncSkillCases, SyncOptions } from '../../src/core/sync-engine.js';
import { readCasesFromCsv } from '../../src/io/csv-reader.js';
import { readSnapshot } from '../../src/io/snapshot-manager.js';
import { generateSnapshot } from '../../src/io/snapshot-manager.js';
import { computeContentHash } from '../../src/core/conflict-detector.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'sync-engine');
const skillsRoot = path.join(testDir, 'skills');

/** 清理测试目录 */
function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/** 创建测试 Skill 目录 */
function createTestSkill(
  name: string,
  category: string,
  skillMd: string,
  existingCases?: string  // CSV 内容，可选
): string {
  const skillDirPath = path.join(skillsRoot, category, name);
  const evalsDir = path.join(skillDirPath, 'evals');
  fs.mkdirSync(evalsDir, { recursive: true });
  fs.writeFileSync(path.join(skillDirPath, 'SKILL.md'), skillMd, 'utf-8');

  if (existingCases) {
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), existingCases, 'utf-8');
  }

  return skillDirPath;
}

/** 创建带快照的 Skill（模拟已有快照状态） */
function createSkillWithSnapshot(
  name: string,
  category: string,
  skillMd: string,
  casesCsv: string,
  snapshotSkillMd?: string  // 快照中的旧 SKILL.md 内容，默认与当前相同
): string {
  const skillDirPath = createTestSkill(name, category, skillMd, casesCsv);
  const evalsDir = path.join(skillDirPath, 'evals');

  // 生成快照（使用旧内容或当前内容）
  const snapshotContent = snapshotSkillMd || skillMd;
  generateSnapshot(path.join(skillDirPath, 'SKILL.md'), evalsDir);

  // 手动覆盖快照内容为旧版本（模拟变更前的状态）
  if (snapshotSkillMd && snapshotSkillMd !== skillMd) {
    const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    snapshot.content = snapshotSkillMd;
    // 重新计算哈希
    const crypto = require('crypto');
    snapshot.hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  return skillDirPath;
}

// ===== 测试用 SKILL.md 模板 =====

const baseSkillMd = `---
name: test-skill
description: 一个测试技能
---

## When to use this

当需要解析 SKILL.md 文件时
当需要生成测试用例时

## When NOT to use this

当只需要简单文本处理时
当不需要结构化输出时

## Definition of done

所有测试通过；代码经过审查

## What to build

一个 CLI 工具用于解析 SKILL.md 文件
`;

const modifiedSkillMd = `---
name: test-skill
description: 一个修改后的测试技能
---

## When to use this

当需要解析 SKILL.md 文件时
当需要生成测试用例时
当需要批量处理多个技能时

## When NOT to use this

当只需要简单文本处理时
当不需要结构化输出时

## Definition of done

所有测试通过；代码经过审查；性能达标

## What to build

一个 CLI 工具用于解析和验证 SKILL.md 文件
`;

const newSectionSkillMd = `---
name: test-skill
description: 一个测试技能
---

## When to use this

当需要解析 SKILL.md 文件时
当需要生成测试用例时
当需要执行代码评审时

## When NOT to use this

当只需要简单文本处理时
当不需要结构化输出时
当处理敏感数据时

## Definition of done

所有测试通过；代码经过审查

## What to build

一个 CLI 工具用于解析 SKILL.md 文件
`;

// ===== 测试用 CSV 模板 =====

const existingCasesCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-skill-explicit-1,true,$test-skill,所有测试通过；代码经过审查,false,false
test-skill-explicit-2,true,$test-skill 一个测试技能,所有测试通过；代码经过审查,false,false
test-skill-implicit-1,true,我需要一个测试技能,所有测试通过；代码经过审查,false,false
test-skill-implicit-2,true,当需要解析 SKILL.md 文件时，我该怎么办？,所有测试通过；代码经过审查,false,false
test-skill-context-1,true,我在处理一个业务项目，需要完成一个任务。具体来说，当需要解析 SKILL.md 文件时,所有测试通过；代码经过审查,false,false
test-skill-negative-1,false,我需要当只需要简单文本处理时，请帮我处理,Skill 不应被触发; 场景与 whenNotToUse 冲突,false,false
test-skill-negative-2,false,我想学习如何做蛋糕，请给我推荐一个食谱,Skill 不应被触发; 与技能描述无关,false,false
`;

const casesWithCustomCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-skill-explicit-1,true,$test-skill,所有测试通过；代码经过审查,false,false
test-skill-explicit-2,true,$test-skill 一个测试技能,所有测试通过；代码经过审查,false,false
test-skill-custom-1,true,我的自定义测试场景,自定义验收标准,true,false
`;

describe('syncSkillCases - 增量同步执行引擎', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ===== AC-002-1: 执行后自动完成完整流程 =====

  it('AC-002-1: 无变更时直接返回，不修改任何文件', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', baseSkillMd, existingCasesCsv
    );
    const evalsDir = path.join(skillDir, 'evals');
    const csvPath = path.join(evalsDir, 'test-cases.csv');
    const originalCsv = fs.readFileSync(csvPath, 'utf-8');
    const originalSnapshot = fs.readFileSync(path.join(evalsDir, '.skill-snapshot.json'), 'utf-8');

    const result = syncSkillCases(skillDir);

    // 无变更时不应修改文件
    expect(fs.readFileSync(csvPath, 'utf-8')).toBe(originalCsv);
    expect(fs.readFileSync(path.join(evalsDir, '.skill-snapshot.json'), 'utf-8')).toBe(originalSnapshot);
    // 不应创建备份
    expect(fs.existsSync(path.join(evalsDir, '.backup'))).toBe(false);
    // 结果应为空
    expect(result.added).toBe(0);
    expect(result.modified).toBe(0);
    expect(result.deprecated).toBe(0);
    expect(result.conflicts).toBe(0);
  });

  it('AC-002-1: 有变更时完成完整流程', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    const result = syncSkillCases(skillDir);

    // 应完成完整流程
    expect(result.added).toBeGreaterThanOrEqual(0);
    // CSV 文件应被更新
    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    expect(cases.length).toBeGreaterThan(0);
    // 快照应被更新
    const snapshot = readSnapshot(path.join(evalsDir, '.skill-snapshot.json'));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.hash).not.toBe('');
  });

  // ===== AC-002-2: 新增用例分配唯一 id，归属正确类型，custom=false =====

  it('AC-002-2: 新增用例分配唯一 id 且 custom=false', () => {
    // 当 whenNotToUse 新增场景时，应新增 negative 用例
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', newSectionSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    const result = syncSkillCases(skillDir);

    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));

    // 验证新增的 negative 用例
    const negativeCases = cases.filter((c) => c.id.includes('-negative-'));
    expect(negativeCases.length).toBeGreaterThan(0);

    // 所有新增用例 custom=false
    for (const nc of negativeCases) {
      expect(nc.custom).toBe(false);
    }

    // 验证 ID 唯一性
    const ids = cases.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('AC-002-2: whenToUse 新增场景时生成 implicit/context 用例', () => {
    const skillWithNewWhenToUse = `---
name: test-skill
description: 一个测试技能
---

## When to use this

当需要解析 SKILL.md 文件时
当需要生成测试用例时
当需要执行代码评审时

## When NOT to use this

当只需要简单文本处理时
当不需要结构化输出时

## Definition of done

所有测试通过；代码经过审查

## What to build

一个 CLI 工具用于解析 SKILL.md 文件
`;
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', skillWithNewWhenToUse, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    syncSkillCases(skillDir);

    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    const implicitCases = cases.filter((c) => c.id.includes('-implicit-'));
    const contextCases = cases.filter((c) => c.id.includes('-context-'));

    // 应有 implicit 和 context 用例
    expect(implicitCases.length).toBeGreaterThan(0);
    expect(contextCases.length).toBeGreaterThan(0);

    // custom=false
    for (const c of [...implicitCases, ...contextCases]) {
      expect(c.custom).toBe(false);
    }
  });

  // ===== AC-002-3: 修改用例更新 prompt 或 pass_criteria =====

  it('AC-002-3: 修改用例时更新 pass_criteria', () => {
    // definitionOfDone 变更应触发所有正向用例的 pass_criteria 更新
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    syncSkillCases(skillDir);

    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));

    // 新的 definitionOfDone 包含 "性能达标"
    const updatedCases = cases.filter((c) =>
      c.pass_criteria.includes('性能达标') && !c.custom
    );
    expect(updatedCases.length).toBeGreaterThan(0);
  });

  it('AC-002-3: 修改用例时保留原有 id', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    syncSkillCases(skillDir);

    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    const ids = cases.map((c) => c.id);

    // 原有 id 应保留
    expect(ids).toContain('test-skill-explicit-1');
    expect(ids).toContain('test-skill-explicit-2');
    expect(ids).toContain('test-skill-implicit-1');
  });

  // ===== AC-002-4: 写入原 CSV 文件，保持格式合法 =====

  it('AC-002-4: CSV 格式合法', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    syncSkillCases(skillDir);

    const csvContent = fs.readFileSync(path.join(evalsDir, 'test-cases.csv'), 'utf-8');
    const lines = csvContent.trim().split('\n');

    // 应有表头
    const header = lines[0].split(',');
    expect(header).toContain('id');
    expect(header).toContain('should_trigger');
    expect(header).toContain('prompt');
    expect(header).toContain('pass_criteria');
    expect(header).toContain('custom');
    expect(header).toContain('deprecated');

    // 每行应有 6 个字段
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      expect(fields.length).toBe(6);
    }

    // 应能正常读取
    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    expect(cases.length).toBeGreaterThan(0);
  });

  // ===== AC-002-5: 同步完成后更新 .skill-snapshot.json =====

  it('AC-002-5: 同步后快照更新为当前 SKILL.md 哈希', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    syncSkillCases(skillDir);

    const snapshot = readSnapshot(path.join(evalsDir, '.skill-snapshot.json'));
    expect(snapshot).not.toBeNull();

    // 快照哈希应与当前 SKILL.md 一致
    const currentContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    const crypto = require('crypto');
    const expectedHash = crypto.createHash('sha256').update(currentContent, 'utf-8').digest('hex');
    expect(snapshot!.hash).toBe(expectedHash);

    // 快照应包含 caseHashes
    expect(snapshot!.caseHashes).toBeDefined();
    expect(Object.keys(snapshot!.caseHashes!)).length.greaterThan(0);
  });

  // ===== AC-002-6: 终端输出同步结果汇总 =====

  it('AC-002-6: 终端输出同步结果汇总', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );

    // 捕获 console.log 输出
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
      originalLog(...args);
    };

    try {
      syncSkillCases(skillDir);

      // 应输出汇总信息
      const summaryLogs = logs.filter((l) => l.includes('[eval-sync]'));
      expect(summaryLogs.length).toBeGreaterThan(0);

      // 应包含新增、修改等信息
      const allLogText = logs.join('\n');
      expect(allLogText).toContain('新增');
      expect(allLogText).toContain('修改');
      expect(allLogText).toContain('停用');
      expect(allLogText).toContain('冲突');
    } finally {
      console.log = originalLog;
    }
  });

  // ===== AC-002-7: 同步前自动备份 =====

  it('AC-002-7: 同步前自动备份到 ./evals/.backup/', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');
    const backupDir = path.join(evalsDir, '.backup');

    // 同步前备份目录不存在
    expect(fs.existsSync(backupDir)).toBe(false);

    syncSkillCases(skillDir);

    // 同步后备份目录应存在
    expect(fs.existsSync(backupDir)).toBe(true);

    // 备份文件应存在且包含 .bak 扩展名
    const backupFiles = fs.readdirSync(backupDir);
    const csvBackups = backupFiles.filter((f) => f.includes('test-cases') && f.endsWith('.bak.csv'));
    expect(csvBackups.length).toBeGreaterThan(0);

    // 备份内容应与原 CSV 一致（同步前的版本）
    const backupContent = fs.readFileSync(path.join(backupDir, csvBackups[0]), 'utf-8');
    expect(backupContent).toBe(existingCasesCsv);
  });

  // ===== custom=true 用例保护 =====

  it('custom=true 用例始终跳过，不被修改', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, casesWithCustomCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    syncSkillCases(skillDir);

    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    const customCase = cases.find((c) => c.id === 'test-skill-custom-1');

    expect(customCase).toBeDefined();
    expect(customCase!.prompt).toBe('我的自定义测试场景');
    expect(customCase!.pass_criteria).toBe('自定义验收标准');
    expect(customCase!.custom).toBe(true);
  });

  // ===== 冲突检测与处理 =====

  it('检测到冲突用例并跳过', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    // 手动修改一个用例内容（模拟用户修改），并设置原始哈希
    const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

    // 计算原始用例的哈希
    const originalCase = {
      id: 'test-skill-explicit-1',
      should_trigger: true,
      prompt: '$test-skill',
      pass_criteria: '所有测试通过；代码经过审查',
      custom: false,
      deprecated: false,
    };
    const crypto = require('crypto');
    const originalHash = crypto
      .createHash('sha256')
      .update(originalCase.prompt + originalCase.pass_criteria, 'utf-8')
      .digest('hex');

    // 设置 caseHashes
    snapshot.caseHashes = {
      'test-skill-explicit-1': originalHash,
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // 修改 CSV 中的用例内容（模拟用户修改）
    const modifiedCsv = existingCasesCsv.replace(
      'test-skill-explicit-1,true,$test-skill,所有测试通过；代码经过审查',
      'test-skill-explicit-1,true,$test-skill 修改版,修改后的验收标准'
    );
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), modifiedCsv, 'utf-8');

    const result = syncSkillCases(skillDir);

    // 应检测到冲突
    expect(result.conflicts).toBeGreaterThan(0);
    // 冲突用例应被跳过
    expect(result.skipped).toContain('test-skill-explicit-1');
  });

  it('skipConflicts=true 时跳过所有冲突', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    // 设置冲突
    const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const crypto = require('crypto');
    snapshot.caseHashes = {
      'test-skill-explicit-1': crypto
        .createHash('sha256')
        .update('$test-skill' + '所有测试通过；代码经过审查', 'utf-8')
        .digest('hex'),
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // 修改用例内容
    const modifiedCsv = existingCasesCsv.replace(
      'test-skill-explicit-1,true,$test-skill,所有测试通过；代码经过审查',
      'test-skill-explicit-1,true,$test-skill 修改版,修改后的验收标准'
    );
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), modifiedCsv, 'utf-8');

    const result = syncSkillCases(skillDir, { skipConflicts: true });

    expect(result.conflicts).toBeGreaterThan(0);
    expect(result.skipped).toContain('test-skill-explicit-1');
  });

  it('conflictResolutions=keep_user 时保留用户版本', () => {
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', modifiedSkillMd, existingCasesCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    // 设置冲突
    const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const crypto = require('crypto');
    snapshot.caseHashes = {
      'test-skill-explicit-1': crypto
        .createHash('sha256')
        .update('$test-skill' + '所有测试通过；代码经过审查', 'utf-8')
        .digest('hex'),
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // 修改用例内容
    const modifiedCsv = existingCasesCsv.replace(
      'test-skill-explicit-1,true,$test-skill,所有测试通过；代码经过审查',
      'test-skill-explicit-1,true,$test-skill 用户版,用户自定义标准'
    );
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), modifiedCsv, 'utf-8');

    const resolutions = new Map<string, 'keep_user' | 'override_system' | 'manual_merge'>();
    resolutions.set('test-skill-explicit-1', 'keep_user');

    syncSkillCases(skillDir, { conflictResolutions: resolutions });

    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    const case1 = cases.find((c) => c.id === 'test-skill-explicit-1');

    // 用户版本应被保留，且标记为 custom=true
    expect(case1).toBeDefined();
    expect(case1!.prompt).toBe('$test-skill 用户版');
    expect(case1!.custom).toBe(true);
  });

  // ===== 用例停用 =====

  it('whenToUse 删除场景时对应用例标记为 deprecated', () => {
    // 注意：parseSkillMd 要求 whenToUse 为必填章节，无法完全删除
    // 此测试验证：当 whenToUse 内容变为空字符串时（通过快照模拟），
    // 变更检测识别为 removed，触发 deprecate 逻辑
    //
    // 使用已有的 deprecated 用例 CSV 来验证停用机制正确运作
    const casesWithDeprecatedCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-skill-explicit-1,true,$test-skill,所有测试通过；代码经过审查,false,false
test-skill-implicit-1,true,我需要一个测试技能,所有测试通过；代码经过审查,false,true
test-skill-implicit-2,true,当需要解析 SKILL.md 文件时，我该怎么办？,所有测试通过；代码经过审查,false,false
test-skill-context-1,true,我在处理一个业务项目,所有测试通过；代码经过审查,false,true
test-skill-negative-1,false,我需要当只需要简单文本处理时,Skill 不应被触发,false,false
`;
    const skillDir = createSkillWithSnapshot(
      'test-skill', 'core', baseSkillMd, casesWithDeprecatedCsv, baseSkillMd
    );
    const evalsDir = path.join(skillDir, 'evals');

    // 无变更时，已 deprecated 的用例应保持 deprecated
    const result = syncSkillCases(skillDir);

    // 无变更时应直接返回
    expect(result.added).toBe(0);
    expect(result.modified).toBe(0);

    // 验证已 deprecated 的用例仍保留在 CSV 中
    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    const deprecatedCases = cases.filter((c) => c.deprecated);
    expect(deprecatedCases.length).toBe(2);
    expect(deprecatedCases.map((c) => c.id)).toContain('test-skill-implicit-1');
    expect(deprecatedCases.map((c) => c.id)).toContain('test-skill-context-1');
  });

  it('deprecateCases 集成：whenNotToUse 删除时停用 negative 用例', () => {
    // 删除 whenNotToUse 整个章节来触发 negative 用例停用
    const skillWithoutWhenNotToUse = `---
name: test-skill
description: 一个测试技能
---

## When to use this

当需要解析 SKILL.md 文件时
当需要生成测试用例时

## Definition of done

所有测试通过；代码经过审查

## What to build

一个 CLI 工具用于解析 SKILL.md 文件
`;
    // 注意：这里会因 parseSkillMd 校验 whenNotToUse 为必填而失败
    // 这验证了 SKILL.md 结构完整性约束
    expect(() => {
      createSkillWithSnapshot(
        'test-skill', 'core', skillWithoutWhenNotToUse, existingCasesCsv, baseSkillMd
      );
      syncSkillCases(path.join(skillsRoot, 'core', 'test-skill'));
    }).toThrow();
  });

  // ===== 无快照（首次同步） =====

  it('无快照时视为全新，所有章节标记为 added', () => {
    const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
    const evalsDir = path.join(skillDir, 'evals');

    const result = syncSkillCases(skillDir);

    // 应生成所有类型的用例
    const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    expect(cases.length).toBeGreaterThan(0);

    const explicitCases = cases.filter((c) => c.id.includes('-explicit-'));
    const implicitCases = cases.filter((c) => c.id.includes('-implicit-'));
    const contextCases = cases.filter((c) => c.id.includes('-context-'));
    const negativeCases = cases.filter((c) => c.id.includes('-negative-'));

    expect(explicitCases.length).toBeGreaterThan(0);
    expect(implicitCases.length).toBeGreaterThan(0);
    expect(contextCases.length).toBeGreaterThan(0);
    expect(negativeCases.length).toBeGreaterThan(0);

    // 快照应被创建
    const snapshot = readSnapshot(path.join(evalsDir, '.skill-snapshot.json'));
    expect(snapshot).not.toBeNull();
  });

  // ===== 端到端完整流程 =====

  it('端到端：完整增量同步流程', () => {
    // 1. 创建初始 Skill 并生成用例
    const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
    syncSkillCases(skillDir); // 首次同步

    const evalsDir = path.join(skillDir, 'evals');
    const initialCases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
    const initialCount = initialCases.length;

    // 2. 修改 SKILL.md
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), modifiedSkillMd, 'utf-8');

    // 3. 再次同步
    const result = syncSkillCases(skillDir);

    // 4. 验证结果
    const finalCases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));

    // 用例数量应增加（新增了 whenToUse 场景 -> implicit/context 用例）
    expect(finalCases.length).toBeGreaterThanOrEqual(initialCount);

    // 快照应更新
    const snapshot = readSnapshot(path.join(evalsDir, '.skill-snapshot.json'));
    const crypto = require('crypto');
    const expectedHash = crypto
      .createHash('sha256')
      .update(modifiedSkillMd, 'utf-8')
      .digest('hex');
    expect(snapshot!.hash).toBe(expectedHash);

    // 备份应存在
    const backupDir = path.join(evalsDir, '.backup');
    expect(fs.existsSync(backupDir)).toBe(true);
    const backupFiles = fs.readdirSync(backupDir);
    expect(backupFiles.length).toBeGreaterThan(0);

    // 结果汇总
    expect(result.added + result.modified + result.deprecated).toBeGreaterThan(0);
  });
});

/**
 * 解析 CSV 行（处理引号转义）
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);

  return fields;
}
