import { describe, it, expect } from 'vitest';
import { deprecateCases } from '../../../src/core/case-deprecator.js';
import { TestCase } from '../../../src/types/test-case.js';
import { CaseImpact } from '../../../src/types/impact.js';

describe('deprecateCases', () => {
  // 辅助函数：创建测试用 TestCase
  function makeCase(
    id: string,
    type: 'explicit' | 'implicit' | 'context' | 'negative',
    overrides: Partial<TestCase> = {}
  ): TestCase {
    return {
      id,
      should_trigger: type !== 'negative',
      prompt: `测试 prompt for ${id}`,
      pass_criteria: '测试标准',
      custom: false,
      deprecated: false,
      ...overrides,
    };
  }

  // 辅助函数：创建 CaseImpact
  function makeImpact(
    affectedCaseType: CaseImpact['affectedCaseType'],
    action: CaseImpact['action'],
    reason: string,
    relatedSection: string
  ): CaseImpact {
    return {
      affectedCaseType,
      action,
      reason,
      relatedSection,
    };
  }

  // ============================================================
  // AC-004-1: whenToUse 场景删除时，对应 implicit/context 用例标记 deprecated=true
  // ============================================================
  describe('AC-004-1: whenToUse 删除 -> implicit/context 用例停用', () => {
    it('whenToUse 删除时应停用对应的 implicit 用例', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
        makeCase('test-implicit-2', 'implicit'),
        makeCase('test-explicit-1', 'explicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除: 场景 A', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      // implicit 用例应被标记为 deprecated
      const deprecatedImplicit = result.remainingCases.filter(
        (c) => c.id.includes('-implicit-') && c.deprecated
      );
      expect(deprecatedImplicit.length).toBeGreaterThan(0);

      // 停用的用例 id 应在 deprecatedCaseIds 中
      deprecatedImplicit.forEach((c) => {
        expect(result.deprecatedCaseIds).toContain(c.id);
      });

      // explicit 用例不应被停用
      const explicitCase = result.remainingCases.find((c) => c.id === 'test-explicit-1');
      expect(explicitCase?.deprecated).toBe(false);
    });

    it('whenToUse 删除时应停用对应的 context 用例', () => {
      const cases: TestCase[] = [
        makeCase('test-context-1', 'context'),
        makeCase('test-context-2', 'context'),
        makeCase('test-explicit-1', 'explicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('context', 'deprecate', 'whenToUse 场景删除: 场景 B', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      const deprecatedContext = result.remainingCases.filter(
        (c) => c.id.includes('-context-') && c.deprecated
      );
      expect(deprecatedContext.length).toBeGreaterThan(0);

      deprecatedContext.forEach((c) => {
        expect(result.deprecatedCaseIds).toContain(c.id);
      });

      // explicit 用例不应被停用
      const explicitCase = result.remainingCases.find((c) => c.id === 'test-explicit-1');
      expect(explicitCase?.deprecated).toBe(false);
    });

    it('whenToUse 删除时应同时停用 implicit 和 context 用例', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
        makeCase('test-context-1', 'context'),
        makeCase('test-explicit-1', 'explicit'),
        makeCase('test-negative-1', 'negative'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
        makeImpact('context', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      const deprecatedImplicit = result.remainingCases.filter(
        (c) => c.id.includes('-implicit-') && c.deprecated
      );
      const deprecatedContext = result.remainingCases.filter(
        (c) => c.id.includes('-context-') && c.deprecated
      );

      expect(deprecatedImplicit.length).toBe(1);
      expect(deprecatedContext.length).toBe(1);

      // explicit 和 negative 用例不应被停用
      expect(result.remainingCases.find((c) => c.id === 'test-explicit-1')?.deprecated).toBe(false);
      expect(result.remainingCases.find((c) => c.id === 'test-negative-1')?.deprecated).toBe(false);
    });
  });

  // ============================================================
  // AC-004-2: whenNotToUse 场景删除时，对应 negative 用例标记 deprecated=true
  // ============================================================
  describe('AC-004-2: whenNotToUse 删除 -> negative 用例停用', () => {
    it('whenNotToUse 删除时应停用对应的 negative 用例', () => {
      const cases: TestCase[] = [
        makeCase('test-negative-1', 'negative'),
        makeCase('test-negative-2', 'negative'),
        makeCase('test-implicit-1', 'implicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('negative', 'deprecate', 'whenNotToUse 场景删除: 禁止场景 X', 'whenNotToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      const deprecatedNegative = result.remainingCases.filter(
        (c) => c.id.includes('-negative-') && c.deprecated
      );
      expect(deprecatedNegative.length).toBeGreaterThan(0);

      deprecatedNegative.forEach((c) => {
        expect(result.deprecatedCaseIds).toContain(c.id);
      });

      // implicit 用例不应被停用
      expect(result.remainingCases.find((c) => c.id === 'test-implicit-1')?.deprecated).toBe(false);
    });
  });

  // ============================================================
  // AC-004-3: 停用操作不物理删除用例行
  // ============================================================
  describe('AC-004-3: 停用操作不物理删除用例行', () => {
    it('停用后 remainingCases 数量应与输入 cases 数量一致', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
        makeCase('test-context-1', 'context'),
        makeCase('test-negative-1', 'negative'),
        makeCase('test-explicit-1', 'explicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
        makeImpact('negative', 'deprecate', 'whenNotToUse 场景删除', 'whenNotToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      // remainingCases 数量应与输入一致，不物理删除
      expect(result.remainingCases).toHaveLength(cases.length);
    });

    it('已停用的用例仍保留在 remainingCases 中，只是 deprecated=true', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      const deprecatedCase = result.remainingCases.find((c) => c.id === 'test-implicit-1');
      expect(deprecatedCase).toBeDefined();
      expect(deprecatedCase?.deprecated).toBe(true);
    });
  });

  // ============================================================
  // 无停用场景
  // ============================================================
  describe('无停用场景', () => {
    it('无 deprecate 类型的 impact 时，不应停用任何用例', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
        makeCase('test-negative-1', 'negative'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('explicit', 'update', 'name 变更', 'name'),
        makeImpact('implicit', 'add', 'whenToUse 新增', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      expect(result.deprecatedCaseIds).toHaveLength(0);
      expect(result.remainingCases.every((c) => !c.deprecated)).toBe(true);
    });

    it('空 impact 列表时，不应停用任何用例', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
      ];

      const result = deprecateCases(cases, []);

      expect(result.deprecatedCaseIds).toHaveLength(0);
      expect(result.remainingCases).toHaveLength(1);
      expect(result.remainingCases[0].deprecated).toBe(false);
    });

    it('空 cases 列表时，应返回空结果', () => {
      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
      ];

      const result = deprecateCases([], impacts);

      expect(result.deprecatedCaseIds).toHaveLength(0);
      expect(result.remainingCases).toHaveLength(0);
    });
  });

  // ============================================================
  // 多场景删除
  // ============================================================
  describe('多场景删除', () => {
    it('多个 deprecate impact 时应停用所有匹配用例', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
        makeCase('test-implicit-2', 'implicit'),
        makeCase('test-context-1', 'context'),
        makeCase('test-negative-1', 'negative'),
        makeCase('test-negative-2', 'negative'),
        makeCase('test-explicit-1', 'explicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景 A 删除', 'whenToUse'),
        makeImpact('context', 'deprecate', 'whenToUse 场景 B 删除', 'whenToUse'),
        makeImpact('negative', 'deprecate', 'whenNotToUse 场景 C 删除', 'whenNotToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      expect(result.deprecatedCaseIds).toHaveLength(5);
      expect(result.remainingCases).toHaveLength(6);

      // 只有 explicit 用例未被停用
      const nonDeprecated = result.remainingCases.filter((c) => !c.deprecated);
      expect(nonDeprecated).toHaveLength(1);
      expect(nonDeprecated[0].id).toBe('test-explicit-1');
    });

    it('重复的 deprecate impact 不应导致重复标记', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景 A 删除', 'whenToUse'),
        makeImpact('implicit', 'deprecate', 'whenToUse 场景 A 删除', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      expect(result.deprecatedCaseIds).toHaveLength(1);
      expect(result.deprecatedCaseIds[0]).toBe('test-implicit-1');
    });
  });

  // ============================================================
  // custom 用例保护
  // ============================================================
  describe('custom 用例保护', () => {
    it('custom=true 的用例不应被停用', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit'),
        makeCase('custom-implicit-1', 'implicit', { custom: true }),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      // 系统生成的 implicit 用例应被停用
      const systemCase = result.remainingCases.find((c) => c.id === 'test-implicit-1');
      expect(systemCase?.deprecated).toBe(true);

      // custom 用例不应被停用
      const customCase = result.remainingCases.find((c) => c.id === 'custom-implicit-1');
      expect(customCase?.deprecated).toBe(false);
    });
  });

  // ============================================================
  // 已停用用例
  // ============================================================
  describe('已停用用例', () => {
    it('已停用的用例应保持 deprecated=true', () => {
      const cases: TestCase[] = [
        makeCase('test-implicit-1', 'implicit', { deprecated: true }),
        makeCase('test-implicit-2', 'implicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      const previouslyDeprecated = result.remainingCases.find((c) => c.id === 'test-implicit-1');
      expect(previouslyDeprecated?.deprecated).toBe(true);

      const newlyDeprecated = result.remainingCases.find((c) => c.id === 'test-implicit-2');
      expect(newlyDeprecated?.deprecated).toBe(true);

      expect(result.deprecatedCaseIds).toContain('test-implicit-1');
      expect(result.deprecatedCaseIds).toContain('test-implicit-2');
    });
  });

  // ============================================================
  // AC-004-5: deprecatedCaseIds 应包含所有被停用的用例 id
  // ============================================================
  describe('AC-004-5: deprecatedCaseIds 完整性', () => {
    it('应准确列出所有被停用的用例 id', () => {
      const cases: TestCase[] = [
        makeCase('skill-a-implicit-1', 'implicit'),
        makeCase('skill-a-context-1', 'context'),
        makeCase('skill-a-negative-1', 'negative'),
        makeCase('skill-a-explicit-1', 'explicit'),
      ];

      const impacts: CaseImpact[] = [
        makeImpact('implicit', 'deprecate', 'whenToUse 场景删除', 'whenToUse'),
        makeImpact('negative', 'deprecate', 'whenNotToUse 场景删除', 'whenNotToUse'),
      ];

      const result = deprecateCases(cases, impacts);

      expect(result.deprecatedCaseIds).toContain('skill-a-implicit-1');
      expect(result.deprecatedCaseIds).toContain('skill-a-negative-1');
      expect(result.deprecatedCaseIds).not.toContain('skill-a-context-1');
      expect(result.deprecatedCaseIds).not.toContain('skill-a-explicit-1');
      expect(result.deprecatedCaseIds).toHaveLength(2);
    });
  });
});
