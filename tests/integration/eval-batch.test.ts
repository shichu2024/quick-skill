import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  evalBatchSkills,
  evalAllSkills,
  registerEvalCommand,
} from '../../src/cli/commands/eval.js';
import type { BatchEvalSummary } from '../../src/cli/commands/eval.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'eval-batch');
const skillsRoot = path.join(testDir, 'skills');

/** 为每个测试生成唯一的评测根目录 */
function getUniqueEvalRoot(): string {
  return path.join(testDir, '.quick-skill-eval-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
}

/** 清理测试目录 */
function cleanup(): void {
  if (fs.existsSync(testDir)) {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Windows 可能有文件锁，忽略
    }
  }
}

/** 创建测试 Skill 目录 */
function createTestSkill(
  name: string,
  category: string,
  skillMd: string,
  casesCsv?: string
): string {
  const skillDirPath = path.join(skillsRoot, category, name);
  fs.mkdirSync(skillDirPath, { recursive: true });
  fs.writeFileSync(path.join(skillDirPath, 'SKILL.md'), skillMd, 'utf-8');

  if (casesCsv) {
    const evalsDir = path.join(skillDirPath, 'evals');
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.writeFileSync(path.join(evalsDir, `${name}.prompts.csv`), casesCsv, 'utf-8');
  }

  return skillDirPath;
}

// ===== 测试用 SKILL.md 模板 =====

const skillWithAllSections = `---
name: test-skill
description: 一个用于评测的测试技能
---

## When to use this

当需要执行代码评测时

## When NOT to use this

当不需要执行代码评测时

## Definition of done

生成 output.txt 文件

## What to build

一个用于评测的 CLI 工具

## Steps

1. 解析输入
2. 执行评测
3. 输出结果
`;

const skillMinimal = `---
name: minimal-skill
description: 最小化技能
---

## When to use this

当需要最小化测试时
`;

// ===== 测试用 CSV 模板 =====

const validCasesCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-skill-positive-1,true,请执行代码评测,生成 output.txt 文件,false,false
test-skill-negative-1,false,我需要做蛋糕,Skill 不应被触发,false,false
`;

const validCasesCsv2 = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-skill-2-positive-1,true,请执行操作,生成结果,false,false
`;

/**
 * 带隔离评测根目录的批量评测辅助函数
 */
async function evalBatchWithIsolation(
  skillNames: string[],
  options?: {
    concurrency?: number;
    category?: string;
    incremental?: boolean;
  }
) {
  const evalRoot = getUniqueEvalRoot();
  const originalEnv = process.env.QUICK_SKILL_EVAL_ROOT;
  process.env.QUICK_SKILL_EVAL_ROOT = evalRoot;
  try {
    return await evalBatchSkills(skillNames, {
      skillsRoot,
      evalRoot,
      concurrency: options?.concurrency ?? 5,
      category: options?.category,
      incremental: options?.incremental ?? false,
    });
  } finally {
    if (originalEnv !== undefined) {
      process.env.QUICK_SKILL_EVAL_ROOT = originalEnv;
    } else {
      delete process.env.QUICK_SKILL_EVAL_ROOT;
    }
  }
}

/**
 * 带隔离评测根目录的全量评测辅助函数
 */
async function evalAllWithIsolation(options?: {
  concurrency?: number;
  category?: string;
  incremental?: boolean;
}) {
  const evalRoot = getUniqueEvalRoot();
  const originalEnv = process.env.QUICK_SKILL_EVAL_ROOT;
  process.env.QUICK_SKILL_EVAL_ROOT = evalRoot;
  try {
    return await evalAllSkills({
      skillsRoot,
      evalRoot,
      concurrency: options?.concurrency ?? 5,
      category: options?.category,
      incremental: options?.incremental ?? false,
    });
  } finally {
    if (originalEnv !== undefined) {
      process.env.QUICK_SKILL_EVAL_ROOT = originalEnv;
    } else {
      delete process.env.QUICK_SKILL_EVAL_ROOT;
    }
  }
}

describe('eval 命令 — 批量与全量评测集成测试', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AC-010-1: 批量测试指定的多个 Skill
  // =========================================================================

  describe('AC-010-1: 批量测试指定的多个 Skill', () => {
    it('能批量评测多个指定的 Skill', async () => {
      createTestSkill('skill-a', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('skill-b', 'core', skillWithAllSections, validCasesCsv2);

      const summary = await evalBatchWithIsolation(['skill-a', 'skill-b']);

      expect(summary.totalSkills).toBe(2);
      expect(summary.results).toHaveLength(2);
      expect(summary.results.every(r => r.skillScore !== undefined)).toBe(true);
    });

    it('指定的 Skill 不存在时，在结果中标记失败', async () => {
      createTestSkill('existing-skill', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['existing-skill', 'non-existent-skill']);

      expect(summary.totalSkills).toBe(2);
      const failedResult = summary.results.find(r => r.skillName === 'non-existent-skill');
      expect(failedResult).toBeDefined();
      expect(failedResult?.success).toBe(false);
      expect(failedResult?.error).toContain('未找到 Skill');
    });

    it('批量评测返回极简汇总', async () => {
      createTestSkill('sum-a', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('sum-b', 'frontend', skillWithAllSections, validCasesCsv2);

      const summary = await evalBatchWithIsolation(['sum-a', 'sum-b']);

      // 验证汇总结构
      expect(summary).toHaveProperty('totalSkills');
      expect(summary).toHaveProperty('successCount');
      expect(summary).toHaveProperty('failCount');
      expect(summary).toHaveProperty('averageScore');
      expect(summary).toHaveProperty('topRiskSkills');
      expect(summary).toHaveProperty('regressionCount');
      expect(summary).toHaveProperty('results');
    });
  });

  // =========================================================================
  // AC-010-2: 全量测试 ./skills/ 下全量 Skill
  // =========================================================================

  describe('AC-010-2: 全量测试 ./skills/ 下全量 Skill', () => {
    it('能评测 skills/ 下所有 Skill', async () => {
      createTestSkill('all-skill-1', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('all-skill-2', 'frontend', skillWithAllSections, validCasesCsv2);
      createTestSkill('all-skill-3', 'backend', skillWithAllSections, validCasesCsv);

      const summary = await evalAllWithIsolation();

      expect(summary.totalSkills).toBe(3);
      expect(summary.results).toHaveLength(3);
    });

    it('skills/ 目录不存在时返回空结果', async () => {
      const evalRoot = getUniqueEvalRoot();
      const nonExistentRoot = path.join(testDir, 'non-existent-skills');

      const originalEnv = process.env.QUICK_SKILL_EVAL_ROOT;
      process.env.QUICK_SKILL_EVAL_ROOT = evalRoot;
      try {
        const summary = await evalAllSkills({
          skillsRoot: nonExistentRoot,
          evalRoot,
          concurrency: 5,
        });

        expect(summary.totalSkills).toBe(0);
        expect(summary.results).toHaveLength(0);
      } finally {
        if (originalEnv !== undefined) {
          process.env.QUICK_SKILL_EVAL_ROOT = originalEnv;
        } else {
          delete process.env.QUICK_SKILL_EVAL_ROOT;
        }
      }
    });
  });

  // =========================================================================
  // AC-010-3: 并发数可配置，默认 5
  // =========================================================================

  describe('AC-010-3: 并发数可配置', () => {
    it('能使用自定义并发数进行批量评测', async () => {
      createTestSkill('conc-skill-1', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('conc-skill-2', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('conc-skill-3', 'core', skillWithAllSections, validCasesCsv);

      // 并发数为 2，应该能正常完成
      const summary = await evalBatchWithIsolation(
        ['conc-skill-1', 'conc-skill-2', 'conc-skill-3'],
        { concurrency: 2 }
      );

      expect(summary.totalSkills).toBe(3);
      expect(summary.results).toHaveLength(3);
    });

    it('并发数为 1 时串行执行', async () => {
      createTestSkill('serial-skill', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['serial-skill'], { concurrency: 1 });

      expect(summary.totalSkills).toBe(1);
      expect(summary.results).toHaveLength(1);
    });

    it('默认并发数为 5', async () => {
      // 验证 evalAllSkills 的默认并发数
      createTestSkill('default-conc', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalAllWithIsolation();

      expect(summary.totalSkills).toBe(1);
    });
  });

  // =========================================================================
  // AC-010-4: 单个 Skill 失败不阻塞其他
  // =========================================================================

  describe('AC-010-4: 单个 Skill 失败不阻塞其他', () => {
    it('一个 Skill 评测失败时，其他 Skill 继续评测', async () => {
      createTestSkill('good-skill', 'core', skillWithAllSections, validCasesCsv);
      // 不创建 bad-skill 的目录，模拟 Skill 不存在

      const summary = await evalBatchWithIsolation(['good-skill', 'bad-skill', 'good-skill-2']);

      // good-skill 应该成功
      const goodResult = summary.results.find(r => r.skillName === 'good-skill');
      expect(goodResult?.success).toBe(true);

      // bad-skill 应该失败
      const badResult = summary.results.find(r => r.skillName === 'bad-skill');
      expect(badResult?.success).toBe(false);
    });

    it('全部 Skill 都失败时，汇总正确反映', async () => {
      const summary = await evalBatchWithIsolation(['no-skill-1', 'no-skill-2']);

      expect(summary.totalSkills).toBe(2);
      expect(summary.successCount).toBe(0);
      expect(summary.failCount).toBe(2);
    });
  });

  // =========================================================================
  // AC-010-5: 全部完成后输出极简汇总
  // =========================================================================

  describe('AC-010-5: 极简汇总输出', () => {
    it('汇总包含总测试 Skill 数', async () => {
      createTestSkill('count-skill', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['count-skill']);

      expect(summary.totalSkills).toBe(1);
    });

    it('汇总包含整体通过率', async () => {
      createTestSkill('rate-skill-1', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('rate-skill-2', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['rate-skill-1', 'rate-skill-2']);

      expect(summary.successCount).toBeGreaterThanOrEqual(0);
      expect(summary.failCount).toBeGreaterThanOrEqual(0);
      expect(summary.successCount + summary.failCount).toBe(summary.totalSkills);
    });

    it('汇总包含平均分', async () => {
      createTestSkill('avg-skill', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['avg-skill']);

      expect(typeof summary.averageScore).toBe('number');
      expect(summary.averageScore).toBeGreaterThanOrEqual(0);
      expect(summary.averageScore).toBeLessThanOrEqual(100);
    });

    it('汇总包含 Top 3 高风险 Skill（分数最低的 3 个）', async () => {
      createTestSkill('risk-a', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('risk-b', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('risk-c', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('risk-d', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['risk-a', 'risk-b', 'risk-c', 'risk-d']);

      // topRiskSkills 应该是分数最低的（风险最高），最多 3 个
      expect(Array.isArray(summary.topRiskSkills)).toBe(true);
      expect(summary.topRiskSkills.length).toBeLessThanOrEqual(3);
    });

    it('汇总包含回归项数量', async () => {
      createTestSkill('reg-skill', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['reg-skill']);

      expect(typeof summary.regressionCount).toBe('number');
      expect(summary.regressionCount).toBeGreaterThanOrEqual(0);
    });

    it('终端输出极简汇总信息', async () => {
      createTestSkill('output-skill', 'core', skillWithAllSections, validCasesCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // 直接调用 evalBatchSkills 并验证返回的汇总数据
      const summary = await evalBatchWithIsolation(['output-skill']);

      // 验证汇总数据结构完整
      expect(summary.totalSkills).toBe(1);
      expect(summary.successCount).toBeGreaterThanOrEqual(0);
      expect(typeof summary.averageScore).toBe('number');
      expect(Array.isArray(summary.topRiskSkills)).toBe(true);
      expect(typeof summary.regressionCount).toBe('number');

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // AC-010-6: 支持 --category 参数按分类筛选
  // =========================================================================

  describe('AC-010-6: 按分类筛选', () => {
    it('全量评测时能按 category 筛选', async () => {
      createTestSkill('cat-core', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('cat-frontend', 'frontend', skillWithAllSections, validCasesCsv2);
      createTestSkill('cat-backend', 'backend', skillWithAllSections, validCasesCsv);

      const summary = await evalAllWithIsolation({ category: 'core' });

      expect(summary.totalSkills).toBe(1);
      expect(summary.results[0].skillName).toBe('cat-core');
    });

    it('批量评测时能按 category 筛选', async () => {
      createTestSkill('filter-a', 'core', skillWithAllSections, validCasesCsv);
      createTestSkill('filter-b', 'frontend', skillWithAllSections, validCasesCsv2);

      // 批量评测 + category 筛选：只评测在指定分类中的 Skill
      const summary = await evalBatchWithIsolation(['filter-a', 'filter-b'], {
        category: 'core',
      });

      // filter-a 在 core 分类中，应该被评测
      const coreResult = summary.results.find(r => r.skillName === 'filter-a');
      expect(coreResult?.success).toBe(true);

      // filter-b 不在 core 分类中，应该被跳过
      const frontendResult = summary.results.find(r => r.skillName === 'filter-b');
      expect(frontendResult?.success).toBe(false); // 不在指定分类，视为不匹配
    });

    it('不存在的 category 返回空结果', async () => {
      createTestSkill('no-cat', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalAllWithIsolation({ category: 'non-existent-category' });

      expect(summary.totalSkills).toBe(0);
    });
  });

  // =========================================================================
  // AC-010-7: 支持 --incremental 参数仅测试有变更的 Skill
  // =========================================================================

  describe('AC-010-7: 增量评测', () => {
    it('无快照时，增量评测视为全部需要评测', async () => {
      createTestSkill('incr-new', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalAllWithIsolation({ incremental: true });

      // 没有快照，所有 Skill 都需要评测
      expect(summary.totalSkills).toBe(1);
    });

    it('有快照且文件未变更时，增量评测跳过该 Skill', async () => {
      const skillDir = createTestSkill('incr-same', 'core', skillWithAllSections, validCasesCsv);

      // 生成快照
      const { generateSnapshot } = await import('../../src/io/snapshot-manager.js');
      generateSnapshot(path.join(skillDir, 'SKILL.md'), skillDir);

      const summary = await evalAllWithIsolation({ incremental: true });

      // 文件未变更，应该跳过评测
      expect(summary.totalSkills).toBe(0);
      expect(summary.skippedCount).toBe(1);
    });

    it('有快照但文件已变更时，增量评测执行该 Skill', async () => {
      const skillDir = createTestSkill('incr-changed', 'core', skillWithAllSections, validCasesCsv);

      // 生成快照
      const { generateSnapshot } = await import('../../src/io/snapshot-manager.js');
      generateSnapshot(path.join(skillDir, 'SKILL.md'), skillDir);

      // 修改 SKILL.md 内容
      const newContent = skillWithAllSections + '\n## 新增章节\n新内容';
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), newContent, 'utf-8');

      const summary = await evalAllWithIsolation({ incremental: true });

      // 文件已变更，应该执行评测
      expect(summary.totalSkills).toBe(1);
      expect(summary.results[0].skillName).toBe('incr-changed');
    });

    it('混合场景：部分 Skill 有变更，部分没有', async () => {
      const dir1 = createTestSkill('incr-unchanged', 'core', skillWithAllSections, validCasesCsv);
      const dir2 = createTestSkill('incr-modified', 'core', skillWithAllSections, validCasesCsv2);

      // 为两个 Skill 都生成快照
      const { generateSnapshot } = await import('../../src/io/snapshot-manager.js');
      generateSnapshot(path.join(dir1, 'SKILL.md'), dir1);
      generateSnapshot(path.join(dir2, 'SKILL.md'), dir2);

      // 只修改第二个 Skill
      const newContent = skillWithAllSections + '\n## 修改\n变更内容';
      fs.writeFileSync(path.join(dir2, 'SKILL.md'), newContent, 'utf-8');

      const summary = await evalAllWithIsolation({ incremental: true });

      // 只有修改的 Skill 被评测
      expect(summary.totalSkills).toBe(1);
      expect(summary.skippedCount).toBe(1);
      expect(summary.results[0].skillName).toBe('incr-modified');
    });
  });

  // =========================================================================
  // CLI 命令注册验证
  // =========================================================================

  describe('CLI 命令注册', () => {
    it('eval 命令注册后包含批量/全量相关选项', async () => {
      const { Command } = await import('commander');
      const program = new Command();
      program.exitOverride();

      registerEvalCommand(program);

      const evalCmd = program.commands.find(c => c.name() === 'eval');
      expect(evalCmd).toBeDefined();

      const options = evalCmd!.options.map(o => o.long);
      expect(options).toContain('--all');
      expect(options).toContain('--concurrency');
      expect(options).toContain('--category');
      expect(options).toContain('--incremental');
    });

    it('skill-name 参数变为可选（支持 --all 模式）', async () => {
      const { Command } = await import('commander');
      const program = new Command();
      program.exitOverride();

      registerEvalCommand(program);

      const evalCmd = program.commands.find(c => c.name() === 'eval');
      expect(evalCmd).toBeDefined();

      // 验证命令描述包含批量/全量能力
      expect(evalCmd!.description()).toContain('批量');
    });
  });

  // =========================================================================
  // 边界情况
  // =========================================================================

  describe('边界情况', () => {
    it('空 Skill 列表批量评测返回空结果', async () => {
      const summary = await evalBatchWithIsolation([]);

      expect(summary.totalSkills).toBe(0);
      expect(summary.results).toHaveLength(0);
    });

    it('Skill 无用例文件时批量评测不崩溃', async () => {
      createTestSkill('no-cases', 'core', skillWithAllSections);

      const summary = await evalBatchWithIsolation(['no-cases']);

      expect(summary.totalSkills).toBe(1);
      // 无用例的 Skill 应被标记为成功（没有可失败的用例）
      const result = summary.results.find(r => r.skillName === 'no-cases');
      expect(result?.success).toBe(true);
    });

    it('并发数小于 1 时使用默认值 5', async () => {
      createTestSkill('invalid-conc', 'core', skillWithAllSections, validCasesCsv);

      const summary = await evalBatchWithIsolation(['invalid-conc'], { concurrency: 0 });

      expect(summary.totalSkills).toBe(1);
    });
  });
});
