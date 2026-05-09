import { SkillAnchor } from '../types/skill.js';
import { TestCase } from '../types/test-case.js';

/**
 * 基于 SkillAnchor 生成上下文/噪声调用用例（3-4 条，should_trigger=true）
 * 上下文用例在核心需求基础上附加业务上下文或无关细节
 */
export function generateContextCases(anchor: SkillAnchor): TestCase[] {
  const cases: TestCase[] = [];
  const skillName = anchor.name || 'unknown-skill';
  const description = anchor.description || '';
  const whenToUse = anchor.whenToUse || '';
  const definitionOfDone = anchor.definitionOfDone || '功能按预期工作';

  // 上下文用例 1: 带业务上下文的调用
  cases.push({
    id: `${skillName}-context-1`,
    should_trigger: true,
    prompt: `我在处理一个业务项目，需要${description || '完成一个任务'}。具体来说，${whenToUse.split('\n')[0]?.trim() || '请帮我处理'}`,
    pass_criteria: definitionOfDone,
    custom: false,
    deprecated: false,
  });

  // 上下文用例 2: 带无关细节的调用
  cases.push({
    id: `${skillName}-context-2`,
    should_trigger: true,
    prompt: `今天是周一，我刚开完会。现在需要${description || '完成一个任务'}。另外，下午还有一个代码审查。`,
    pass_criteria: definitionOfDone,
    custom: false,
    deprecated: false,
  });

  // 上下文用例 3: 带技术栈上下文的调用
  cases.push({
    id: `${skillName}-context-3`,
    should_trigger: true,
    prompt: `我们正在使用 TypeScript 和 React 构建一个应用，需要${description || '完成一个任务'}。项目使用了 ESLint 和 Prettier。`,
    pass_criteria: definitionOfDone,
    custom: false,
    deprecated: false,
  });

  // 上下文用例 4: 带多步骤上下文的调用
  if (whenToUse) {
    const useLines = whenToUse.split('\n').filter(line => line.trim());
    if (useLines.length > 0) {
      cases.push({
        id: `${skillName}-context-4`,
        should_trigger: true,
        prompt: `首先我需要了解${useLines[0].trim()}。然后，${description || '继续处理任务'}。最后，请确保所有步骤都完成。`,
        pass_criteria: definitionOfDone,
        custom: false,
        deprecated: false,
      });
    }
  }

  return cases.slice(0, 4); // 最多 4 条
}

/**
 * 基于 SkillAnchor 生成负例控制用例（3-4 条，should_trigger=false）
 * 负例用例基于 whenNotToUse 生成关键词重叠但需求不符的场景
 */
export function generateNegativeCases(anchor: SkillAnchor): TestCase[] {
  const cases: TestCase[] = [];
  const skillName = anchor.name || 'unknown-skill';
  const whenNotToUse = anchor.whenNotToUse || '';
  const description = anchor.description || '';

  // 负例用例 1: 与 whenNotToUse 直接冲突的场景
  if (whenNotToUse) {
    const notUseLines = whenNotToUse.split('\n').filter(line => line.trim());
    if (notUseLines.length > 0) {
      cases.push({
        id: `${skillName}-negative-1`,
        should_trigger: false,
        prompt: `我需要${notUseLines[0].trim()}，请帮我处理`,
        pass_criteria: 'Skill 不应被触发; 场景与 whenNotToUse 冲突',
        custom: false,
        deprecated: false,
      });
    }
  }

  // 负例用例 2: 与技能描述无关的场景
  cases.push({
    id: `${skillName}-negative-2`,
    should_trigger: false,
    prompt: `我想学习如何做蛋糕，请给我推荐一个食谱`,
    pass_criteria: 'Skill 不应被触发; 与技能描述无关',
    custom: false,
    deprecated: false,
  });

  // 负例用例 3: 反向意图场景
  cases.push({
    id: `${skillName}-negative-3`,
    should_trigger: false,
    prompt: `请帮我避免使用${description || '这个技能'}，我想找其他替代方案`,
    pass_criteria: 'Skill 不应被触发; 用户明确表示不想使用该技能',
    custom: false,
    deprecated: false,
  });

  // 负例用例 4: 模糊不清的场景
  cases.push({
    id: `${skillName}-negative-4`,
    should_trigger: false,
    prompt: `随便做点什么`,
    pass_criteria: 'Skill 不应被触发; 需求过于模糊，无法匹配技能范围',
    custom: false,
    deprecated: false,
  });

  return cases.slice(0, 4); // 最多 4 条
}
