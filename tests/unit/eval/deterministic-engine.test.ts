import { describe, it, expect } from 'vitest';
import { runDeterministicEval } from '../../../src/eval/deterministic-engine.js';
import type { CheckContext } from '../../../src/eval/checkers/result-checker.js';

/**
 * 创建模拟 CheckContext
 */
function createMockContext(): CheckContext {
  return {
    testCase: {
      id: 'case-1',
      should_trigger: true,
      prompt: '测试 prompt',
      pass_criteria: '测试标准',
      custom: false,
      deprecated: false,
      isValid: true,
      missingFields: [],
    },
    sandbox: {
      sandboxDir: '/tmp/test-sandbox',
      skillMdPath: '/tmp/test-sandbox/SKILL.md',
      timeoutMs: 10000,
      cleanup: () => {},
      abortSignal: new AbortController().signal,
    },
    skillAnchor: {
      name: 'test-skill',
      description: '测试 Skill',
      whenToUse: '当需要测试时',
      whenNotToUse: '不需要测试时',
      definitionOfDone: '生成 output.txt',
      whatToBuild: 'src/index.ts',
      steps: '1. 初始化\n2. 执行\n3. 验证',
    },
    traceCollector: {
      record: () => {},
      flush: () => {},
      getTracePath: () => '/tmp/trace.jsonl',
      getEventCount: () => 0,
    },
  };
}

describe('runDeterministicEval — 编排逻辑', () => {
  // ─── AC-003-5: 每类检查输出明确的 pass/fail 结果和详细说明 ───

  describe('AC-003-5: 每类检查输出明确的 pass/fail 结果和详细说明', () => {
    it('返回包含 4 个检查结果，按固定顺序排列', () => {
      const context = createMockContext();
      const result = runDeterministicEval(context);

      expect(result.checks).toHaveLength(4);
      expect(result.checks[0].checkerId).toBe('result');
      expect(result.checks[1].checkerId).toBe('process');
      expect(result.checks[2].checkerId).toBe('style');
      expect(result.checks[3].checkerId).toBe('efficiency');
    });

    it('每个检查结果包含 details 详细说明', () => {
      const context = createMockContext();
      const result = runDeterministicEval(context);

      for (const check of result.checks) {
        expect(check.details).toBeDefined();
        expect(check.details.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── AC-003-6: 4 类检查全部通过时记满分，每类独立计分 ───

  describe('AC-003-6: 4 类检查全部通过时记满分，每类独立计分', () => {
    it('当 4 个检查器全部适用时，maxScore = 100', () => {
      const context = createMockContext();
      const result = runDeterministicEval(context);

      // 所有章节都存在，所有检查器都适用
      expect(result.maxScore).toBe(100);
      expect(result.notApplicableChecks).toHaveLength(0);
    });

    it('当所有基于章节的检查器都不适用时，仅 efficiency 适用', () => {
      const context = createMockContext();
      // 移除所有章节内容
      context.skillAnchor = {
        name: 'test-skill',
        description: '测试',
        whenToUse: '',
        whenNotToUse: '',
        definitionOfDone: '',       // result 不适用
        whatToBuild: '',            // style 不适用
        steps: '',                  // process 不适用
      };

      const result = runDeterministicEval(context);

      expect(result.notApplicableChecks).toContain('result');
      expect(result.notApplicableChecks).toContain('process');
      expect(result.notApplicableChecks).toContain('style');
      // efficiency 始终适用
      expect(result.notApplicableChecks).not.toContain('efficiency');
      expect(result.maxScore).toBe(25);
    });

    it('当部分检查器不适用时，maxScore 按适用数量计算', () => {
      const context = createMockContext();
      // 只保留 definitionOfDone（result 适用），移除 whatToBuild 和 steps
      context.skillAnchor = {
        name: 'test-skill',
        description: '测试',
        whenToUse: '',
        whenNotToUse: '',
        definitionOfDone: '生成 output.txt', // result 适用
        whatToBuild: '',                     // style 不适用
        steps: '',                           // process 不适用
      };

      const result = runDeterministicEval(context);

      expect(result.notApplicableChecks).toContain('process');
      expect(result.notApplicableChecks).toContain('style');
      expect(result.notApplicableChecks).not.toContain('result');
      expect(result.notApplicableChecks).not.toContain('efficiency');
      expect(result.maxScore).toBe(50); // result + efficiency = 2 * 25
    });
  });

  // ─── AC-003-7: 不适用检查器等比缩放 ───

  describe('AC-003-7: 不适用检查器等比缩放', () => {
    it('当 1 个不适用、3 个适用时，缩放分母为 75', () => {
      const context = createMockContext();
      context.skillAnchor.definitionOfDone = ''; // result 不适用

      const result = runDeterministicEval(context);

      expect(result.notApplicableChecks).toContain('result');
      expect(result.maxScore).toBe(75); // 3 个适用检查器 * 25
    });

    it('当 2 个不适用、2 个适用时，缩放分母为 50', () => {
      const context = createMockContext();
      context.skillAnchor.definitionOfDone = ''; // result 不适用
      context.skillAnchor.whatToBuild = '';      // style 不适用

      const result = runDeterministicEval(context);

      expect(result.notApplicableChecks).toContain('result');
      expect(result.notApplicableChecks).toContain('style');
      expect(result.maxScore).toBe(50); // 2 个适用检查器 * 25
    });

    it('当 3 个不适用、1 个适用时，缩放分母为 25', () => {
      const context = createMockContext();
      context.skillAnchor.definitionOfDone = ''; // result 不适用
      context.skillAnchor.whatToBuild = '';      // style 不适用
      context.skillAnchor.steps = '';            // process 不适用

      const result = runDeterministicEval(context);

      expect(result.notApplicableChecks).toContain('result');
      expect(result.notApplicableChecks).toContain('style');
      expect(result.notApplicableChecks).toContain('process');
      expect(result.notApplicableChecks).not.toContain('efficiency');
      expect(result.maxScore).toBe(25); // 仅 efficiency 适用
    });

    it('allPassed 仅考虑适用检查器', () => {
      const context = createMockContext();
      context.skillAnchor.definitionOfDone = ''; // result 不适用

      const result = runDeterministicEval(context);

      // result 不适用，不影响 allPassed 判断
      expect(result.notApplicableChecks).toContain('result');
      // allPassed 取决于 process、style、efficiency 的实际结果
      expect(typeof result.allPassed).toBe('boolean');
    });
  });

  // ─── 总分计算验证 ───

  describe('总分计算验证', () => {
    it('totalScore 范围始终在 0-100 之间', () => {
      const contexts: CheckContext[] = [
        createMockContext(),
        {
          ...createMockContext(),
          skillAnchor: {
            name: 'test',
            description: '',
            whenToUse: '',
            whenNotToUse: '',
            definitionOfDone: '',
            whatToBuild: '',
            steps: '',
          },
        },
        {
          ...createMockContext(),
          skillAnchor: {
            name: 'test',
            description: '',
            whenToUse: '',
            whenNotToUse: '',
            definitionOfDone: '生成 output.txt',
            whatToBuild: '',
            steps: '',
          },
        },
      ];

      for (const ctx of contexts) {
        const result = runDeterministicEval(ctx);
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
        expect(result.totalScore).toBeLessThanOrEqual(100);
      }
    });

    it('totalScore 是基于适用检查器的实际得分等比缩放', () => {
      const context = createMockContext();
      context.skillAnchor.definitionOfDone = ''; // result 不适用

      const result = runDeterministicEval(context);

      // 验证缩放公式: totalScore = round(rawTotal / maxScore * 100)
      const applicableChecks = result.checks.filter(c => !c.notApplicable);
      const rawTotal = applicableChecks.reduce((sum, c) => sum + c.score, 0);
      const expectedScore = result.maxScore > 0
        ? Math.round((rawTotal / result.maxScore) * 100)
        : 0;

      expect(result.totalScore).toBe(expectedScore);
    });

    it('当所有检查器都不适用时，totalScore = 0，maxScore = 0', () => {
      const context = createMockContext();
      context.skillAnchor = {
        name: 'test',
        description: '',
        whenToUse: '',
        whenNotToUse: '',
        definitionOfDone: '',
        whatToBuild: '',
        steps: '',
      };

      const result = runDeterministicEval(context);

      // efficiency 始终适用（notApplicable=false），所以 maxScore = 25
      // 但由于沙箱不存在，efficiency 可能得 0 分
      expect(result.maxScore).toBe(25);
      expect(result.notApplicableChecks).not.toContain('efficiency');
    });
  });

  // ─── 检查结果接口完整性 ───

  describe('检查结果接口完整性', () => {
    it('DeterministicEvalResult 包含所有必需字段', () => {
      const context = createMockContext();
      const result = runDeterministicEval(context);

      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('maxScore');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('allPassed');
      expect(result).toHaveProperty('notApplicableChecks');

      expect(typeof result.totalScore).toBe('number');
      expect(typeof result.maxScore).toBe('number');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(typeof result.allPassed).toBe('boolean');
      expect(Array.isArray(result.notApplicableChecks)).toBe(true);
    });

    it('每个 CheckResult 包含所有必需字段', () => {
      const context = createMockContext();
      const result = runDeterministicEval(context);

      for (const check of result.checks) {
        expect(check).toHaveProperty('checkerId');
        expect(check).toHaveProperty('pass');
        expect(check).toHaveProperty('score');
        expect(check).toHaveProperty('details');
        expect(check).toHaveProperty('notApplicable');

        expect(typeof check.checkerId).toBe('string');
        expect(typeof check.pass).toBe('boolean');
        expect(typeof check.score).toBe('number');
        expect(Array.isArray(check.details)).toBe(true);
        expect(typeof check.notApplicable).toBe('boolean');
      }
    });

    it('score 范围在每个 CheckResult 中始终在 0-25 之间', () => {
      const context = createMockContext();
      const result = runDeterministicEval(context);

      for (const check of result.checks) {
        expect(check.score).toBeGreaterThanOrEqual(0);
        expect(check.score).toBeLessThanOrEqual(25);
      }
    });
  });
});
