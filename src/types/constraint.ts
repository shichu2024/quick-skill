/**
 * 约束类型枚举
 * 每种类型对应 SKILL.md 中的一个或多个章节
 */
export type ConstraintType =
  | 'positive-trigger'     // 正向触发 -> "When to use this"
  | 'negative-prohibition' // 负向禁止 -> "When NOT to use this"
  | 'success-criteria'     // 成功标准 -> "Definition of done"
  | 'execution-flow'       // 执行流程 -> "What to build" 或 "Steps"
  | 'style-norm';          // 风格规范 -> "What to build"

/**
 * 约束类型到 SKILL.md 章节的映射关系
 */
export const CONSTRAINT_SECTION_MAP: Record<ConstraintType, string> = {
  'positive-trigger': 'When to use this',
  'negative-prohibition': 'When NOT to use this',
  'success-criteria': 'Definition of done',
  'execution-flow': 'What to build',
  'style-norm': 'What to build',
};

/**
 * 解析后的约束结构
 */
export interface ParsedConstraint {
  /** 原始约束文本 */
  original: string;
  /** 匹配到的约束类型列表（一条约束可匹配多分类） */
  categories: ConstraintType[];
  /** 对应的 SKILL.md 章节名列表 */
  targetSections: string[];
  /** 无法明确分类时为 true */
  isAmbiguous: boolean;
}
