import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectRegression } from '../../../src/eval/regression-detector.js';
import type { CaseScore, SkillScore } from '../../../src/types/eval.js';

/**
 * 辅助函数：创建标准 CaseScore 测试对象
 */
function createCaseScore(caseId: string, score: number, shouldTrigger = true): CaseScore {
  return {
    caseId,
    score,
    deterministicScore: score,
    rubricScore: null,
    deductions: [],
    shouldTrigger,
  };
}

/**
 * 辅助函数：创建标准 SkillScore 测试对象
 */
function createSkillScore(skillName: string, score: number, caseScores: CaseScore[]): SkillScore {
  return {
    skillName,
    score,
    positivePassRate: score / 100,
    negativePassRate: score / 100,
    rubricAvgScore: null,
    caseScores,
    formula: `正例通过率(${score}%) × 60% + 负例准确率(${score}%) × 40%`,
  };
}

/**
 * 辅助函数：在临时目录中写入历史 result.json
 */
function writeHistoricalResult(
  baseDir: string,
  timeDir: string,
  category: string,
  skillName: string,
  skillScore: SkillScore
): string {
  const resultDir = path.join(baseDir, timeDir, category, skillName);
  fs.mkdirSync(resultDir, { recursive: true });
  const jsonPath = path.join(resultDir, 'result.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      skillName,
      category,
      timestamp: timeDir.replace(/(\d{8})-(\d{6})/, '$1T$2.000Z'),
      skillScore,
      caseResults: [],
    }),
    'utf-8'
  );
  return jsonPath;
}

// ==================== AC-008-4: 无历史结果时标注首次评测 ====================

describe('AC-008-4: 无历史结果时标注首次评测', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('没有任何历史结果时，isFirstRun 为 true', () => {
    const currentSkillScore = createSkillScore('test-skill', 85, [
      createCaseScore('case-1', 100),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(true);
    expect(result.hasRegression).toBe(false);
    expect(result.regressions).toHaveLength(0);
    expect(result.previousScore).toBeNull();
    expect(result.scoreDelta).toBeNull();
  });

  it('历史目录存在但目标 Skill 无结果时，isFirstRun 为 true', () => {
    // 写入另一个 Skill 的历史结果
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'other-skill',
      createSkillScore('other-skill', 90, [])
    );

    const currentSkillScore = createSkillScore('test-skill', 85, []);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(true);
    expect(result.hasRegression).toBe(false);
  });
});

// ==================== AC-008-1: 自动查找上一次结果 ====================

describe('AC-008-1: 自动查找上一次结果', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('找到最近一次历史结果并对比', () => {
    // 写入两次历史结果，应该取最近的一次
    writeHistoricalResult(
      tempBaseDir,
      '20260508-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 70, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 80),
      ])
    );
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 80, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 90),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 85, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 100),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(false);
    expect(result.previousScore).toBe(80);
    expect(result.scoreDelta).toBe(5);
  });

  it('只对比上一次结果，忽略更早的结果', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260507-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 50, [])
    );
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 75, [])
    );

    const currentSkillScore = createSkillScore('test-skill', 80, []);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    // 应该对比 75 分的那次，而不是 50 分的
    expect(result.previousScore).toBe(75);
    expect(result.scoreDelta).toBe(5);
  });

  it('不同 category 的结果互不干扰', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'backend-patterns',
      'test-skill',
      createSkillScore('test-skill', 50, [])
    );

    const currentSkillScore = createSkillScore('test-skill', 85, []);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(true);
  });
});

// ==================== AC-008-2: 对比标注新增失败、得分下降 ====================

describe('AC-008-2: 对比标注新增失败、得分下降', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('检测新增失败（new_failure）', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 100, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 100),
      ])
    );

    // case-2 从 100 降到 0，属于新增失败
    const currentSkillScore = createSkillScore('test-skill', 50, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 0),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(true);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0].caseId).toBe('case-2');
    expect(result.regressions[0].type).toBe('new_failure');
    expect(result.regressions[0].previousScore).toBe(100);
    expect(result.regressions[0].currentScore).toBe(0);
    expect(result.regressions[0].dropAmount).toBe(100);
  });

  it('检测得分下降（score_drop）', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 90, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 80),
      ])
    );

    // case-2 从 80 降到 60，属于得分下降（非完全失败）
    const currentSkillScore = createSkillScore('test-skill', 75, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 60),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(true);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0].caseId).toBe('case-2');
    expect(result.regressions[0].type).toBe('score_drop');
    expect(result.regressions[0].previousScore).toBe(80);
    expect(result.regressions[0].currentScore).toBe(60);
    expect(result.regressions[0].dropAmount).toBe(20);
  });

  it('同时检测新增失败和得分下降', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 90, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 80),
        createCaseScore('case-3', 100),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 50, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 50),  // 得分下降
      createCaseScore('case-3', 0),   // 新增失败
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(true);
    expect(result.regressions).toHaveLength(2);

    const newFailure = result.regressions.find(r => r.type === 'new_failure');
    const scoreDrop = result.regressions.find(r => r.type === 'score_drop');

    expect(newFailure).toBeDefined();
    expect(newFailure!.caseId).toBe('case-3');
    expect(scoreDrop).toBeDefined();
    expect(scoreDrop!.caseId).toBe('case-2');
  });
});

// ==================== AC-008-3: 发现回归时输出警告 ====================

describe('AC-008-3: 发现回归时输出警告', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('有回归时 hasRegression 为 true', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 100, [
        createCaseScore('case-1', 100),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 0, [
      createCaseScore('case-1', 0),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(true);
    expect(result.scoreDelta).toBe(-100);
  });

  it('Skill 级别得分下降也计入回归', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 90, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 80),
      ])
    );

    // Skill 分数从 90 降到 70
    const currentSkillScore = createSkillScore('test-skill', 70, [
      createCaseScore('case-1', 90),
      createCaseScore('case-2', 50),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(true);
    expect(result.previousScore).toBe(90);
    expect(result.scoreDelta).toBe(-20);
  });
});

// ==================== AC-008-5: 无回归场景 ====================

describe('无回归场景', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('所有用例得分相同，无回归', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 85, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 70),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 85, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 70),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(false);
    expect(result.hasRegression).toBe(false);
    expect(result.regressions).toHaveLength(0);
    expect(result.previousScore).toBe(85);
    expect(result.scoreDelta).toBe(0);
  });

  it('得分提升不算回归', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 70, [
        createCaseScore('case-1', 80),
        createCaseScore('case-2', 60),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 90, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 80),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(false);
    expect(result.scoreDelta).toBe(20);
  });

  it('部分用例提升、部分不变，无回归', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 80, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 60),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 90, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 80), // 提升了
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(false);
  });
});

// ==================== 边界场景 ====================

describe('边界场景', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('历史结果中 caseScores 为空数组时，正常处理', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 80, [])
    );

    const currentSkillScore = createSkillScore('test-skill', 85, [
      createCaseScore('case-1', 100),
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(false);
    expect(result.previousScore).toBe(80);
    // 历史无用例，无法对比用例级别回归
    expect(result.regressions).toHaveLength(0);
    expect(result.hasRegression).toBe(false);
  });

  it('当前结果中 caseScores 为空数组时，正常处理', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 80, [
        createCaseScore('case-1', 100),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 0, []);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.isFirstRun).toBe(false);
    expect(result.previousScore).toBe(80);
    expect(result.scoreDelta).toBe(-80);
  });

  it('当前用例比历史用例多，新增用例不算回归', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 100, [
        createCaseScore('case-1', 100),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 100, [
      createCaseScore('case-1', 100),
      createCaseScore('case-2', 100), // 新增用例
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    expect(result.hasRegression).toBe(false);
  });

  it('当前用例比历史用例少，缺失用例不算回归（只对比共有用例）', () => {
    writeHistoricalResult(
      tempBaseDir,
      '20260509-090000',
      'frontend-patterns',
      'test-skill',
      createSkillScore('test-skill', 100, [
        createCaseScore('case-1', 100),
        createCaseScore('case-2', 100),
      ])
    );

    const currentSkillScore = createSkillScore('test-skill', 100, [
      createCaseScore('case-1', 100),
      // case-2 缺失
    ]);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: tempBaseDir,
    });

    // 只对比共有的 case-1，无回归
    expect(result.hasRegression).toBe(false);
  });

  it('evalRoot 目录不存在时，视为首次评测', () => {
    const nonExistentDir = path.join(tempBaseDir, 'non-existent');

    const currentSkillScore = createSkillScore('test-skill', 85, []);

    const result = detectRegression({
      currentSkillScore,
      skillName: 'test-skill',
      category: 'frontend-patterns',
      currentTimestamp: '2026-05-09T10:30:00.000Z',
      evalRoot: nonExistentDir,
    });

    expect(result.isFirstRun).toBe(true);
    expect(result.hasRegression).toBe(false);
  });
});
