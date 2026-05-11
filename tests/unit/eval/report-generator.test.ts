import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateHtmlReport } from '../../../src/eval/report-generator.js';
import type { SkillScore, CaseEvalResult } from '../../../src/types/eval.js';
import type { RegressionResult } from '../../../src/eval/regression-detector.js';

/**
 * 辅助函数：创建标准 SkillScore 测试对象
 */
function createSkillScore(skillName: string, score: number): SkillScore {
  return {
    skillName,
    score,
    positivePassRate: score / 100,
    negativePassRate: score / 100,
    rubricAvgScore: null,
    caseScores: [],
    formula: `正例通过率(${score}%) × 60% + 负例准确率(${score}%) × 40%`,
  };
}

/**
 * 辅助函数：创建标准 CaseEvalResult 测试对象
 */
function createCaseEvalResult(
  caseId: string,
  shouldTrigger: boolean,
  totalScore: number,
  allPassed: boolean
): CaseEvalResult {
  return {
    caseId,
    shouldTrigger,
    deterministicResult: {
      totalScore,
      maxScore: 100,
      checks: [
        { checkerId: 'result', pass: allPassed, score: allPassed ? 25 : 0, details: ['结果检查'], notApplicable: false },
        { checkerId: 'process', pass: allPassed, score: allPassed ? 25 : 0, details: ['流程检查'], notApplicable: false },
        { checkerId: 'style', pass: allPassed, score: allPassed ? 25 : 0, details: ['风格检查'], notApplicable: false },
        { checkerId: 'efficiency', pass: allPassed, score: allPassed ? 25 : 0, details: ['效率检查'], notApplicable: false },
      ],
      allPassed,
      notApplicableChecks: [],
    },
  };
}

/**
 * 辅助函数：创建标准 RegressionResult 测试对象
 */
function createRegressionResult(
  isFirstRun: boolean,
  hasRegression: boolean,
  previousScore: number | null = null,
  scoreDelta: number | null = null
): RegressionResult {
  return {
    isFirstRun,
    hasRegression,
    regressions: [],
    previousScore,
    scoreDelta,
  };
}

// ==================== AC-011-1: 自动生成 HTML 报告 ====================

describe('AC-011-1: 自动生成 HTML 报告', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('生成 HTML 文件并返回文件路径', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 85),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    const resultPath = generateHtmlReport(data, outputPath);

    expect(resultPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<html');
    expect(content).toContain('</html>');
  });

  it('HTML 内容为有效的 HTML 结构', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 85),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 检查基本 HTML 结构
    expect(content).toContain('<head>');
    expect(content).toContain('</head>');
    expect(content).toContain('<body>');
    expect(content).toContain('</body>');
    expect(content).toContain('<meta charset="utf-8">');
  });
});

// ==================== AC-011-2: 包含得分概览、失败详情、回归提示、trace 链接 ====================

describe('AC-011-2: 包含得分概览、失败详情、回归提示、trace 链接', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('包含 Skill 名称和得分概览', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'frontend-patterns',
      category: 'frontend-patterns',
      skillScore: createSkillScore('frontend-patterns', 85),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/frontend-patterns.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('frontend-patterns');
    expect(content).toContain('85');
    // 得分概览区域
    expect(content.toLowerCase()).toMatch(/得分|score|概览|overview/i);
  });

  it('包含正例通过率和负例准确率', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const skillScore: SkillScore = {
      skillName: 'test-skill',
      score: 80,
      positivePassRate: 0.9,
      negativePassRate: 0.85,
      rubricAvgScore: null,
      caseScores: [],
      formula: '正例通过率(90.0%) × 60% + 负例准确率(85.0%) × 40%',
    };
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore,
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 正例通过率 90%
    expect(content).toContain('90');
    // 负例准确率 85%
    expect(content).toContain('85');
  });

  it('包含失败用例详情', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const caseResults: CaseEvalResult[] = [
      createCaseEvalResult('case-pass-1', true, 100, true),
      createCaseEvalResult('case-fail-1', true, 0, false),
      createCaseEvalResult('case-fail-2', false, 50, false),
    ];
    const skillScore: SkillScore = {
      skillName: 'test-skill',
      score: 50,
      positivePassRate: 0.5,
      negativePassRate: 0.5,
      rubricAvgScore: null,
      caseScores: [],
      formula: '正例通过率(50.0%) × 60% + 负例准确率(50.0%) × 40%',
    };
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore,
      caseResults,
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 失败用例 ID 应出现在报告中
    expect(content).toContain('case-fail-1');
    expect(content).toContain('case-fail-2');
    // 失败详情区域
    expect(content.toLowerCase()).toMatch(/失败|fail|详情|detail/i);
  });

  it('包含回归提示（有回归时）', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const regression: RegressionResult = {
      isFirstRun: false,
      hasRegression: true,
      regressions: [
        { caseId: 'case-1', type: 'new_failure', previousScore: 100, currentScore: 0, dropAmount: 100 },
        { caseId: 'case-2', type: 'score_drop', previousScore: 80, currentScore: 60, dropAmount: 20 },
      ],
      previousScore: 90,
      scoreDelta: -10,
    };
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression,
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 回归提示区域
    expect(content.toLowerCase()).toMatch(/回归|regress/i);
    // 显示得分变化
    expect(content).toContain('-10');
    // 显示回归用例
    expect(content).toContain('case-1');
    expect(content).toContain('case-2');
  });

  it('首次评测时不显示回归信息', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 首次评测不应显示回归详情
    expect(content.toLowerCase()).not.toMatch(/new_failure|score_drop/);
  });

  it('包含 trace 链接', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 包含 trace 路径引用
    expect(content).toContain('traces/test-skill.jsonl');
    // 包含链接元素
    expect(content).toMatch(/<a[^>]*href/i);
  });
});

// ==================== AC-011-3: 失败用例 trace 日志可跳转 ====================

describe('AC-011-3: 失败用例 trace 日志可跳转', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('每个失败用例都有对应的 trace 链接', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const caseResults: CaseEvalResult[] = [
      createCaseEvalResult('case-fail-1', true, 0, false),
      createCaseEvalResult('case-fail-2', false, 50, false),
    ];
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 50),
      caseResults,
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 失败用例详情中应包含 trace 链接
    const failSectionMatch = content.match(/<section[^>]*class="[^"]*fail[^"]*"[^>]*>([\s\S]*?)<\/section>/i);
    if (failSectionMatch) {
      const failSection = failSectionMatch[1];
      expect(failSection).toMatch(/<a[^>]*href/i);
    }

    // 至少应有包含 trace 路径的链接
    expect(content).toContain('traces/test-skill.jsonl');
  });

  it('trace 链接使用相对路径', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const caseResults: CaseEvalResult[] = [
      createCaseEvalResult('case-fail-1', true, 0, false),
    ];
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 50),
      caseResults,
      regression: createRegressionResult(true, false),
      traceRelativePath: '../traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('../traces/test-skill.jsonl');
  });
});

// ==================== AC-011-4: 使用轻量级 HTML，不依赖外部资源，可离线 ====================

describe('AC-011-4: 使用轻量级 HTML，不依赖外部资源，可离线', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('不包含外部 CSS 文件引用', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 不应包含外部 CSS link
    expect(content).not.toMatch(/<link[^>]*rel=["']stylesheet["']/i);
    expect(content).not.toMatch(/<link[^>]*href=["']https?:\/\//i);
  });

  it('不包含外部 JS 文件引用', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 不应包含外部 JS script
    expect(content).not.toMatch(/<script[^>]*src=["']https?:\/\//i);
  });

  it('不包含外部字体或 CDN 资源', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 不应引用 Google Fonts 等外部字体
    expect(content).not.toMatch(/fonts\.googleapis\.com/i);
    expect(content).not.toMatch(/cdn\.jsdelivr\.net/i);
    expect(content).not.toMatch(/unpkg\.com/i);
  });

  it('使用内联 CSS 样式', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // 应包含 style 标签或内联 style 属性
    const hasStyleTag = content.includes('<style');
    const hasInlineStyle = content.includes('style="');
    expect(hasStyleTag || hasInlineStyle).toBe(true);
  });

  it('HTML 文件大小合理（轻量级）', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const stats = fs.statSync(outputPath);

    // 空用例列表时，HTML 文件应小于 50KB
    expect(stats.size).toBeLessThan(50 * 1024);
  });
});

// ==================== AC-011-5: 终端输出 HTML 报告路径 ====================

describe('AC-011-5: 终端输出 HTML 报告路径', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('返回值是 HTML 文件的绝对路径', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    const resultPath = generateHtmlReport(data, outputPath);

    expect(path.isAbsolute(resultPath)).toBe(true);
    expect(resultPath).toBe(outputPath);
  });

  it('返回值可用于终端输出', () => {
    const outputPath = path.join(tempDir, 'subdir', 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    const resultPath = generateHtmlReport(data, outputPath);

    // 返回值是字符串且非空
    expect(typeof resultPath).toBe('string');
    expect(resultPath.length).toBeGreaterThan(0);
    // 文件确实存在
    expect(fs.existsSync(resultPath)).toBe(true);
  });
});

// ==================== 边界场景 ====================

describe('边界场景', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('空用例列表时正常生成报告', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 0),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    const resultPath = generateHtmlReport(data, outputPath);

    expect(fs.existsSync(resultPath)).toBe(true);
    const content = fs.readFileSync(resultPath, 'utf-8');
    expect(content).toContain('test-skill');
  });

  it('大量用例时正常生成报告', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const caseResults: CaseEvalResult[] = Array.from({ length: 50 }, (_, i) =>
      createCaseEvalResult(`case-${i}`, i % 2 === 0, i % 3 === 0 ? 0 : 100, i % 3 !== 0)
    );
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 60),
      caseResults,
      regression: createRegressionResult(false, true, 80, -20),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    const resultPath = generateHtmlReport(data, outputPath);

    expect(fs.existsSync(resultPath)).toBe(true);
    const content = fs.readFileSync(resultPath, 'utf-8');
    // 所有用例 ID 都应出现在报告中
    for (let i = 0; i < 50; i++) {
      expect(content).toContain(`case-${i}`);
    }
  });

  it('包含 Rubric 评分时正确展示', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const skillScore: SkillScore = {
      skillName: 'test-skill',
      score: 75,
      positivePassRate: 0.8,
      negativePassRate: 0.7,
      rubricAvgScore: 82,
      caseScores: [],
      formula: '正例通过率(80.0%) × 50% + 负例准确率(70.0%) × 30% + Rubric 均分(82.0) × 20%',
    };
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore,
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    // Rubric 均分应出现在报告中
    expect(content).toContain('82');
    expect(content.toLowerCase()).toMatch(/rubric/i);
  });

  it('输出目录不存在时自动创建', () => {
    const nestedPath = path.join(tempDir, 'deep', 'nested', 'dir', 'report.html');
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 80),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    const resultPath = generateHtmlReport(data, nestedPath);

    expect(fs.existsSync(resultPath)).toBe(true);
  });

  it('得分颜色根据分数高低变化', () => {
    const outputPath = path.join(tempDir, 'report.html');

    // 高分（绿色系）
    const highData = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 90),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };
    generateHtmlReport(highData, outputPath);
    const highContent = fs.readFileSync(outputPath, 'utf-8');
    // 高分应有绿色相关样式
    expect(highContent.toLowerCase()).toMatch(/green|#4caf50|#2e7d32/i);

    // 低分（红色系）
    const lowData = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 20),
      caseResults: [],
      regression: createRegressionResult(true, false),
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };
    generateHtmlReport(lowData, outputPath);
    const lowContent = fs.readFileSync(outputPath, 'utf-8');
    // 低分应有红色相关样式
    expect(lowContent.toLowerCase()).toMatch(/red|#f44336|#c62828/i);
  });

  it('回归类型为 new_failure 时有明显标识', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const regression: RegressionResult = {
      isFirstRun: false,
      hasRegression: true,
      regressions: [
        { caseId: 'case-1', type: 'new_failure', previousScore: 100, currentScore: 0, dropAmount: 100 },
      ],
      previousScore: 100,
      scoreDelta: -100,
    };
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 0),
      caseResults: [],
      regression,
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('new_failure');
    // 新增失败应有明显的视觉标识
    expect(content.toLowerCase()).toMatch(/新增失败|new.*fail/i);
  });

  it('回归类型为 score_drop 时有明显标识', () => {
    const outputPath = path.join(tempDir, 'report.html');
    const regression: RegressionResult = {
      isFirstRun: false,
      hasRegression: true,
      regressions: [
        { caseId: 'case-2', type: 'score_drop', previousScore: 80, currentScore: 60, dropAmount: 20 },
      ],
      previousScore: 80,
      scoreDelta: -20,
    };
    const data = {
      skillName: 'test-skill',
      category: 'frontend-patterns',
      skillScore: createSkillScore('test-skill', 60),
      caseResults: [],
      regression,
      traceRelativePath: 'traces/test-skill.jsonl',
      timestamp: '2026-05-09T10:30:00.000Z',
    };

    generateHtmlReport(data, outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('score_drop');
    // 得分下降应有明显的视觉标识
    expect(content.toLowerCase()).toMatch(/得分下降|score.*drop|下降/i);
  });
});
