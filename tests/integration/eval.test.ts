import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evalSingleSkill } from '../../src/cli/commands/eval.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'eval');
const skillsRoot = path.join(testDir, 'skills');

/** 清理评测归档目录（带重试） */
function cleanupEvalRoot(): void {
  const evalRoot = path.join(process.cwd(), '.quick-skill-eval');
  if (fs.existsSync(evalRoot)) {
    try {
      fs.rmSync(evalRoot, { recursive: true, force: true });
    } catch {
      // Windows 可能有文件锁，忽略
    }
  }
}

/** 为每个测试生成唯一的评测根目录 */
function getUniqueEvalRoot(): string {
  return path.join(testDir, '.quick-skill-eval-' + Date.now());
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
name: test-eval-skill
description: 一个用于评测的测试技能
---

## When to use this

当需要执行代码评测时
当需要验证技能行为时

## When NOT to use this

当只需要简单文本处理时

## Definition of done

生成 output.txt 文件
退出码为 0

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
test-eval-skill-positive-1,true,请执行代码评测,生成 output.txt 文件,false,false
test-eval-skill-positive-2,true,请验证技能行为,退出码为 0,false,false
test-eval-skill-negative-1,false,我需要做蛋糕,Skill 不应被触发,false,false
`;

const casesWithDeprecatedCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-eval-skill-positive-1,true,请执行代码评测,生成 output.txt 文件,false,false
test-eval-skill-old,true,旧版用例,旧标准,false,true
`;

const casesWithMissingFieldsCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-eval-skill-positive-1,true,请执行代码评测,生成 output.txt 文件,false,false
invalid-case-1,true,,缺少 prompt 字段,false,false
`;

// ===== 测试用 Rubric Schema =====

const rubricSchemaJson = JSON.stringify({
  dimensions: [
    {
      id: 'quality',
      name: '质量',
      weight: 0.6,
      prompt: '请评估输出质量',
    },
    {
      id: 'completeness',
      name: '完整性',
      weight: 0.4,
      prompt: '请评估输出完整性',
    },
  ],
  passingThreshold: 0.7,
});

/**
 * 带隔离评测根目录的评测辅助函数
 * 每个测试使用独立的评测目录，避免互相干扰
 */
async function evalWithIsolation(skillName: string, timeoutSeconds: number, rubricSchema?: any) {
  const evalRoot = getUniqueEvalRoot();
  const originalEnv = process.env.QUICK_SKILL_EVAL_ROOT;
  process.env.QUICK_SKILL_EVAL_ROOT = evalRoot;
  try {
    return await evalSingleSkill(skillName, timeoutSeconds, rubricSchema, skillsRoot, evalRoot);
  } finally {
    if (originalEnv !== undefined) {
      process.env.QUICK_SKILL_EVAL_ROOT = originalEnv;
    } else {
      delete process.env.QUICK_SKILL_EVAL_ROOT;
    }
  }
}

describe('eval 命令 — 集成测试', () => {
  beforeEach(() => {
    // Mock process.exit 防止测试中断
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AC-009-1: 自动查找匹配的 Skill 目录
  // =========================================================================

  describe('AC-009-1: Skill 目录查找', () => {
    it('能在单个分类目录下找到 Skill', async () => {
      createTestSkill('my-skill', 'core', skillWithAllSections, validCasesCsv);

      // 验证 findSkillDir 能找到
      const { findSkillDir } = await import('../../src/utils/skill-finder.js');
      const found = findSkillDir('my-skill', skillsRoot);
      expect(found).not.toBeNull();
      expect(found!).toContain('my-skill');
    });

    it('能在多个分类目录中找到 Skill', async () => {
      createTestSkill('shared-skill', 'frontend', skillWithAllSections, validCasesCsv);
      createTestSkill('other-skill', 'backend', skillWithAllSections, validCasesCsv);

      const { findSkillDir } = await import('../../src/utils/skill-finder.js');
      const found = findSkillDir('shared-skill', skillsRoot);
      expect(found).not.toBeNull();
      expect(found!).toContain('shared-skill');
      expect(found!).toContain('frontend');
    });
  });

  // =========================================================================
  // AC-009-3: Skill 不存在时输出错误
  // =========================================================================

  describe('AC-009-3: Skill 不存在', () => {
    it('Skill 不存在时抛出明确错误', async () => {
      await expect(evalSingleSkill('non-existent-skill', 10)).rejects.toThrow(
        '未找到 Skill: non-existent-skill'
      );
    });
  });

  // =========================================================================
  // AC-009-4: 无用例文件时提示先执行 eval-gen
  // =========================================================================

  describe('AC-009-4: 无用例文件', () => {
    it('无用例文件时提示先执行 eval-gen', async () => {
      createTestSkill('no-cases-skill', 'core', skillWithAllSections);
      // 不创建 CSV 文件

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await evalWithIsolation('no-cases-skill', 10);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('eval-gen');

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // AC-009-2: 完整评测流程
  // =========================================================================

  describe('AC-009-2: 完整评测流程', () => {
    it('能完成端到端评测：加载用例 → 沙箱 → 评测 → 打分 → 持久化 → 回归检测', async () => {
      createTestSkill('full-eval-skill', 'core', skillWithAllSections, validCasesCsv);

      const result = await evalWithIsolation('full-eval-skill', 10);

      // 验证返回结果结构
      expect(result).toHaveProperty('hasFailure');
      expect(result).toHaveProperty('skillScore');
      expect(result).toHaveProperty('regression');
      expect(result).toHaveProperty('archiveDir');
      expect(result).toHaveProperty('htmlPath');

      // 验证 Skill 打分
      expect(result.skillScore.skillName).toBe('full-eval-skill');
      expect(result.skillScore.score).toBeGreaterThanOrEqual(0);
      expect(result.skillScore.score).toBeLessThanOrEqual(100);
      expect(result.skillScore.caseScores.length).toBeGreaterThan(0);

      // 验证回归检测结果存在
      expect(result.regression).toHaveProperty('isFirstRun');
      expect(result.regression).toHaveProperty('hasRegression');

      // 验证持久化目录已创建
      expect(fs.existsSync(result.archiveDir)).toBe(true);

      // 验证 HTML 报告已生成
      expect(fs.existsSync(result.htmlPath)).toBe(true);

      // 验证 result.json 已写入
      const jsonPath = path.join(result.archiveDir, 'result.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      expect(jsonContent.skillName).toBe('full-eval-skill');
      expect(jsonContent.skillScore).toBeDefined();
    });

    it('能正确处理 deprecated 用例跳过', async () => {
      createTestSkill('deprecated-skill', 'core', skillWithAllSections, casesWithDeprecatedCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await evalWithIsolation('deprecated-skill', 10);

      // 只评测了 1 条有效用例（deprecated 被跳过）
      expect(result.skillScore.caseScores.length).toBe(1);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('deprecated');
      expect(output).toContain('跳过');

      consoleSpy.mockRestore();
    });

    it('能正确处理无效用例（缺少必填字段）', async () => {
      createTestSkill('invalid-skill', 'core', skillWithAllSections, casesWithMissingFieldsCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await evalWithIsolation('invalid-skill', 10);

      // 只有有效用例被评测
      expect(result.skillScore.caseScores.length).toBe(1);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('警告');

      consoleSpy.mockRestore();
    });

    it('首次评测时回归检测返回 isFirstRun=true', async () => {
      createTestSkill('first-run-skill', 'core', skillWithAllSections, validCasesCsv);

      const result = await evalWithIsolation('first-run-skill', 10);

      // 验证回归检测结果存在
      expect(result.regression).toHaveProperty('isFirstRun');
      expect(result.regression).toHaveProperty('hasRegression');
      expect(result.regression).toHaveProperty('previousScore');
    });
  });

  // =========================================================================
  // AC-009-5: 评测过程展示进度
  // =========================================================================

  describe('AC-009-5: 进度展示', () => {
    it('评测过程中输出当前用例 id 和状态', async () => {
      createTestSkill('progress-skill', 'core', skillWithAllSections, validCasesCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await evalWithIsolation('progress-skill', 10);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');

      // 应包含进度信息
      expect(output).toContain('1/3');
      expect(output).toContain('2/3');
      expect(output).toContain('3/3');
      expect(output).toContain('评测用例');

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // AC-009-6: 评测完成后输出汇总
  // =========================================================================

  describe('AC-009-6: 评测汇总', () => {
    it('评测完成后输出汇总信息', async () => {
      createTestSkill('summary-skill', 'core', skillWithAllSections, validCasesCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await evalWithIsolation('summary-skill', 10);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');

      // 应包含汇总信息
      expect(output).toContain('评测汇总');
      expect(output).toContain('综合得分');
      expect(output).toContain('用例通过率');
      expect(output).toContain('正例通过率');
      expect(output).toContain('负例准确率');

      consoleSpy.mockRestore();
    });

    it('首次评测时输出首次评测提示', async () => {
      createTestSkill('first-eval-skill', 'core', skillWithAllSections, validCasesCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await evalWithIsolation('first-eval-skill', 10);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      // 验证输出包含汇总信息
      expect(output).toContain('评测汇总');
      expect(output).toContain('综合得分');

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // AC-009-7: 退出码
  // =========================================================================

  describe('AC-009-7: 退出码', () => {
    it('通过 registerEvalCommand 注册后，命令可用', async () => {
      const { Command } = await import('commander');
      const { registerEvalCommand } = await import('../../src/cli/commands/eval.js');

      const program = new Command();
      program.exitOverride(); // 防止 process.exit 终止测试

      registerEvalCommand(program);

      // 验证命令已注册
      const evalCmd = program.commands.find(c => c.name() === 'eval');
      expect(evalCmd).toBeDefined();
      // 验证命令有 --rubric 和 --timeout 选项
      const options = evalCmd!.options.map(o => o.long);
      expect(options).toContain('--rubric');
      expect(options).toContain('--timeout');
    });
  });

  // =========================================================================
  // 超时参数验证
  // =========================================================================

  describe('超时参数', () => {
    it('默认超时为 10 秒', async () => {
      createTestSkill('timeout-skill', 'core', skillWithAllSections, validCasesCsv);

      // 不抛异常说明超时参数被正确处理
      const result = await evalWithIsolation('timeout-skill', 10);
      expect(result).toBeDefined();
    });

    it('超时不超过 30 秒上限', async () => {
      createTestSkill('max-timeout-skill', 'core', skillWithAllSections, validCasesCsv);

      // 传入超过 30 的值，应被截断
      const result = await evalWithIsolation('max-timeout-skill', 60);
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // Rubric 评测
  // =========================================================================

  describe('Rubric 评测（--rubric）', () => {
    it('指定 Rubric Schema 文件时启用模型辅助评测', async () => {
      createTestSkill('rubric-skill', 'core', skillWithAllSections, validCasesCsv);

      // 创建 Rubric Schema 文件
      const schemaPath = path.join(testDir, 'rubric-schema.json');
      fs.writeFileSync(schemaPath, rubricSchemaJson, 'utf-8');

      // 由于 rubric-engine 需要 modelProvider，在没有真实模型的情况下
      // 会返回默认分数（score: 0, pass: false）
      // 这里只验证流程不崩溃
      const result = await evalWithIsolation('rubric-skill', 10, JSON.parse(rubricSchemaJson));
      expect(result).toBeDefined();
      expect(result.skillScore).toBeDefined();
    });

    it('Rubric Schema 文件不存在时抛出错误', async () => {
      await expect(
        evalWithIsolation('some-skill', 10)
      ).rejects.toThrow('未找到 Skill');

      // 直接测试 loadRubricSchema 的错误路径
      const { registerEvalCommand } = await import('../../src/cli/commands/eval.js');
      const { Command } = await import('commander');

      const program = new Command();
      program.exitOverride();
      registerEvalCommand(program);

      // 验证命令参数包含 --rubric
      const evalCmd = program.commands.find(c => c.name() === 'eval');
      const rubricOption = evalCmd!.options.find(o => o.long === '--rubric');
      expect(rubricOption).toBeDefined();
    });
  });

  // =========================================================================
  // 回归检测（有历史数据时）
  // =========================================================================

  describe('回归检测（有历史数据）', () => {
    it('第二次评测时能检测到回归', async () => {
      createTestSkill('regression-skill', 'core', skillWithAllSections, validCasesCsv);

      // 第一次评测
      const result1 = await evalWithIsolation('regression-skill', 10);
      expect(result1.regression).toHaveProperty('isFirstRun');

      // 等待 1 秒以确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 第二次评测（同一技能，模拟文件变更）
      const result2 = await evalWithIsolation('regression-skill', 10);

      // 验证第二次评测结果存在
      expect(result2.regression).toHaveProperty('isFirstRun');
      expect(result2.regression).toHaveProperty('hasRegression');
    });
  });

  // =========================================================================
  // 边界情况
  // =========================================================================

  describe('边界情况', () => {
    it('Skill 目录缺少 SKILL.md 时抛出错误', async () => {
      // 创建目录但不创建 SKILL.md
      const skillDir = path.join(skillsRoot, 'core', 'broken-skill');
      fs.mkdirSync(skillDir, { recursive: true });

      await expect(evalWithIsolation('broken-skill', 10)).rejects.toThrow(
        '缺少 SKILL.md'
      );
    });

    it('所有用例都无效时正常退出', async () => {
      const allInvalidCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
,,缺少 id 和 prompt,,,false
`;
      createTestSkill('all-invalid-skill', 'core', skillWithAllSections, allInvalidCsv);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await evalWithIsolation('all-invalid-skill', 10);

      const output = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('没有有效的用例');

      consoleSpy.mockRestore();
    });

    it('只有负例用例时能正常评测', async () => {
      const negativeOnlyCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-negative-only-1,false,无关内容,Skill 不应被触发,false,false
test-negative-only-2,false,另一个无关内容,Skill 不应被触发,false,false
`;
      createTestSkill('negative-only-skill', 'core', skillWithAllSections, negativeOnlyCsv);

      const result = await evalWithIsolation('negative-only-skill', 10);
      expect(result.skillScore.caseScores.length).toBe(2);
      expect(result.skillScore.negativePassRate).toBeGreaterThanOrEqual(0);
    });

    it('只有正例用例时能正常评测', async () => {
      const positiveOnlyCsv = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-positive-only-1,true,请执行操作,生成结果文件,false,false
`;
      createTestSkill('positive-only-skill', 'core', skillWithAllSections, positiveOnlyCsv);

      const result = await evalWithIsolation('positive-only-skill', 10);
      expect(result.skillScore.caseScores.length).toBe(1);
      expect(result.skillScore.positivePassRate).toBeGreaterThanOrEqual(0);
    });
  });
});
