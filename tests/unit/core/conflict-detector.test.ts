import { describe, it, expect } from 'vitest';
import { computeContentHash, detectConflicts } from '../../../src/core/conflict-detector.js';
import { TestCase } from '../../../src/types/test-case.js';

// 辅助函数：创建测试用的 TestCase
function createTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'case-001',
    should_trigger: true,
    prompt: 'Given a user request to build a React component',
    pass_criteria: 'Component renders without errors',
    custom: false,
    deprecated: false,
    ...overrides,
  };
}

describe('computeContentHash', () => {
  it('对相同的 prompt + pass_criteria 应返回相同的哈希值', () => {
    const testCase = createTestCase({
      prompt: 'test prompt',
      pass_criteria: 'test criteria',
    });

    const hash1 = computeContentHash(testCase);
    const hash2 = computeContentHash(testCase);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 十六进制长度为 64
  });

  it('对不同的 prompt 应返回不同的哈希值', () => {
    const case1 = createTestCase({ prompt: 'prompt A', pass_criteria: 'same criteria' });
    const case2 = createTestCase({ prompt: 'prompt B', pass_criteria: 'same criteria' });

    expect(computeContentHash(case1)).not.toBe(computeContentHash(case2));
  });

  it('对不同的 pass_criteria 应返回不同的哈希值', () => {
    const case1 = createTestCase({ prompt: 'same prompt', pass_criteria: 'criteria A' });
    const case2 = createTestCase({ prompt: 'same prompt', pass_criteria: 'criteria B' });

    expect(computeContentHash(case1)).not.toBe(computeContentHash(case2));
  });

  it('对 prompt 和 pass_criteria 都不同的用例应返回不同的哈希值', () => {
    const case1 = createTestCase({ prompt: 'prompt A', pass_criteria: 'criteria A' });
    const case2 = createTestCase({ prompt: 'prompt B', pass_criteria: 'criteria B' });

    expect(computeContentHash(case1)).not.toBe(computeContentHash(case2));
  });

  it('应返回有效的 SHA-256 十六进制字符串', () => {
    const testCase = createTestCase();
    const hash = computeContentHash(testCase);

    // 验证是合法的十六进制字符串
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('custom 字段不影响哈希计算', () => {
    const case1 = createTestCase({ custom: false });
    const case2 = createTestCase({ custom: true });

    // 相同内容应产生相同哈希，custom 字段不参与哈希
    expect(computeContentHash(case1)).toBe(computeContentHash(case2));
  });
});

describe('detectConflicts', () => {
  it('AC-003-2: 系统用例内容被修改时应标记为冲突', () => {
    const currentCases = [
      createTestCase({
        id: 'case-001',
        prompt: 'modified prompt',
        pass_criteria: 'modified criteria',
        custom: false,
      }),
    ];

    // 原始哈希是基于原始内容计算的
    const originalCase = createTestCase({
      id: 'case-001',
      prompt: 'original prompt',
      pass_criteria: 'original criteria',
    });
    const originalHashes = new Map<string, string>();
    originalHashes.set('case-001', computeContentHash(originalCase));

    const conflicts = detectConflicts(currentCases, originalHashes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].caseId).toBe('case-001');
    expect(conflicts[0].isConflict).toBe(true);
    expect(conflicts[0].currentHash).not.toBe(conflicts[0].originalHash);
  });

  it('系统用例内容未修改时不应标记为冲突', () => {
    const testCase = createTestCase({ id: 'case-001' });
    const currentCases = [testCase];

    const originalHashes = new Map<string, string>();
    originalHashes.set('case-001', computeContentHash(testCase));

    const conflicts = detectConflicts(currentCases, originalHashes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].isConflict).toBe(false);
    expect(conflicts[0].currentHash).toBe(conflicts[0].originalHash);
  });

  it('AC-003-1: custom=true 的用例应被跳过，不返回冲突信息', () => {
    const currentCases = [
      createTestCase({
        id: 'case-custom-001',
        prompt: 'user custom prompt',
        pass_criteria: 'user custom criteria',
        custom: true,
      }),
    ];

    // 即使提供了原始哈希，custom 用例也应被跳过
    const originalHashes = new Map<string, string>();
    originalHashes.set('case-custom-001', 'some-original-hash');

    const conflicts = detectConflicts(currentCases, originalHashes);

    expect(conflicts).toHaveLength(0);
  });

  it('没有原始哈希记录的系统用例不应标记为冲突', () => {
    const currentCases = [
      createTestCase({ id: 'case-new', custom: false }),
    ];

    const originalHashes = new Map<string, string>();
    // 不添加 case-new 的原始哈希

    const conflicts = detectConflicts(currentCases, originalHashes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].caseId).toBe('case-new');
    expect(conflicts[0].isConflict).toBe(false);
    expect(conflicts[0].originalHash).toBe('');
  });

  it('混合场景：同时包含冲突、无冲突、custom 用例', () => {
    const originalCase = createTestCase({
      id: 'case-modified',
      prompt: 'original prompt',
      pass_criteria: 'original criteria',
    });

    const currentCases = [
      // 冲突用例：系统用例被修改
      createTestCase({
        id: 'case-modified',
        prompt: 'modified prompt',
        pass_criteria: 'modified criteria',
        custom: false,
      }),
      // 无冲突用例：系统用例未修改
      createTestCase({
        id: 'case-unchanged',
        prompt: 'stable prompt',
        pass_criteria: 'stable criteria',
        custom: false,
      }),
      // custom 用例：应被跳过
      createTestCase({
        id: 'case-custom',
        prompt: 'custom prompt',
        pass_criteria: 'custom criteria',
        custom: true,
      }),
    ];

    const originalHashes = new Map<string, string>();
    originalHashes.set('case-modified', computeContentHash(originalCase));
    originalHashes.set(
      'case-unchanged',
      computeContentHash(currentCases[1])
    );

    const conflicts = detectConflicts(currentCases, originalHashes);

    // custom 用例被跳过，所以只有 2 条结果
    expect(conflicts).toHaveLength(2);

    const modifiedConflict = conflicts.find((c) => c.caseId === 'case-modified');
    const unchangedConflict = conflicts.find((c) => c.caseId === 'case-unchanged');

    expect(modifiedConflict).toBeDefined();
    expect(modifiedConflict!.isConflict).toBe(true);

    expect(unchangedConflict).toBeDefined();
    expect(unchangedConflict!.isConflict).toBe(false);
  });

  it('空用例列表应返回空结果', () => {
    const originalHashes = new Map<string, string>();
    const conflicts = detectConflicts([], originalHashes);

    expect(conflicts).toHaveLength(0);
  });

  it('空的原始哈希映射时，所有系统用例均无冲突', () => {
    const currentCases = [
      createTestCase({ id: 'case-001', custom: false }),
      createTestCase({ id: 'case-002', custom: false }),
    ];

    const originalHashes = new Map<string, string>();

    const conflicts = detectConflicts(currentCases, originalHashes);

    expect(conflicts).toHaveLength(2);
    expect(conflicts.every((c) => !c.isConflict)).toBe(true);
  });
});
