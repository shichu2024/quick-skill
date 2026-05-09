import { describe, it, expect } from 'vitest';
import { generateContextCases, generateNegativeCases } from '../../../src/core/context-negative-generator.js';
import { SkillAnchor } from '../../../src/types/skill.js';

const sampleAnchor: SkillAnchor = {
  name: 'test-skill',
  description: 'A test skill for validation',
  whenToUse: 'When you need to test parsing\nOr when validating markdown sections',
  whenNotToUse: 'Never use this in production\nOr when the input is invalid',
  definitionOfDone: 'All tests pass; Code is reviewed',
  whatToBuild: 'A CLI tool that parses SKILL.md files',
};

describe('generateContextCases', () => {
  it('AC-002-3: 生成 3-4 条上下文调用用例', () => {
    const cases = generateContextCases(sampleAnchor);
    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(cases.length).toBeLessThanOrEqual(4);
  });

  it('所有上下文用例 should_trigger=true', () => {
    const cases = generateContextCases(sampleAnchor);
    cases.forEach(c => expect(c.should_trigger).toBe(true));
  });

  it('prompt 包含业务上下文或无关细节', () => {
    const cases = generateContextCases(sampleAnchor);
    const hasContext = cases.some(c =>
      c.prompt.includes('业务') ||
      c.prompt.includes('周一') ||
      c.prompt.includes('TypeScript') ||
      c.prompt.includes('首先')
    );
    expect(hasContext).toBe(true);
  });

  it('id 格式正确: {skill-name}-context-{序号}', () => {
    const cases = generateContextCases(sampleAnchor);
    cases.forEach((c, i) => {
      expect(c.id).toBe(`test-skill-context-${i + 1}`);
    });
  });

  it('pass_criteria 使用 definitionOfDone', () => {
    const cases = generateContextCases(sampleAnchor);
    cases.forEach(c => {
      expect(c.pass_criteria).toContain('All tests pass');
    });
  });

  it('custom 和 deprecated 均为 false', () => {
    const cases = generateContextCases(sampleAnchor);
    cases.forEach(c => {
      expect(c.custom).toBe(false);
      expect(c.deprecated).toBe(false);
    });
  });

  it('缺少 whenToUse 时仍能生成用例', () => {
    const anchorWithoutUse: SkillAnchor = {
      ...sampleAnchor,
      whenToUse: '',
    };
    const cases = generateContextCases(anchorWithoutUse);
    expect(cases.length).toBeGreaterThanOrEqual(3);
  });
});

describe('generateNegativeCases', () => {
  it('AC-002-4: 生成 3-4 条负例控制用例', () => {
    const cases = generateNegativeCases(sampleAnchor);
    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(cases.length).toBeLessThanOrEqual(4);
  });

  it('所有负例用例 should_trigger=false', () => {
    const cases = generateNegativeCases(sampleAnchor);
    cases.forEach(c => expect(c.should_trigger).toBe(false));
  });

  it('pass_criteria 包含 "Skill 不应被触发"', () => {
    const cases = generateNegativeCases(sampleAnchor);
    cases.forEach(c => {
      expect(c.pass_criteria).toContain('Skill 不应被触发');
    });
  });

  it('id 格式正确: {skill-name}-negative-{序号}', () => {
    const cases = generateNegativeCases(sampleAnchor);
    cases.forEach((c, i) => {
      expect(c.id).toBe(`test-skill-negative-${i + 1}`);
    });
  });

  it('AC-002-5: 负例与 whenNotToUse 关键词重叠', () => {
    const cases = generateNegativeCases(sampleAnchor);
    const hasOverlap = cases.some(c =>
      c.prompt.toLowerCase().includes('production') ||
      c.prompt.toLowerCase().includes('invalid')
    );
    expect(hasOverlap).toBe(true);
  });

  it('AC-002-6: 负例包含无关场景', () => {
    const cases = generateNegativeCases(sampleAnchor);
    const hasUnrelated = cases.some(c =>
      c.prompt.includes('蛋糕') ||
      c.prompt.includes('食谱')
    );
    expect(hasUnrelated).toBe(true);
  });

  it('AC-002-7: 负例包含反向意图场景', () => {
    const cases = generateNegativeCases(sampleAnchor);
    const hasReverse = cases.some(c =>
      c.prompt.includes('避免') ||
      c.prompt.includes('替代')
    );
    expect(hasReverse).toBe(true);
  });

  it('AC-002-8: 负例包含模糊场景', () => {
    const cases = generateNegativeCases(sampleAnchor);
    const hasVague = cases.some(c =>
      c.prompt.includes('随便')
    );
    expect(hasVague).toBe(true);
  });

  it('缺少 whenNotToUse 时仍能生成负例', () => {
    const anchorWithoutNotUse: SkillAnchor = {
      ...sampleAnchor,
      whenNotToUse: '',
    };
    const cases = generateNegativeCases(anchorWithoutNotUse);
    expect(cases.length).toBeGreaterThanOrEqual(3);
  });
});
