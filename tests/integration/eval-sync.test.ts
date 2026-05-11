import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// ===== Mock inquirer 模块 =====
// 使用 vi.hoisted 确保 mock 变量在 vi.mock 之前初始化
const { mockPrompt } = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: mockPrompt,
  },
  prompt: mockPrompt,
}));

// 在 mock 之后导入被测模块
import { evalSyncOverride } from '../../src/cli/commands/eval-sync.js';
import { syncSkillCases } from '../../src/core/sync-engine.js';
import { applyConstraint } from '../../src/core/constraint-applier.js';
import { readCasesFromCsv } from '../../src/io/csv-reader.js';
import { readSnapshot } from '../../src/io/snapshot-manager.js';
import { generateSnapshot } from '../../src/io/snapshot-manager.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'eval-sync');
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
  existingCases?: string // CSV 内容，可选
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
test-skill-custom-2,true,另一个自定义场景,另一个自定义标准,true,false
`;

describe('eval-sync 命令 — 集成测试', () => {
  beforeEach(() => {
    cleanup();
    // 默认 mock inquirer 为确认
    mockPrompt.mockResolvedValue({ confirmed: true });
  });

  afterEach(() => {
    cleanup();
    mockPrompt.mockReset();
  });

  // =========================================================================
  // 增量同步模式（默认模式）
  // =========================================================================

  describe('增量同步模式（默认）', () => {
    it('AC-002-1: 无变更时直接返回，不修改任何文件', () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      // 生成快照（无变更）
      generateSnapshot(path.join(skillDir, 'SKILL.md'), evalsDir);

      const csvPath = path.join(evalsDir, 'test-cases.csv');
      const originalCsv = fs.readFileSync(csvPath, 'utf-8');

      const result = syncSkillCases(skillDir);

      // 无变更时不应修改文件
      expect(fs.readFileSync(csvPath, 'utf-8')).toBe(originalCsv);
      expect(result.added).toBe(0);
      expect(result.modified).toBe(0);
    });

    it('AC-002-1: 有变更时完成增量同步', () => {
      const skillDir = createTestSkill('test-skill', 'core', modifiedSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      // 生成快照（使用旧内容模拟变更）
      generateSnapshot(path.join(skillDir, 'SKILL.md'), evalsDir);
      // 覆盖快照为旧内容
      const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
      snapshot.content = baseSkillMd;
      snapshot.hash = createHash('sha256').update(baseSkillMd, 'utf-8').digest('hex');
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

      const result = syncSkillCases(skillDir);

      // 应有变更处理
      expect(result.added + result.modified).toBeGreaterThan(0);
      // CSV 文件应被更新
      const cases = readCasesFromCsv(path.join(evalsDir, 'test-cases.csv'));
      expect(cases.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 全量覆盖模式（--override）
  // =========================================================================

  describe('全量覆盖模式（--override）', () => {
    // ===== AC-007-1: 全量重新生成用例 =====

    it('AC-007-1: 执行 --override 时全量重新生成用例', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      const originalCases = readCasesFromCsv(csvPath);
      const originalCount = originalCases.length;

      await evalSyncOverride('test-skill', skillDir);

      const newCases = readCasesFromCsv(csvPath);
      // 用例应被重新生成（数量可能不同）
      expect(newCases.length).toBeGreaterThan(0);

      // 验证四种类型的用例都存在
      const explicitCases = newCases.filter((c) => c.id.includes('-explicit-'));
      const implicitCases = newCases.filter((c) => c.id.includes('-implicit-'));
      const contextCases = newCases.filter((c) => c.id.includes('-context-'));
      const negativeCases = newCases.filter((c) => c.id.includes('-negative-'));

      expect(explicitCases.length).toBeGreaterThan(0);
      expect(implicitCases.length).toBeGreaterThan(0);
      expect(contextCases.length).toBeGreaterThan(0);
      expect(negativeCases.length).toBeGreaterThan(0);

      // 所有系统生成的用例 custom=false
      const systemCases = newCases.filter((c) => !c.custom);
      for (const c of systemCases) {
        expect(c.custom).toBe(false);
      }
    });

    // ===== AC-007-2: 覆盖前自动备份到 ./evals/.backup/ =====

    it('AC-007-2: 覆盖前自动备份到 ./evals/.backup/', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const backupDir = path.join(evalsDir, '.backup');

      // 覆盖前备份目录不存在
      expect(fs.existsSync(backupDir)).toBe(false);

      await evalSyncOverride('test-skill', skillDir);

      // 覆盖后备份目录应存在
      expect(fs.existsSync(backupDir)).toBe(true);

      // 备份文件应存在
      const backupFiles = fs.readdirSync(backupDir);
      const csvBackups = backupFiles.filter((f) => f.includes('test-cases') && f.endsWith('.bak.csv'));
      expect(csvBackups.length).toBeGreaterThan(0);

      // 备份内容应与原 CSV 一致（覆盖前的版本）
      const backupContent = fs.readFileSync(path.join(backupDir, csvBackups[0]), 'utf-8');
      expect(backupContent).toBe(existingCasesCsv);
    });

    it('AC-007-2: 无已有用例时不创建备份', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
      const evalsDir = path.join(skillDir, 'evals');
      const backupDir = path.join(evalsDir, '.backup');

      await evalSyncOverride('test-skill', skillDir);

      // 无已有用例时不应创建备份
      expect(fs.existsSync(backupDir)).toBe(false);
    });

    // ===== AC-007-3 & AC-007-4: 覆盖前提示用户确认，拒绝时终止 =====

    it('AC-007-3 & AC-007-4: 用户拒绝确认时终止，不修改任何文件', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      const originalCsv = fs.readFileSync(csvPath, 'utf-8');

      // Mock 用户拒绝
      mockPrompt.mockResolvedValue({ confirmed: false });

      // 由于 process.exit 会被调用，我们需要捕获它
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      try {
        await evalSyncOverride('test-skill', skillDir);
      } catch {
        // 忽略可能的 exit 异常
      }

      // 备份文件应存在（备份在确认前执行）
      const backupDir = path.join(evalsDir, '.backup');
      expect(fs.existsSync(backupDir)).toBe(true);

      // CSV 内容不应被覆盖
      expect(fs.readFileSync(csvPath, 'utf-8')).toBe(originalCsv);

      exitSpy.mockRestore();
    });

    it('AC-007-4: 用户确认时继续执行覆盖', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      // Mock 用户确认
      mockPrompt.mockResolvedValue({ confirmed: true });

      await evalSyncOverride('test-skill', skillDir);

      // CSV 应被覆盖
      const newCases = readCasesFromCsv(csvPath);
      expect(newCases.length).toBeGreaterThan(0);
    });

    // ===== AC-007-5: 覆盖后更新快照 =====

    it('AC-007-5: 覆盖后更新 .skill-snapshot.json', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');

      // 覆盖前无快照
      expect(fs.existsSync(snapshotPath)).toBe(false);

      await evalSyncOverride('test-skill', skillDir);

      // 覆盖后快照应存在
      expect(fs.existsSync(snapshotPath)).toBe(true);

      const snapshot = readSnapshot(snapshotPath);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.hash).not.toBe('');
      expect(snapshot!.content).toBe(baseSkillMd);
    });

    it('AC-007-5: 覆盖后快照哈希与当前 SKILL.md 一致', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
      const evalsDir = path.join(skillDir, 'evals');

      await evalSyncOverride('test-skill', skillDir);

      const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');
      const snapshot = readSnapshot(snapshotPath);

      // 快照哈希应与当前 SKILL.md 一致
      const currentContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
      const expectedHash = createHash('sha256').update(currentContent, 'utf-8').digest('hex');
      expect(snapshot!.hash).toBe(expectedHash);
    });

    // ===== AC-007-6: 覆盖后恢复 custom=true 用例 =====

    it('AC-007-6: 覆盖后恢复 custom=true 用例', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, casesWithCustomCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      // 覆盖前应有 2 条 custom 用例
      const originalCases = readCasesFromCsv(csvPath);
      const originalCustomCases = originalCases.filter((c) => c.custom);
      expect(originalCustomCases.length).toBe(2);

      await evalSyncOverride('test-skill', skillDir);

      // 覆盖后应包含自定义用例
      const newCases = readCasesFromCsv(csvPath);
      const restoredCustomCases = newCases.filter((c) => c.custom);

      expect(restoredCustomCases.length).toBe(2);
      expect(restoredCustomCases.map((c) => c.id)).toContain('test-skill-custom-1');
      expect(restoredCustomCases.map((c) => c.id)).toContain('test-skill-custom-2');

      // 自定义用例的内容应保持不变
      const custom1 = restoredCustomCases.find((c) => c.id === 'test-skill-custom-1');
      expect(custom1!.prompt).toBe('我的自定义测试场景');
      expect(custom1!.pass_criteria).toBe('自定义验收标准');
    });

    it('AC-007-6: 无 custom 用例时正常覆盖', async () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, existingCasesCsv);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      // 覆盖前无 custom 用例
      const originalCases = readCasesFromCsv(csvPath);
      expect(originalCases.filter((c) => c.custom).length).toBe(0);

      await evalSyncOverride('test-skill', skillDir);

      // 覆盖后仍无 custom 用例（因为没有可恢复的）
      const newCases = readCasesFromCsv(csvPath);
      expect(newCases.filter((c) => c.custom).length).toBe(0);
    });

    // ===== 端到端：完整覆盖流程 =====

    it('端到端：完整覆盖流程', async () => {
      // 1. 创建 Skill 并生成初始用例
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      // 首次生成
      syncSkillCases(skillDir);
      const initialCases = readCasesFromCsv(csvPath);
      const initialCount = initialCases.length;

      // 2. 添加自定义用例
      const casesWithCustom = [...initialCases, {
        id: 'test-skill-custom-end2end',
        should_trigger: true,
        prompt: '端到端自定义测试',
        pass_criteria: '端到端自定义标准',
        custom: true,
        deprecated: false,
      }];
      // 手动写入 CSV（简单方式）
      const csvContent = `id,should_trigger,prompt,pass_criteria,custom,deprecated
${casesWithCustom.map((c) => `${c.id},${c.should_trigger},"${c.prompt}","${c.pass_criteria}",${c.custom},${c.deprecated}`).join('\n')}
`;
      fs.writeFileSync(csvPath, csvContent, 'utf-8');

      // 3. 修改 SKILL.md
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), modifiedSkillMd, 'utf-8');

      // 4. 执行覆盖
      await evalSyncOverride('test-skill', skillDir);

      // 5. 验证
      const finalCases = readCasesFromCsv(csvPath);

      // 用例应被重新生成
      expect(finalCases.length).toBeGreaterThan(0);

      // 自定义用例应被恢复
      const customCase = finalCases.find((c) => c.id === 'test-skill-custom-end2end');
      expect(customCase).toBeDefined();
      expect(customCase!.prompt).toBe('端到端自定义测试');
      expect(customCase!.custom).toBe(true);

      // 快照应更新为新的 SKILL.md
      const snapshot = readSnapshot(path.join(evalsDir, '.skill-snapshot.json'));
      const expectedHash = createHash('sha256').update(modifiedSkillMd, 'utf-8').digest('hex');
      expect(snapshot!.hash).toBe(expectedHash);

      // 备份应存在
      const backupDir = path.join(evalsDir, '.backup');
      expect(fs.existsSync(backupDir)).toBe(true);
    });
  });

  // =========================================================================
  // 约束驱动模式（--constraint）
  // =========================================================================

  describe('约束驱动模式（--constraint）', () => {
    it('正向触发约束：追加到 When to use this 并新增隐式用例', () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');

      const result = applyConstraint(skillDir, '当用户需要执行代码审查时可使用此技能');

      // 应写入 When to use this 章节
      expect(result.writtenSections).toContain('When to use this');
      // 应新增用例
      expect(result.addedCaseCount).toBeGreaterThanOrEqual(1);
      // 快照应更新
      expect(result.snapshotUpdated).toBe(true);

      // 验证 SKILL.md 已追加约束
      const skillMdContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
      expect(skillMdContent).toContain('当用户需要执行代码审查时可使用此技能');

      // 验证用例已新增
      const cases = readCasesFromCsv(csvPath);
      expect(cases.length).toBeGreaterThan(0);
    });

    it('负向禁止约束：追加到 When NOT to use this 并新增负例用例', () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
      const evalsDir = path.join(skillDir, 'evals');

      const result = applyConstraint(skillDir, '禁止在处理敏感数据时使用此技能');

      // 应写入 When NOT to use this 章节
      expect(result.writtenSections).toContain('When NOT to use this');
      // 应新增用例
      expect(result.addedCaseCount).toBeGreaterThanOrEqual(1);

      // 验证 SKILL.md 已追加约束
      const skillMdContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
      expect(skillMdContent).toContain('禁止在处理敏感数据时使用此技能');
    });

    it('成功标准约束：追加到 Definition of done 并修改正向用例', () => {
      // 先创建一些正向用例
      const casesCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-skill-explicit-1,true,$test-skill,原有标准,false,false
test-skill-explicit-2,true,$test-skill 测试,原有标准,false,false
`;
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd, casesCsv);
      const evalsDir = path.join(skillDir, 'evals');

      const result = applyConstraint(skillDir, '确保所有代码通过测试');

      // 应写入 Definition of done 章节
      expect(result.writtenSections).toContain('Definition of done');
      // 应修改用例
      expect(result.modifiedCaseCount).toBeGreaterThanOrEqual(1);
    });

    it('无法分类的约束：不修改任何文件', () => {
      const skillDir = createTestSkill('test-skill', 'core', baseSkillMd);
      const evalsDir = path.join(skillDir, 'evals');
      const csvPath = path.join(evalsDir, 'test-cases.csv');
      const snapshotPath = path.join(evalsDir, '.skill-snapshot.json');

      // 模糊约束
      const result = applyConstraint(skillDir, '随便做点什么');

      // 不应写入任何章节
      expect(result.writtenSections.length).toBe(0);
      expect(result.addedCaseCount).toBe(0);
      expect(result.modifiedCaseCount).toBe(0);
      expect(result.snapshotUpdated).toBe(false);

      // CSV 不应存在（因为没有用例被创建）
      expect(fs.existsSync(csvPath)).toBe(false);
    });
  });

  // =========================================================================
  // 错误处理
  // =========================================================================

  describe('错误处理', () => {
    it('找不到技能时抛出错误', async () => {
      await expect(evalSyncOverride('non-existent-skill')).rejects.toThrow('未找到技能: non-existent-skill');
    });

    it('技能目录缺少 SKILL.md 时抛出错误', async () => {
      // 创建一个没有 SKILL.md 的技能目录
      const skillDirPath = path.join(skillsRoot, 'core', 'broken-skill');
      const evalsDir = path.join(skillDirPath, 'evals');
      fs.mkdirSync(evalsDir, { recursive: true });

      // 传入目录路径直接测试缺少 SKILL.md 的情况
      await expect(evalSyncOverride('broken-skill', skillDirPath)).rejects.toThrow('技能目录下缺少 SKILL.md');
    });
  });
});
