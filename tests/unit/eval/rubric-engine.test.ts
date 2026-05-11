import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRubricEval } from '../../../src/eval/rubric-engine.js';
import type { RubricSchema, RubricEvalConfig, ModelProvider } from '../../../src/types/rubric.js';

/**
 * 创建标准测试 Schema
 */
function createStandardSchema(): RubricSchema {
  return {
    dimensions: [
      {
        id: 'clarity',
        name: '清晰度',
        weight: 0.4,
        prompt: '评估回答是否清晰易懂',
      },
      {
        id: 'accuracy',
        name: '准确性',
        weight: 0.6,
        prompt: '评估回答是否准确无误',
      },
    ],
    passingThreshold: 0.7,
  };
}

/**
 * 创建模拟 ModelProvider
 */
function createMockProvider(responses: unknown[]): ModelProvider {
  let callIndex = 0;
  return {
    callModel: vi.fn().mockImplementation(async () => {
      const response = responses[callIndex];
      callIndex++;
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }),
  };
}

/**
 * 创建默认配置
 */
function createDefaultConfig(provider?: ModelProvider): RubricEvalConfig {
  return {
    modelProvider: provider,
    maxRetries: 3,
    readOnly: true,
  };
}

describe('runRubricEval — Rubric 评测引擎', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── AC-004-1: 支持自定义 JSON Schema 评分模板 ───

  describe('AC-004-1: 支持自定义 JSON Schema 评分模板', () => {
    it('使用自定义维度模板进行评分', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'completeness', name: '完整性', weight: 0.5, prompt: '检查内容是否完整' },
          { id: 'consistency', name: '一致性', weight: 0.5, prompt: '检查内容是否前后一致' },
        ],
        passingThreshold: 0.6,
      };

      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '内容较为完整' },
        { score: 0.9, pass: true, notes: '前后逻辑一致' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].id).toBe('completeness');
      expect(result.checks[0].score).toBe(0.8);
      expect(result.checks[1].id).toBe('consistency');
      expect(result.checks[1].score).toBe(0.9);
    });

    it('支持单维度评分模板', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'overall', name: '总体评价', weight: 1.0, prompt: '总体评价内容质量' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        { score: 0.7, pass: true, notes: '总体质量良好' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.checks).toHaveLength(1);
      expect(result.score).toBe(0.7);
    });
  });

  // ─── AC-004-2: 标准 Schema 包含固定核心字段 ───

  describe('AC-004-2: 标准 Schema 包含固定核心字段', () => {
    it('RubricSchema 包含 dimensions 和 passingThreshold', () => {
      const schema = createStandardSchema();
      expect(schema).toHaveProperty('dimensions');
      expect(schema).toHaveProperty('passingThreshold');
      expect(Array.isArray(schema.dimensions)).toBe(true);
      expect(typeof schema.passingThreshold).toBe('number');
    });

    it('RubricDimension 包含 id、name、weight、prompt', () => {
      const schema = createStandardSchema();
      const dim = schema.dimensions[0];
      expect(dim).toHaveProperty('id');
      expect(dim).toHaveProperty('name');
      expect(dim).toHaveProperty('weight');
      expect(dim).toHaveProperty('prompt');
    });

    it('RubricResult 包含 overallPass、score、checks、modelCalls、retries', async () => {
      const schema = createStandardSchema();
      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '清晰' },
        { score: 0.9, pass: true, notes: '准确' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result).toHaveProperty('overallPass');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('modelCalls');
      expect(result).toHaveProperty('retries');

      expect(typeof result.overallPass).toBe('boolean');
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(typeof result.modelCalls).toBe('number');
      expect(typeof result.retries).toBe('number');
    });

    it('RubricCheck 包含 id、pass、score、notes', async () => {
      const schema = createStandardSchema();
      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '清晰' },
        { score: 0.9, pass: true, notes: '准确' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      for (const check of result.checks) {
        expect(check).toHaveProperty('id');
        expect(check).toHaveProperty('pass');
        expect(check).toHaveProperty('score');
        expect(check).toHaveProperty('notes');

        expect(typeof check.id).toBe('string');
        expect(typeof check.pass).toBe('boolean');
        expect(typeof check.score).toBe('number');
        expect(typeof check.notes).toBe('string');
      }
    });
  });

  // ─── AC-004-3: 支持自定义评分维度、权重和通过阈值 ───

  describe('AC-004-3: 支持自定义评分维度、权重和通过阈值', () => {
    it('根据权重计算加权总分', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 0.3, prompt: '提示1' },
          { id: 'd2', name: '维度2', weight: 0.7, prompt: '提示2' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        { score: 1.0, pass: true, notes: '满分' },
        { score: 0.5, pass: true, notes: '中等' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      // 加权分: 1.0 * 0.3 + 0.5 * 0.7 = 0.3 + 0.35 = 0.65
      expect(result.score).toBeCloseTo(0.65, 2);
    });

    it('当加权分 >= passingThreshold 时 overallPass = true', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.6,
      };

      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '通过' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.overallPass).toBe(true);
    });

    it('当加权分 < passingThreshold 时 overallPass = false', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.8,
      };

      const provider = createMockProvider([
        { score: 0.5, pass: false, notes: '未通过' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.overallPass).toBe(false);
    });

    it('空维度列表返回 score = 0，overallPass = false', async () => {
      const schema: RubricSchema = {
        dimensions: [],
        passingThreshold: 0.5,
      };

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig());

      expect(result.score).toBe(0);
      expect(result.overallPass).toBe(false);
      expect(result.checks).toHaveLength(0);
    });
  });

  // ─── AC-004-4: 模型辅助为可选功能，默认不启用 ───

  describe('AC-004-4: 模型辅助为可选功能，默认不启用', () => {
    it('不提供 modelProvider 时，返回默认评分结果', async () => {
      const schema = createStandardSchema();

      const result = await runRubricEval(schema, '测试内容', {
        maxRetries: 3,
        readOnly: true,
      });

      expect(result.modelCalls).toBe(0);
      expect(result.retries).toBe(0);
      expect(result.score).toBe(0);
      expect(result.overallPass).toBe(false);
      expect(result.checks).toHaveLength(2);
      // 每个维度默认未评分
      for (const check of result.checks) {
        expect(check.score).toBe(0);
        expect(check.pass).toBe(false);
      }
    });

    it('提供 modelProvider 时正常调用模型', async () => {
      const schema = createStandardSchema();
      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '清晰' },
        { score: 0.9, pass: true, notes: '准确' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.modelCalls).toBe(2);
      expect(provider.callModel).toHaveBeenCalledTimes(2);
    });
  });

  // ─── AC-004-5: 评分执行采用只读模式 ───

  describe('AC-004-5: 评分执行采用只读模式', () => {
    it('readOnly = true 时，模型调用使用只读提示', async () => {
      const schema = createStandardSchema();
      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '清晰' },
        { score: 0.9, pass: true, notes: '准确' },
      ]);

      await runRubricEval(schema, '测试内容', {
        modelProvider: provider,
        readOnly: true,
        maxRetries: 3,
      });

      // 验证每次调用都包含 readOnly 标记
      const calls = provider.callModel.mock.calls;
      for (const call of calls) {
        const options = call[1] as { readOnly?: boolean } | undefined;
        expect(options?.readOnly).toBe(true);
      }
    });

    it('readOnly 默认为 true', async () => {
      const schema = createStandardSchema();
      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '清晰' },
        { score: 0.9, pass: true, notes: '准确' },
      ]);

      // 不显式设置 readOnly
      await runRubricEval(schema, '测试内容', {
        modelProvider: provider,
        maxRetries: 3,
      });

      const calls = provider.callModel.mock.calls;
      for (const call of calls) {
        const options = call[1] as { readOnly?: boolean } | undefined;
        expect(options?.readOnly).toBe(true);
      }
    });
  });

  // ─── AC-004-6: 模型调用失败内置重试机制（默认 3 次） ───

  describe('AC-004-6: 模型调用失败内置重试机制（默认 3 次）', () => {
    it('模型首次失败后重试成功，记录重试次数', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        new Error('网络错误'),
        { score: 0.8, pass: true, notes: '重试成功' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.modelCalls).toBe(2);
      expect(result.retries).toBe(1);
      expect(result.checks[0].score).toBe(0.8);
    });

    it('超过最大重试次数后返回默认分数', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        new Error('错误1'),
        new Error('错误2'),
        new Error('错误3'),
        new Error('错误4'),
      ]);

      const result = await runRubricEval(schema, '测试内容', {
        modelProvider: provider,
        maxRetries: 3,
        readOnly: true,
      });

      // 初始调用 1 次 + 重试 3 次 = 4 次调用
      expect(result.modelCalls).toBe(4);
      expect(result.retries).toBe(3);
      // 重试耗尽后返回默认分数
      expect(result.checks[0].score).toBe(0);
      expect(result.checks[0].pass).toBe(false);
    });

    it('自定义 maxRetries 生效', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        new Error('错误1'),
        new Error('错误2'),
        { score: 0.7, pass: true, notes: '第二次重试成功' },
      ]);

      const result = await runRubricEval(schema, '测试内容', {
        modelProvider: provider,
        maxRetries: 2,
        readOnly: true,
      });

      expect(result.modelCalls).toBe(3);
      expect(result.retries).toBe(2);
      expect(result.checks[0].score).toBe(0.7);
    });

    it('多个维度各自独立重试', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 0.5, prompt: '提示1' },
          { id: 'd2', name: '维度2', weight: 0.5, prompt: '提示2' },
        ],
        passingThreshold: 0.5,
      };

      // d1: 失败1次后成功, d2: 直接成功
      const provider = createMockProvider([
        new Error('d1 失败'),
        { score: 0.6, pass: true, notes: 'd1 重试成功' },
        { score: 0.8, pass: true, notes: 'd2 直接成功' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.retries).toBe(1);
      expect(result.checks[0].score).toBe(0.6);
      expect(result.checks[1].score).toBe(0.8);
    });
  });

  // ─── 边界场景 ───

  describe('边界场景', () => {
    it('模型返回异常分数（超出 0-1 范围）时进行归一化', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        { score: 1.5, pass: true, notes: '超出范围' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.checks[0].score).toBeLessThanOrEqual(1);
      expect(result.checks[0].score).toBeGreaterThanOrEqual(0);
    });

    it('模型返回负数分数时归一化为 0', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        { score: -0.3, pass: false, notes: '负数' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.checks[0].score).toBe(0);
    });

    it('模型返回非标准响应时安全处理', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        null,
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.checks[0].score).toBe(0);
      expect(result.checks[0].pass).toBe(false);
    });

    it('权重总和不为 1 时仍正确计算加权分', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 2.0, prompt: '提示1' },
          { id: 'd2', name: '维度2', weight: 3.0, prompt: '提示2' },
        ],
        passingThreshold: 0.5,
      };

      const provider = createMockProvider([
        { score: 0.8, pass: true, notes: '好' },
        { score: 0.6, pass: true, notes: '中' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      // 加权分: (0.8*2 + 0.6*3) / (2+3) = (1.6 + 1.8) / 5 = 3.4 / 5 = 0.68
      expect(result.score).toBeCloseTo(0.68, 2);
    });

    it('passingThreshold 为 0 时始终通过', async () => {
      const schema: RubricSchema = {
        dimensions: [
          { id: 'd1', name: '维度1', weight: 1.0, prompt: '提示1' },
        ],
        passingThreshold: 0,
      };

      const provider = createMockProvider([
        { score: 0.1, pass: true, notes: '低分' },
      ]);

      const result = await runRubricEval(schema, '测试内容', createDefaultConfig(provider));

      expect(result.overallPass).toBe(true);
    });
  });
});
