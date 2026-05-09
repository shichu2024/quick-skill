import { describe, it, expect } from 'vitest';
import { generateExplicitCases, generateImplicitCases } from '../../../src/core/explicit-implicit-generator.js';
import { SkillAnchor } from '../../../src/types/skill.js';

const sampleAnchor: SkillAnchor = {
  name: 'test-skill',
  description: 'A test skill for validation',
  whenToUse: 'When you need to test parsing\nOr when validating markdown sections',
  whenNotToUse: 'Never use this in production',
  definitionOfDone: 'All tests pass; Code is reviewed',
  whatToBuild: 'A CLI tool that parses SKILL.md files',
};

describe('generateExplicitCases', () => {
  it('AC-002-1: 生成 2-3 条显式调用用例', () => {
    const cases = generateExplicitCases(sampleAnchor);
    expect(cases.length).toBeGreaterThanOrEqual(2);
    expect(cases.length).toBeLessThanOrEqual(3);
  });

  it('所有显式用例 should_trigger=true', () => {
    const cases = generateExplicitCases(sampleAnchor);
    cases.forEach(c => expect(c.should_trigger).toBe(true));
  });

  it('prompt 包含 $+技能名 格式', () => {
    const cases = generateExplicitCases(sampleAnchor);
    cases.forEach(c => expect(c.prompt).toContain('$test-skill'));
  });

  it('id 格式正确: {skill-name}-explicit-{序号}', () => {
    const cases = generateExplicitCases(sampleAnchor);
    cases.forEach((c, i) => {
      expect(c.id).toBe(`test-skill-explicit-${i + 1}`);
    });
  });

  it('pass_criteria 使用 definitionOfDone', () => {
    const cases = generateExplicitCases(sampleAnchor);
    cases.forEach(c => {
      expect(c.pass_criteria).toContain('All tests pass');
    });
  });

  it('custom 和 deprecated 均为 false', () => {
    const cases = generateExplicitCases(sampleAnchor);
    cases.forEach(c => {
      expect(c.custom).toBe(false);
      expect(c.deprecated).toBe(false);
    });
  });

  it('缺少 definitionOfDone 时使用默认值', () => {
    const anchorWithoutDone: SkillAnchor = {
      ...sampleAnchor,
      definitionOfDone: '',
    };
    const cases = generateExplicitCases(anchorWithoutDone);
    expect(cases[0].pass_criteria).toBe('功能按预期工作');
  });

  it('缺少 whenToUse 时生成 2 条显式用例', () => {
    const anchorWithoutUse: SkillAnchor = {
      ...sampleAnchor,
      whenToUse: '',
    };
    const cases = generateExplicitCases(anchorWithoutUse);
    expect(cases.length).toBe(2);
  });
});

describe('generateImplicitCases', () => {
  it('AC-002-2: 生成 3-4 条隐式调用用例', () => {
    const cases = generateImplicitCases(sampleAnchor);
    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(cases.length).toBeLessThanOrEqual(4);
  });

  it('所有隐式用例 should_trigger=true', () => {
    const cases = generateImplicitCases(sampleAnchor);
    cases.forEach(c => expect(c.should_trigger).toBe(true));
  });

  it('prompt 不提及技能名', () => {
    const cases = generateImplicitCases(sampleAnchor);
    cases.forEach(c => {
      expect(c.prompt.toLowerCase()).not.toContain('test-skill');
      expect(c.prompt).not.toContain('$');
    });
  });

  it('id 格式正确: {skill-name}-implicit-{序号}', () => {
    const cases = generateImplicitCases(sampleAnchor);
    cases.forEach((c, i) => {
      expect(c.id).toBe(`test-skill-implicit-${i + 1}`);
    });
  });

  it('基于 description 生成自然语言场景', () => {
    const cases = generateImplicitCases(sampleAnchor);
    expect(cases[0].prompt).toContain('我需要');
    expect(cases[0].prompt).toContain('test skill');
  });

  it('基于 whenToUse 生成场景', () => {
    const cases = generateImplicitCases(sampleAnchor);
    const hasWhenToUseCase = cases.some(c => c.prompt.includes('当') && c.prompt.includes('时'));
    expect(hasWhenToUseCase).toBe(true);
  });

  it('基于 whatToBuild 生成场景', () => {
    const cases = generateImplicitCases(sampleAnchor);
    const hasWhatToBuildCase = cases.some(c => c.prompt.includes('请帮我'));
    expect(hasWhatToBuildCase).toBe(true);
  });

  it('缺少 whatToBuild 时生成 3 条隐式用例', () => {
    const anchorWithoutBuild: SkillAnchor = {
      ...sampleAnchor,
      whatToBuild: '',
    };
    const cases = generateImplicitCases(anchorWithoutBuild);
    expect(cases.length).toBe(3);
  });

  it('缺少 whenToUse 时仍能生成用例', () => {
    const anchorWithoutUse: SkillAnchor = {
      ...sampleAnchor,
      whenToUse: '',
    };
    const cases = generateImplicitCases(anchorWithoutUse);
    expect(cases.length).toBeGreaterThanOrEqual(2);
  });
});
