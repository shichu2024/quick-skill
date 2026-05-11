import { TestCase } from '../types/test-case.js';
import { CaseImpact } from '../types/impact.js';

/**
 * 用例停用结果
 */
export interface DeprecationResult {
  /** 被停用的用例 id 列表 */
  deprecatedCaseIds: string[];
  /** 包含已标记 deprecated 的完整用例列表（不物理删除） */
  remainingCases: TestCase[];
}

/**
 * 用例类型与 ID 前缀的映射关系。
 * 通过用例 id 中的类型标识（如 "-implicit-"、"-context-"）判断用例归属类型。
 */
const CASE_TYPE_PREFIX_MAP: Record<string, string[]> = {
  implicit: ['-implicit-'],
  context: ['-context-'],
  negative: ['-negative-'],
  explicit: ['-explicit-'],
};

/**
 * 根据影响映射结果，将对应的用例标记为 deprecated=true。
 *
 * 停用规则：
 * - whenToUse 场景删除 -> 对应 implicit/context 用例 deprecated=true
 * - whenNotToUse 场景删除 -> 对应 negative 用例 deprecated=true
 *
 * 不物理删除用例，保留在 CSV 中。
 * custom=true 的用例不受停用影响（用户自定义保护）。
 *
 * @param cases 当前所有用例列表
 * @param impacts 影响映射结果（来自 mapChangesToImpacts）
 * @returns 停用结果，包含被停用的用例 id 和完整的用例列表
 */
export function deprecateCases(cases: TestCase[], impacts: CaseImpact[]): DeprecationResult {
  // 筛选出 action 为 deprecate 的影响项
  const deprecateImpacts = impacts.filter((impact) => impact.action === 'deprecate');

  // 如果没有停用类型的影响，直接返回原样
  if (deprecateImpacts.length === 0) {
    return {
      deprecatedCaseIds: [],
      remainingCases: cases,
    };
  }

  // 收集需要停用的用例类型
  const typesToDeprecate = new Set<string>();
  for (const impact of deprecateImpacts) {
    typesToDeprecate.add(impact.affectedCaseType);
  }

  // 标记匹配的用例为 deprecated，同时收集被停用的用例 id
  const deprecatedCaseIdsSet = new Set<string>();
  const remainingCases = cases.map((testCase) => {
    // custom=true 的用例不受停用影响
    if (testCase.custom) {
      return testCase;
    }

    // 已停用的用例保持 deprecated=true
    if (testCase.deprecated) {
      deprecatedCaseIdsSet.add(testCase.id);
      return testCase;
    }

    // 检查当前用例是否匹配需要停用的类型
    const caseType = getCaseTypeFromId(testCase.id);
    if (caseType && typesToDeprecate.has(caseType)) {
      deprecatedCaseIdsSet.add(testCase.id);
      return { ...testCase, deprecated: true };
    }

    return testCase;
  });

  return {
    deprecatedCaseIds: Array.from(deprecatedCaseIdsSet),
    remainingCases,
  };
}

/**
 * 根据用例 id 推断其类型。
 * 通过匹配 ID 中的类型标识前缀（如 "-implicit-"、"-context-"、"-negative-"、"-explicit-"）来判断。
 *
 * @param caseId 用例 id
 * @returns 用例类型，无法识别时返回 undefined
 */
function getCaseTypeFromId(caseId: string): string | undefined {
  for (const [caseType, prefixes] of Object.entries(CASE_TYPE_PREFIX_MAP)) {
    for (const prefix of prefixes) {
      if (caseId.includes(prefix)) {
        return caseType;
      }
    }
  }
  return undefined;
}
