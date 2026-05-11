import { describe, it, expect } from 'vitest';
import { scoreCase, scoreSkill, scoreAllSkills } from '../../../src/eval/scorer.js';
import type { CaseEvalResult, CaseScore } from '../../../src/types/eval.js';

/**
 * 创建标准确定性评测结果（全部通过）
 */
function createAllPassedDeterministic(): CaseEvalResult['deterministicResult'] {
  return {
    totalScore: 100,
    maxScore: 100,
    checks: [
      { checkerId: 'result', pass: true, score: 25, details: ['✓ 所有输出文件存在'], notApplicable: false },
      { checkerId: 'process', pass: true, score: 25, details: ['✓ 流程合规'], notApplicable: false },
      { checkerId: 'style', pass: true, score: 25, details: ['✓ 风格符合约定'], notApplicable: false },
      { checkerId: 'efficiency', pass: true, score: 25, details: ['✓ 效率达标'], notApplicable: false },
    ],
    allPassed: true,
    notApplicableChecks: [],
  };
}

/**
 * 创建部分失败的确定性评测结果
 */
function createPartialFailDeterministic(): CaseEvalResult['deterministicResult'] {
  return {
    totalScore: 50,
    maxScore: 100,
    checks: [
      { checkerId: 'result', pass: true, score: 25, details: ['✓ 输出文件存在'], notApplicable: false },
      { checkerId: 'process', pass: false, score: 0, details: ['✗ 步骤顺序不正确'], notApplicable: false },
      { checkerId: 'style', pass: true, score: 25, details: ['✓ 风格符合约定'], notApplicable: false },
      { checkerId: 'efficiency', pass: false, score: 0, details: ['✗ 命令执行次数超限'], notApplicable: false },
    ],
    allPassed: false,
    notApplicableChecks: [],
  };
}

/**
 * 创建负例用例的确定性评测结果（正确未触发，分数为 0）
 */
function createNegativeCaseDeterministic(): CaseEvalResult['deterministicResult'] {
  return {
    totalScore: 0,
    maxScore: 100,
    checks: [
      { checkerId: 'result', pass: false, score: 0, details: ['✗ 不应触发但触发了'], notApplicable: false },
      { checkerId: 'process', pass: false, score: 0, details: ['✗ 错误触发'], notApplicable: false },
      { checkerId: 'style', pass: false, score: 0, details: ['✗ 不应有输出'], notApplicable: false },
      { checkerId: 'efficiency', pass: false, score: 0, details: ['✗ 不应有执行'], notApplicable: false },
    ],
    allPassed: false,
    notApplicableChecks: [],
  };
}

/**
 * 创建标准 Rubric 评测结果
 */
function createRubricResult(score: number, overallPass: boolean): CaseEvalResult['rubricResult'] {
  return {
    overallPass,
    score, // 0-1 范围
    checks: [
      { id: 'clarity', pass: score > 0.5, score, notes: '清晰度评分' },
      { id: 'accuracy', pass: score > 0.6, score, notes: '准确性评分' },
    ],
    modelCalls: 2,
    retries: 0,
  };
}

/**
 * 创建标准用例评测输入
 */
function createCaseEvalResult(
  caseId: string,
  shouldTrigger: boolean,
  deterministicResult: CaseEvalResult['deterministicResult'],
  rubricResult?: CaseEvalResult['rubricResult']
): CaseEvalResult {
  return {
    caseId,
    shouldTrigger,
    deterministicResult,
    rubricResult,
  };
}

// ==================== AC-005-1: 单条用例打分 ====================

describe('AC-005-1: 单条用例打分', () => {
  describe('scoreCase — 基本打分', () => {
    it('全部通过时，score = 100，deterministicScore = 100', () => {
      const input = createCaseEvalResult('case-1', true, createAllPassedDeterministic());
      const result = scoreCase(input);

      expect(result.caseId).toBe('case-1');
      expect(result.score).toBe(100);
      expect(result.deterministicScore).toBe(100);
      expect(result.deductions).toHaveLength(0);
    });

    it('部分失败时，score = deterministicScore，记录扣分项', () => {
      const input = createCaseEvalResult('case-2', true, createPartialFailDeterministic());
      const result = scoreCase(input);

      expect(result.score).toBe(50);
      expect(result.deterministicScore).toBe(50);
      expect(result.deductions).toHaveLength(2);
      // 验证扣分项来源于失败的检查器
      const deductionSources = result.deductions.map(d => d.reason);
      expect(deductionSources.some(r => r.includes('process'))).toBe(true);
      expect(deductionSources.some(r => r.includes('efficiency'))).toBe(true);
    });

    it('无 Rubric 时，rubricScore = null', () => {
      const input = createCaseEvalResult('case-3', true, createAllPassedDeterministic());
      const result = scoreCase(input);

      expect(result.rubricScore).toBeNull();
    });

    it('有 Rubric 时，rubricScore 正确换算为 0-100', () => {
      const rubric = createRubricResult(0.75, true);
      const input = createCaseEvalResult('case-4', true, createAllPassedDeterministic(), rubric);
      const result = scoreCase(input);

      expect(result.rubricScore).toBe(75);
    });

    it('Rubric 未通过时，记录 Rubric 扣分项', () => {
      const rubric = createRubricResult(0.4, false);
      const input = createCaseEvalResult('case-5', true, createAllPassedDeterministic(), rubric);
      const result = scoreCase(input);

      // 确定性全部通过，但 Rubric 未通过
      const rubricDeductions = result.deductions.filter(d => d.source === 'rubric');
      expect(rubricDeductions).toHaveLength(1);
      expect(rubricDeductions[0].amount).toBe(60); // 100 - 40
    });

    it('shouldTrigger 字段正确传递', () => {
      const positiveInput = createCaseEvalResult('pos-1', true, createAllPassedDeterministic());
      const negativeInput = createCaseEvalResult('neg-1', false, createAllPassedDeterministic());

      expect(scoreCase(positiveInput).shouldTrigger).toBe(true);
      expect(scoreCase(negativeInput).shouldTrigger).toBe(false);
    });

    it('负例用例正确未触发时（totalScore=0），score = 0', () => {
      const input = createCaseEvalResult('neg-2', false, createNegativeCaseDeterministic());
      const result = scoreCase(input);

      expect(result.score).toBe(0);
      expect(result.deterministicScore).toBe(0);
    });
  });

  describe('AC-005-5: 分数计算过程透明可追溯', () => {
    it('每项扣分包含原因、扣分值和来源', () => {
      const input = createCaseEvalResult('trace-1', true, createPartialFailDeterministic());
      const result = scoreCase(input);

      for (const deduction of result.deductions) {
        expect(deduction.reason).toBeDefined();
        expect(typeof deduction.reason).toBe('string');
        expect(deduction.amount).toBeDefined();
        expect(typeof deduction.amount).toBe('number');
        expect(deduction.amount).toBeGreaterThan(0);
        expect(deduction.source).toBeDefined();
        expect(['deterministic', 'rubric']).toContain(deduction.source);
      }
    });

    it('不适用的检查器不参与扣分', () => {
      const input: CaseEvalResult = {
        caseId: 'na-1',
        shouldTrigger: true,
        deterministicResult: {
          totalScore: 75,
          maxScore: 75,
          checks: [
            { checkerId: 'result', pass: true, score: 25, details: ['✓'], notApplicable: false },
            { checkerId: 'process', pass: false, score: 0, details: ['✗'], notApplicable: false },
            { checkerId: 'style', pass: true, score: 25, details: ['✓'], notApplicable: true }, // 不适用
            { checkerId: 'efficiency', pass: true, score: 25, details: ['✓'], notApplicable: false },
          ],
          allPassed: false,
          notApplicableChecks: ['style'],
        },
      };
      const result = scoreCase(input);

      // 只有 process 失败应产生扣分，style 不适用不应扣分
      const processDeductions = result.deductions.filter(d => d.reason.includes('process'));
      expect(processDeductions).toHaveLength(1);
      const styleDeductions = result.deductions.filter(d => d.reason.includes('style'));
      expect(styleDeductions).toHaveLength(0);
    });

    it('CaseScore 包含所有必需字段', () => {
      const input = createCaseEvalResult('interface-1', true, createAllPassedDeterministic());
      const result = scoreCase(input);

      expect(result).toHaveProperty('caseId');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('deterministicScore');
      expect(result).toHaveProperty('rubricScore');
      expect(result).toHaveProperty('deductions');
      expect(result).toHaveProperty('shouldTrigger');

      expect(typeof result.caseId).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(typeof result.deterministicScore).toBe('number');
      expect(result.rubricScore === null || typeof result.rubricScore === 'number').toBe(true);
      expect(Array.isArray(result.deductions)).toBe(true);
      expect(typeof result.shouldTrigger).toBe('boolean');
    });
  });
});

// ==================== AC-005-2: 单个 Skill 打分（有 Rubric） ====================

describe('AC-005-2: 单个 Skill 打分（有 Rubric）', () => {
  describe('scoreSkill — 有 Rubric 权重公式', () => {
    it('正例全部通过、负例全部正确、Rubric 满分时，score = 100', () => {
      const caseScores: CaseScore[] = [
        // 2 个正例全部通过
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: 100, deductions: [], shouldTrigger: true },
        { caseId: 'pos-2', score: 100, deterministicScore: 100, rubricScore: 100, deductions: [], shouldTrigger: true },
        // 2 个负例全部正确（totalScore=0）
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: 100, deductions: [], shouldTrigger: false },
        { caseId: 'neg-2', score: 0, deterministicScore: 0, rubricScore: 100, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.skillName).toBe('test-skill');
      expect(result.positivePassRate).toBe(1); // 2/2
      expect(result.negativePassRate).toBe(1); // 2/2
      expect(result.rubricAvgScore).toBe(100); // (100+100+100+100)/4
      // 1*0.5 + 1*0.3 + 1*0.2 = 1.0 -> 100
      expect(result.score).toBe(100);
      expect(result.formula).toContain('50%');
      expect(result.formula).toContain('30%');
      expect(result.formula).toContain('20%');
    });

    it('正例 50% 通过、负例 50% 正确、Rubric 均分 50 时，计算正确', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: 50, deductions: [], shouldTrigger: true },
        { caseId: 'pos-2', score: 0, deterministicScore: 0, rubricScore: 50, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: 50, deductions: [], shouldTrigger: false },
        { caseId: 'neg-2', score: 100, deterministicScore: 100, rubricScore: 50, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.positivePassRate).toBe(0.5); // 1/2
      expect(result.negativePassRate).toBe(0.5); // 1/2
      expect(result.rubricAvgScore).toBe(50);
      // 0.5*0.5 + 0.5*0.3 + 0.5*0.2 = 0.25 + 0.15 + 0.1 = 0.5 -> 50
      expect(result.score).toBe(50);
    });

    it('Rubric 均分计算只考虑非 null 值', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: 80, deductions: [], shouldTrigger: true },
        { caseId: 'pos-2', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: 60, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      // Rubric 均分 = (80 + 60) / 2 = 70
      expect(result.rubricAvgScore).toBe(70);
    });

    it('caseScores 完整保留所有用例打分详情', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'c1', score: 100, deterministicScore: 100, rubricScore: 80, deductions: [], shouldTrigger: true },
        { caseId: 'c2', score: 0, deterministicScore: 0, rubricScore: 60, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.caseScores).toHaveLength(2);
      expect(result.caseScores[0].caseId).toBe('c1');
      expect(result.caseScores[1].caseId).toBe('c2');
    });
  });
});

// ==================== AC-005-3: 单个 Skill 打分（无 Rubric 调整权重） ====================

describe('AC-005-3: 单个 Skill 打分（无 Rubric 调整权重）', () => {
  describe('scoreSkill — 无 Rubric 权重公式', () => {
    it('无 Rubric 时，使用 60% 正例 + 40% 负例公式', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'pos-2', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: false },
        { caseId: 'neg-2', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.rubricAvgScore).toBeNull();
      // 1*0.6 + 1*0.4 = 1.0 -> 100
      expect(result.score).toBe(100);
      expect(result.formula).toContain('60%');
      expect(result.formula).toContain('40%');
      // 确认公式中不包含 Rubric 相关权重
      expect(result.formula).not.toContain('20%');
    });

    it('无 Rubric 时，正例 50% 通过、负例 50% 正确', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'pos-2', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: false },
        { caseId: 'neg-2', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.positivePassRate).toBe(0.5);
      expect(result.negativePassRate).toBe(0.5);
      // 0.5*0.6 + 0.5*0.4 = 0.3 + 0.2 = 0.5 -> 50
      expect(result.score).toBe(50);
    });

    it('无 Rubric 时，正例全部失败、负例全部错误', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.positivePassRate).toBe(0);
      expect(result.negativePassRate).toBe(0);
      // 0*0.6 + 0*0.4 = 0 -> 0
      expect(result.score).toBe(0);
    });

    it('无 Rubric 时，只有正例（无负例）', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'pos-2', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.positivePassRate).toBe(1);
      expect(result.negativePassRate).toBe(0); // 无负例时为 0
      // 1*0.6 + 0*0.4 = 0.6 -> 60
      expect(result.score).toBe(60);
    });

    it('无 Rubric 时，只有负例（无正例）', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: false },
        { caseId: 'neg-2', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('test-skill', caseScores);

      expect(result.positivePassRate).toBe(0); // 无正例时为 0
      expect(result.negativePassRate).toBe(1);
      // 0*0.6 + 1*0.4 = 0.4 -> 40
      expect(result.score).toBe(40);
    });

    it('无 Rubric 时，空用例列表 score = 0', () => {
      const result = scoreSkill('empty-skill', []);

      expect(result.positivePassRate).toBe(0);
      expect(result.negativePassRate).toBe(0);
      expect(result.rubricAvgScore).toBeNull();
      expect(result.score).toBe(0);
    });

    it('SkillScore 包含所有必需字段', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'c1', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
      ];
      const result = scoreSkill('verify-skill', caseScores);

      expect(result).toHaveProperty('skillName');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('positivePassRate');
      expect(result).toHaveProperty('negativePassRate');
      expect(result).toHaveProperty('rubricAvgScore');
      expect(result).toHaveProperty('caseScores');
      expect(result).toHaveProperty('formula');

      expect(typeof result.skillName).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(typeof result.positivePassRate).toBe('number');
      expect(typeof result.negativePassRate).toBe('number');
      expect(typeof result.formula).toBe('string');
      expect(Array.isArray(result.caseScores)).toBe(true);
    });
  });
});

// ==================== AC-005-4: 全量 Skill 打分 ====================

describe('AC-005-4: 全量 Skill 打分', () => {
  describe('scoreAllSkills — 全量聚合', () => {
    it('计算全量 Skill 平均分', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 90),
        createSkillScore('skill-b', 70),
        createSkillScore('skill-c', 50),
      ];

      const result = scoreAllSkills(skillScores);

      // (90 + 70 + 50) / 3 = 70
      expect(result.averageScore).toBe(70);
      expect(result.totalSkills).toBe(3);
    });

    it('Top 3 按分数降序排列', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 50),
        createSkillScore('skill-b', 90),
        createSkillScore('skill-c', 70),
        createSkillScore('skill-d', 80),
        createSkillScore('skill-e', 30),
      ];

      const result = scoreAllSkills(skillScores);

      expect(result.topSkills).toHaveLength(3);
      expect(result.topSkills[0].skillName).toBe('skill-b'); // 90
      expect(result.topSkills[1].skillName).toBe('skill-d'); // 80
      expect(result.topSkills[2].skillName).toBe('skill-c'); // 70
    });

    it('末位 3 按分数升序排列', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 50),
        createSkillScore('skill-b', 90),
        createSkillScore('skill-c', 70),
        createSkillScore('skill-d', 80),
        createSkillScore('skill-e', 30),
        createSkillScore('skill-f', 10),
      ];

      const result = scoreAllSkills(skillScores);

      expect(result.bottomSkills).toHaveLength(3);
      // 末位 3 是 f=10, e=30, a=50，升序排列
      expect(result.bottomSkills[0].skillName).toBe('skill-f'); // 10
      expect(result.bottomSkills[1].skillName).toBe('skill-e'); // 30
      expect(result.bottomSkills[2].skillName).toBe('skill-a'); // 50
    });

    it('整体健康度等于平均分（四舍五入）', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 85),
        createSkillScore('skill-b', 72),
      ];

      const result = scoreAllSkills(skillScores);

      // (85 + 72) / 2 = 78.5
      expect(result.averageScore).toBe(78.5);
      // Math.round(78.5) = 79
      expect(result.overallHealth).toBe(79);
    });

    it('skillScores 保留所有 Skill 打分详情', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 90),
        createSkillScore('skill-b', 70),
      ];

      const result = scoreAllSkills(skillScores);

      expect(result.skillScores).toHaveLength(2);
      expect(result.skillScores.map(s => s.skillName)).toContain('skill-a');
      expect(result.skillScores.map(s => s.skillName)).toContain('skill-b');
    });

    it('空 Skill 列表时，返回默认值', () => {
      const result = scoreAllSkills([]);

      expect(result.averageScore).toBe(0);
      expect(result.totalSkills).toBe(0);
      expect(result.topSkills).toHaveLength(0);
      expect(result.bottomSkills).toHaveLength(0);
      expect(result.overallHealth).toBe(0);
      expect(result.skillScores).toHaveLength(0);
    });

    it('Skill 数量少于 3 时，Top/Bottom 返回实际数量', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 80),
      ];

      const result = scoreAllSkills(skillScores);

      expect(result.topSkills).toHaveLength(1);
      expect(result.bottomSkills).toHaveLength(1);
      expect(result.topSkills[0].skillName).toBe('skill-a');
      expect(result.bottomSkills[0].skillName).toBe('skill-a');
    });

    it('AllSkillsScore 包含所有必需字段', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 90),
        createSkillScore('skill-b', 70),
        createSkillScore('skill-c', 50),
      ];

      const result = scoreAllSkills(skillScores);

      expect(result).toHaveProperty('averageScore');
      expect(result).toHaveProperty('totalSkills');
      expect(result).toHaveProperty('topSkills');
      expect(result).toHaveProperty('bottomSkills');
      expect(result).toHaveProperty('overallHealth');
      expect(result).toHaveProperty('skillScores');

      expect(typeof result.averageScore).toBe('number');
      expect(typeof result.totalSkills).toBe('number');
      expect(Array.isArray(result.topSkills)).toBe(true);
      expect(Array.isArray(result.bottomSkills)).toBe(true);
      expect(typeof result.overallHealth).toBe('number');
      expect(Array.isArray(result.skillScores)).toBe(true);
    });
  });
});

// ==================== AC-005-5: 分数计算过程透明可追溯 ====================

describe('AC-005-5: 分数计算过程透明可追溯', () => {
  describe('打分公式描述', () => {
    it('有 Rubric 时，formula 包含权重比例', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: 80, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: 60, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('trace-skill', caseScores);

      expect(result.formula).toMatch(/正例通过率/);
      expect(result.formula).toMatch(/负例准确率/);
      expect(result.formula).toMatch(/Rubric 均分/);
      expect(result.formula).toMatch(/50%/);
      expect(result.formula).toMatch(/30%/);
      expect(result.formula).toMatch(/20%/);
    });

    it('无 Rubric 时，formula 包含调整后的权重', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'pos-1', score: 100, deterministicScore: 100, rubricScore: null, deductions: [], shouldTrigger: true },
        { caseId: 'neg-1', score: 0, deterministicScore: 0, rubricScore: null, deductions: [], shouldTrigger: false },
      ];

      const result = scoreSkill('trace-skill', caseScores);

      expect(result.formula).toMatch(/正例通过率/);
      expect(result.formula).toMatch(/负例准确率/);
      expect(result.formula).toMatch(/60%/);
      expect(result.formula).toMatch(/40%/);
      expect(result.formula).not.toMatch(/Rubric/);
    });
  });

  describe('扣分可追溯', () => {
    it('每个扣分项可追溯到具体检查器', () => {
      const input: CaseEvalResult = {
        caseId: 'trace-case',
        shouldTrigger: true,
        deterministicResult: {
          totalScore: 25,
          maxScore: 100,
          checks: [
            { checkerId: 'result', pass: false, score: 0, details: ['✗ 文件缺失: output.txt'], notApplicable: false },
            { checkerId: 'process', pass: false, score: 0, details: ['✗ 步骤跳过'], notApplicable: false },
            { checkerId: 'style', pass: false, score: 0, details: ['✗ 命名不规范'], notApplicable: false },
            { checkerId: 'efficiency', pass: true, score: 25, details: ['✓'], notApplicable: false },
          ],
          allPassed: false,
          notApplicableChecks: [],
        },
      };
      const result = scoreCase(input);

      expect(result.deductions).toHaveLength(3);
      // 验证每个扣分项都包含检查器 ID
      const checkerIds = result.deductions.map(d => {
        const match = d.reason.match(/\[(\w+)\]/);
        return match ? match[1] : null;
      });
      expect(checkerIds).toContain('result');
      expect(checkerIds).toContain('process');
      expect(checkerIds).toContain('style');
    });
  });

  describe('纯函数无副作用', () => {
    it('scoreCase 是纯函数：相同输入产生相同输出', () => {
      const input = createCaseEvalResult('pure-1', true, createPartialFailDeterministic());
      const result1 = scoreCase(input);
      const result2 = scoreCase(input);

      expect(result1).toEqual(result2);
    });

    it('scoreSkill 是纯函数：相同输入产生相同输出', () => {
      const caseScores: CaseScore[] = [
        { caseId: 'c1', score: 100, deterministicScore: 100, rubricScore: 80, deductions: [], shouldTrigger: true },
        { caseId: 'c2', score: 0, deterministicScore: 0, rubricScore: 60, deductions: [], shouldTrigger: false },
      ];
      const result1 = scoreSkill('pure-skill', caseScores);
      const result2 = scoreSkill('pure-skill', caseScores);

      expect(result1.score).toBe(result2.score);
      expect(result1.positivePassRate).toBe(result2.positivePassRate);
      expect(result1.negativePassRate).toBe(result2.negativePassRate);
    });

    it('scoreAllSkills 是纯函数：不修改原始输入数组', () => {
      const skillScores: SkillScore[] = [
        createSkillScore('skill-a', 50),
        createSkillScore('skill-b', 90),
      ];
      const originalOrder = skillScores.map(s => s.skillName);

      scoreAllSkills(skillScores);

      // 原始数组顺序不变
      expect(skillScores.map(s => s.skillName)).toEqual(originalOrder);
    });
  });
});

// ==================== 边界场景 ====================

describe('边界场景', () => {
  it('分数范围始终在 0-100 之间', () => {
    const caseScores: CaseScore[] = [
      { caseId: 'c1', score: 0, deterministicScore: 0, rubricScore: 0, deductions: [], shouldTrigger: true },
      { caseId: 'c2', score: 100, deterministicScore: 100, rubricScore: 100, deductions: [], shouldTrigger: false },
    ];

    const skillResult = scoreSkill('boundary-skill', caseScores);
    expect(skillResult.score).toBeGreaterThanOrEqual(0);
    expect(skillResult.score).toBeLessThanOrEqual(100);
  });

  it('通过率范围始终在 0-1 之间', () => {
    const caseScores: CaseScore[] = [
      { caseId: 'c1', score: 50, deterministicScore: 50, rubricScore: 50, deductions: [], shouldTrigger: true },
      { caseId: 'c2', score: 50, deterministicScore: 50, rubricScore: 50, deductions: [], shouldTrigger: false },
    ];

    const result = scoreSkill('boundary-skill', caseScores);
    expect(result.positivePassRate).toBeGreaterThanOrEqual(0);
    expect(result.positivePassRate).toBeLessThanOrEqual(1);
    expect(result.negativePassRate).toBeGreaterThanOrEqual(0);
    expect(result.negativePassRate).toBeLessThanOrEqual(1);
  });

  it('平均分精度保留两位小数', () => {
    const skillScores: SkillScore[] = [
      createSkillScore('skill-a', 33),
      createSkillScore('skill-b', 67),
    ];

    const result = scoreAllSkills(skillScores);
    // (33 + 67) / 2 = 50
    expect(result.averageScore).toBe(50);
  });

  it('大量 Skill 时 Top/Bottom 仍然正确', () => {
    const skillScores: SkillScore[] = Array.from({ length: 20 }, (_, i) =>
      createSkillScore(`skill-${i}`, i * 5)
    );

    const result = scoreAllSkills(skillScores);

    expect(result.totalSkills).toBe(20);
    expect(result.topSkills).toHaveLength(3);
    expect(result.bottomSkills).toHaveLength(3);
    // Top: skill-19(95), skill-18(90), skill-17(85)
    expect(result.topSkills[0].score).toBe(95);
    expect(result.topSkills[1].score).toBe(90);
    expect(result.topSkills[2].score).toBe(85);
    // Bottom: skill-0(0), skill-1(5), skill-2(10) — 升序排列
    expect(result.bottomSkills[0].score).toBe(0);
    expect(result.bottomSkills[1].score).toBe(5);
    expect(result.bottomSkills[2].score).toBe(10);
  });
});

/**
 * 辅助函数：创建 SkillScore 测试对象
 */
function createSkillScore(skillName: string, score: number): SkillScore {
  return {
    skillName,
    score,
    positivePassRate: score / 100,
    negativePassRate: score / 100,
    rubricAvgScore: score,
    caseScores: [],
    formula: `正例通过率(${score}%) × 50% + 负例准确率(${score}%) × 30% + Rubric 均分(${score}) × 20%`,
  };
}

// 需要从 eval.ts 导入 SkillScore 类型
import type { SkillScore } from '../../../src/types/eval.js';
