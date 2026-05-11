import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// ===== Mock 模块 =====
// 使用 vi.hoisted 确保 mock 变量在 vi.mock 之前初始化
const { mockScanAllSkillsDetailed, mockSyncSkillCases, mockFindSkillDir } = vi.hoisted(() => ({
  mockScanAllSkillsDetailed: vi.fn(),
  mockSyncSkillCases: vi.fn(),
  mockFindSkillDir: vi.fn(),
}));

vi.mock('../../src/utils/skill-finder.js', () => ({
  scanAllSkillsDetailed: mockScanAllSkillsDetailed,
  findSkillDir: mockFindSkillDir,
}));

vi.mock('../../src/core/sync-engine.js', () => ({
  syncSkillCases: mockSyncSkillCases,
}));

// 在 mock 之后导入被测模块
import { evalSyncAll } from '../../src/cli/commands/eval-sync.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'eval-sync-batch');

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
  snapshotContent?: string // 快照内容，提供时模拟有变更
): string {
  const skillDirPath = path.join(testDir, 'skills', category, name);
  const evalsDir = path.join(skillDirPath, 'evals');
  fs.mkdirSync(evalsDir, { recursive: true });
  fs.writeFileSync(path.join(skillDirPath, 'SKILL.md'), skillMd, 'utf-8');

  if (snapshotContent) {
    fs.writeFileSync(
      path.join(evalsDir, '.skill-snapshot.json'),
      snapshotContent,
      'utf-8'
    );
  }

  return skillDirPath;
}

// ===== 测试用 SKILL.md 模板 =====

const skillMdA = `---
name: skill-a
description: 技能 A
---

## When to use this

当需要测试时

## When NOT to use this

无

## Definition of done

所有测试通过
`;

const skillMdB = `---
name: skill-b
description: 技能 B
---

## When to use this

当需要构建时

## When NOT to use this

无

## Definition of done

构建成功
`;

// 旧快照内容（模拟有变更）
function oldSnapshot(skillMd: string): string {
  return JSON.stringify({
    content: '旧内容',
    hash: 'old-hash',
    timestamp: new Date().toISOString(),
  });
}

describe('eval-sync --all 批量同步', () => {
  beforeEach(() => {
    cleanup();
    mockScanAllSkillsDetailed.mockReset();
    mockSyncSkillCases.mockReset();
    mockFindSkillDir.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // AC-008-1: 自动扫描所有技能
  // =========================================================================

  describe('AC-008-1: 自动扫描所有技能', () => {
    it('扫描到空列表时提示无技能', async () => {
      mockScanAllSkillsDetailed.mockReturnValue([]);

      const result = await evalSyncAll({});

      expect(result.synced).toBe(0);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });

  // =========================================================================
  // AC-008-2 & AC-008-3: 有变更的执行同步，无变更的跳过
  // =========================================================================

  describe('AC-008-2 & AC-008-3: 变更检测与跳过', () => {
    it('全部无变更时跳过所有技能', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA);
      const dirB = createTestSkill('skill-b', 'core', skillMdB);

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
        { name: 'skill-b', category: 'core', dirPath: dirB, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockImplementation((name: string) => {
        return name === 'skill-a' ? dirA : dirB;
      });
      // 无快照 = 无变更
      mockSyncSkillCases.mockReturnValue({ added: 0, modified: 0, deprecated: 0, conflicts: 0, skipped: [] });

      const result = await evalSyncAll({});

      expect(result.synced).toBe(0);
      expect(result.skipped).toEqual(['skill-a', 'skill-b']);
      expect(result.failed).toEqual([]);
    });

    it('部分有变更时仅同步有变更的技能', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA, oldSnapshot(skillMdA));
      const dirB = createTestSkill('skill-b', 'core', skillMdB);

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
        { name: 'skill-b', category: 'core', dirPath: dirB, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockImplementation((name: string) => {
        return name === 'skill-a' ? dirA : dirB;
      });
      // skill-a 有变更（返回非零结果），skill-b 无变更（返回全零结果）
      mockSyncSkillCases
        .mockReturnValueOnce({ added: 2, modified: 1, deprecated: 0, conflicts: 0, skipped: [] })
        .mockReturnValueOnce({ added: 0, modified: 0, deprecated: 0, conflicts: 0, skipped: [] });

      const result = await evalSyncAll({});

      expect(result.synced).toBe(1);
      expect(result.skipped).toEqual(['skill-b']);
      expect(result.failed).toEqual([]);
      // skill-a 应执行了同步
      expect(mockSyncSkillCases).toHaveBeenCalledWith(dirA);
    });
  });

  // =========================================================================
  // AC-008-4: 汇总输出
  // =========================================================================

  describe('AC-008-4: 汇总输出', () => {
    it('汇总包含已同步、跳过、失败数量', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA, oldSnapshot(skillMdA));
      const dirB = createTestSkill('skill-b', 'core', skillMdB);
      const dirC = createTestSkill('skill-c', 'web', skillMdA, oldSnapshot(skillMdA));

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
        { name: 'skill-b', category: 'core', dirPath: dirB, hasExistingCases: false },
        { name: 'skill-c', category: 'web', dirPath: dirC, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockImplementation((name: string) => {
        if (name === 'skill-a') return dirA;
        if (name === 'skill-b') return dirB;
        return dirC;
      });
      // skill-a 成功，skill-b 无变更跳过，skill-c 失败
      mockSyncSkillCases
        .mockReturnValueOnce({ added: 1, modified: 0, deprecated: 0, conflicts: 0, skipped: [] })
        .mockReturnValueOnce({ added: 0, modified: 0, deprecated: 0, conflicts: 0, skipped: [] })
        .mockImplementation(() => { throw new Error('同步失败：网络错误'); });

      const result = await evalSyncAll({});

      expect(result.synced).toBe(1);
      expect(result.skipped).toEqual(['skill-b']);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].name).toBe('skill-c');
      expect(result.failed[0].error).toContain('网络错误');
    });
  });

  // =========================================================================
  // AC-008-5: 单个失败不阻塞其他
  // =========================================================================

  describe('AC-008-5: 失败隔离', () => {
    it('单个技能失败不阻塞后续技能', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA, oldSnapshot(skillMdA));
      const dirB = createTestSkill('skill-b', 'core', skillMdB, oldSnapshot(skillMdB));
      const dirC = createTestSkill('skill-c', 'web', skillMdA, oldSnapshot(skillMdA));

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
        { name: 'skill-b', category: 'core', dirPath: dirB, hasExistingCases: false },
        { name: 'skill-c', category: 'web', dirPath: dirC, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockImplementation((name: string) => {
        if (name === 'skill-a') return dirA;
        if (name === 'skill-b') return dirB;
        return dirC;
      });
      // 第一个失败，后续应继续执行
      mockSyncSkillCases
        .mockImplementationOnce(() => { throw new Error('skill-a 失败'); })
        .mockReturnValueOnce({ added: 1, modified: 0, deprecated: 0, conflicts: 0, skipped: [] })
        .mockReturnValueOnce({ added: 2, modified: 1, deprecated: 0, conflicts: 0, skipped: [] });

      const result = await evalSyncAll({});

      // 三个技能都应被处理
      expect(mockSyncSkillCases).toHaveBeenCalledTimes(3);
      expect(result.synced).toBe(2);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].name).toBe('skill-a');
    });
  });

  // =========================================================================
  // AC-008-6: 退出码
  // =========================================================================

  describe('AC-008-6: 退出码', () => {
    it('全部成功返回 0', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA, oldSnapshot(skillMdA));

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockReturnValue(dirA);
      mockSyncSkillCases.mockReturnValue({ added: 1, modified: 0, deprecated: 0, conflicts: 0, skipped: [] });

      const result = await evalSyncAll({});

      // 无失败 -> 退出码 0
      expect(result.failed.length).toBe(0);
    });

    it('存在失败返回 1', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA, oldSnapshot(skillMdA));
      const dirB = createTestSkill('skill-b', 'core', skillMdB, oldSnapshot(skillMdB));

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
        { name: 'skill-b', category: 'core', dirPath: dirB, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockImplementation((name: string) => {
        return name === 'skill-a' ? dirA : dirB;
      });
      mockSyncSkillCases
        .mockReturnValueOnce({ added: 1, modified: 0, deprecated: 0, conflicts: 0, skipped: [] })
        .mockImplementationOnce(() => { throw new Error('skill-b 失败'); });

      const result = await evalSyncAll({});

      // 有失败 -> 退出码 1
      expect(result.failed.length).toBeGreaterThan(0);
    });

    it('全部跳过（无变更）返回 0', async () => {
      const dirA = createTestSkill('skill-a', 'core', skillMdA);

      mockScanAllSkillsDetailed.mockReturnValue([
        { name: 'skill-a', category: 'core', dirPath: dirA, hasExistingCases: false },
      ]);
      mockFindSkillDir.mockReturnValue(dirA);
      mockSyncSkillCases.mockReturnValue({ added: 0, modified: 0, deprecated: 0, conflicts: 0, skipped: [] });

      const result = await evalSyncAll({});

      // 无失败 -> 退出码 0
      expect(result.failed.length).toBe(0);
      expect(result.skipped).toEqual(['skill-a']);
    });
  });
});
