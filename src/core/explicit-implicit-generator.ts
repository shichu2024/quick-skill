import { SkillAnchor } from '../types/skill.js';
import { TestCase } from '../types/test-case.js';

/**
 * 基于 SkillAnchor 生成显式调用用例（2-3 条）
 * 显式调用用例 prompt 包含 `$+技能名` 格式
 */
export function generateExplicitCases(anchor: SkillAnchor): TestCase[] {
  const cases: TestCase[] = [];
  const skillName = anchor.name || 'unknown-skill';
  const description = anchor.description || '';
  const whenToUse = anchor.whenToUse || '';
  const definitionOfDone = anchor.definitionOfDone || '功能按预期工作';

  // 显式用例 1: 直接调用
  cases.push({
    id: `${skillName}-explicit-1`,
    should_trigger: true,
    prompt: `$${skillName}`,
    pass_criteria: definitionOfDone,
    custom: false,
    deprecated: false,
  });

  // 显式用例 2: 带简单描述的调用
  cases.push({
    id: `${skillName}-explicit-2`,
    should_trigger: true,
    prompt: `$${skillName} ${description.substring(0, 50) || '执行任务'}`,
    pass_criteria: definitionOfDone,
    custom: false,
    deprecated: false,
  });

  // 显式用例 3: 基于 whenToUse 的场景调用（如果有）
  if (whenToUse) {
    const useCase = whenToUse.split('\n')[0].trim();
    cases.push({
      id: `${skillName}-explicit-3`,
      should_trigger: true,
      prompt: `$${skillName} ${useCase.substring(0, 80)}`,
      pass_criteria: definitionOfDone,
      custom: false,
      deprecated: false,
    });
  }

  return cases.slice(0, 3); // 最多 3 条
}

/**
 * 基于 SkillAnchor 生成隐式调用用例（3-4 条）
 * 隐式调用用例 prompt 使用自然语言描述场景，不提及技能名
 */
export function generateImplicitCases(anchor: SkillAnchor): TestCase[] {
  const cases: TestCase[] = [];
  const skillName = anchor.name || 'unknown-skill';
  const description = anchor.description || '';
  const whenToUse = anchor.whenToUse || '';
  const whatToBuild = anchor.whatToBuild || '';
  const definitionOfDone = anchor.definitionOfDone || '功能按预期工作';

  // 隐式用例 1: 基于 description 的自然语言场景
  cases.push({
    id: `${skillName}-implicit-1`,
    should_trigger: true,
    prompt: `我需要${description || '完成一个任务'}`,
    pass_criteria: definitionOfDone,
    custom: false,
    deprecated: false,
  });

  // 隐式用例 2: 基于 whenToUse 的场景
  if (whenToUse) {
    const useCases = whenToUse.split('\n').filter(line => line.trim());
    if (useCases.length > 0) {
      cases.push({
        id: `${skillName}-implicit-2`,
        should_trigger: true,
        prompt: `当${useCases[0].trim()}时，我该怎么办？`,
        pass_criteria: definitionOfDone,
        custom: false,
        deprecated: false,
      });
    }
  }

  // 隐式用例 3: 基于 whatToBuild 的场景
  if (whatToBuild) {
    cases.push({
      id: `${skillName}-implicit-3`,
      should_trigger: true,
      prompt: `请帮我${whatToBuild.substring(0, 100)}`,
      pass_criteria: definitionOfDone,
      custom: false,
      deprecated: false,
    });
  }

  // 隐式用例 4: 组合场景
  if (whenToUse && description) {
    cases.push({
      id: `${skillName}-implicit-4`,
      should_trigger: true,
      prompt: `在处理${description.substring(0, 50)}时，${whenToUse.split('\n')[0].trim()}`,
      pass_criteria: definitionOfDone,
      custom: false,
      deprecated: false,
    });
  }

  return cases.slice(0, 4); // 最多 4 条
}
