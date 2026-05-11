import type { ConstraintType, ParsedConstraint } from '../types/constraint.js';
import { CONSTRAINT_SECTION_MAP } from '../types/constraint.js';

/**
 * 各约束类型的关键词规则（中英文混合支持）
 * 采用关键词 + 结构规则的确定性分类，不调用 LLM
 */
const KEYWORD_RULES: Record<ConstraintType, RegExp[]> = {
  // 正向触发：描述何时可以使用该技能
  'positive-trigger': [
    /当.*时/i,            // "当...时" 结构
    /当.*需要/i,          // "当...需要" 结构
    /如果/i,              // "如果" 条件
    /适用/i,              // "适用" / "适用于"
    /可使用/i,            // "可使用"
    /场景/i,              // "场景"
    /\bwhen\b/i,          // "when" 英文
    /\buse this\b/i,      // "use this" 英文
    /\bapplicable\b/i,    // "applicable" 英文
    /\bshould use\b/i,    // "should use" 英文
    /需要.*时/i,          // "需要...时" 结构
  ],

  // 负向禁止：描述何时不应使用该技能
  'negative-prohibition': [
    /禁止/i,              // "禁止"
    /不要/i,              // "不要"
    /不能/i,              // "不能"
    /避免/i,              // "避免"
    /不应/i,              // "不应"
    /不可/i,              // "不可"
    /\bnever\b/i,         // "never" 英文
    /\bdon't\b/i,         // "don't" 英文
    /\bdo not\b/i,        // "do not" 英文
    /\bavoid\b/i,         // "avoid" 英文
    /\bshould not\b/i,    // "should not" 英文
    /\bmust not\b/i,      // "must not" 英文
    /\bforbidden\b/i,     // "forbidden" 英文
    /\bprohibit/i,        // "prohibit/prohibited" 英文
  ],

  // 成功标准：描述完成的标准或必须达到的结果
  'success-criteria': [
    /必须.*产出/i,        // "必须...产出" 结构
    /确保/i,              // "确保"
    /验证/i,              // "验证"
    /标准/i,              // "标准"
    /完成/i,              // "完成"
    /产出/i,              // "产出"
    /通过.*测试/i,        // "通过...测试" 结构
    /\bmust\b/i,          // "must" 英文
    /\bensure\b/i,        // "ensure" 英文
    /\bverify\b/i,        // "verify" 英文
    /\bdone\b/i,          // "done" 英文
    /\bcriteria\b/i,      // "criteria" 英文
    /\bshould produce\b/i, // "should produce" 英文
    /\bresult\b/i,        // "result" 英文
    /测试通过/i,          // "测试通过"
  ],

  // 执行流程：描述构建步骤、流程或工具选择
  'execution-flow': [
    /步骤/i,              // "步骤"
    /流程/i,              // "流程"
    /先.*然后/i,          // "先...然后" 顺序结构
    /先.*再/i,            // "先...再" 顺序结构
    /构建/i,              // "构建"
    /部署/i,              // "部署"
    /运行/i,              // "运行"
    /\bstep\b/i,          // "step" 英文
    /\bprocess\b/i,       // "process" 英文
    /\bflow\b/i,          // "flow" 英文
    /\bfirst\b.*\bthen\b/i, // "first...then" 英文
    /\bbuild\b/i,         // "build" 英文
    /\bdeploy\b/i,        // "deploy" 英文
    /使用.*作为/i,        // "使用...作为" 工具选择
    /使用.*进行/i,        // "使用...进行" 工具选择
    /使用.*工具/i,        // "使用...工具" 工具选择
  ],

  // 风格规范：描述编码风格、命名约定或格式要求
  'style-norm': [
    /风格/i,              // "风格"
    /规范/i,              // "规范"
    /命名/i,              // "命名"
    /格式/i,              // "格式"
    /写法/i,              // "写法"
    /约定/i,              // "约定"
    /模式/i,              // "模式"
    /\bstyle\b/i,         // "style" 英文
    /\bnaming\b/i,        // "naming" 英文
    /\bformat\b/i,        // "format" 英文
    /\bconvention\b/i,    // "convention" 英文
    /\bpattern\b/i,       // "pattern" 英文
  ],
};

/**
 * 解析用户约束，将其分类到对应的 SKILL.md 章节
 *
 * @param input - 用户输入的约束文本
 * @returns 解析后的约束结构，包含分类结果、目标章节和模糊标记
 *
 * 分类策略：
 * 1. 使用关键词匹配进行确定性分类
 * 2. 一条约束可匹配多个分类
 * 3. 无任何匹配时标记为 isAmbiguous=true
 */
export function parseConstraint(input: string): ParsedConstraint {
  const trimmedInput = input.trim();

  // 空输入直接标记为模糊
  if (trimmedInput.length === 0) {
    return {
      original: input,
      categories: [],
      targetSections: [],
      isAmbiguous: true,
    };
  }

  const matchedCategories: ConstraintType[] = [];

  // 遍历所有约束类型，检查是否匹配关键词
  for (const [type, rules] of Object.entries(KEYWORD_RULES) as [ConstraintType, RegExp[]][]) {
    const isMatch = rules.some(rule => rule.test(trimmedInput));
    if (isMatch) {
      matchedCategories.push(type);
    }
  }

  // 无任何匹配时标记为模糊
  const isAmbiguous = matchedCategories.length === 0;

  // 根据匹配到的分类推导目标章节
  const targetSections = [...new Set(
    matchedCategories.map(category => CONSTRAINT_SECTION_MAP[category])
  )];

  return {
    original: input,
    categories: matchedCategories,
    targetSections,
    isAmbiguous,
  };
}
