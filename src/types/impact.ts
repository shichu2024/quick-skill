/**
 * 影响映射相关类型定义
 * 用于 FEAT-005 eval-sync 的章节变更到用例影响映射引擎
 */

/**
 * 影响动作类型
 * - add: 需要新增用例
 * - update: 需要更新现有用例
 * - deprecate: 需要停用用例
 */
export type ImpactAction = 'add' | 'update' | 'deprecate';

/**
 * 用例类型
 * - explicit: 显式调用用例
 * - implicit: 隐式调用用例
 * - context: 上下文调用用例
 * - negative: 负例控制用例
 */
export type CaseType = 'explicit' | 'implicit' | 'context' | 'negative';

/**
 * 单个用例受到的影响
 */
export interface CaseImpact {
  /** 受影响的用例类型 */
  affectedCaseType: CaseType;
  /** 需要执行的动作 */
  action: ImpactAction;
  /** 影响原因说明 */
  reason: string;
  /** 关联的 SKILL.md 章节 */
  relatedSection: string;
}

/**
 * 影响映射结果
 */
export interface ImpactMappingResult {
  /** 所有用例影响列表 */
  impacts: CaseImpact[];
}
