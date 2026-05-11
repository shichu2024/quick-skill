/**
 * 冲突解决策略
 * - keep_user: 保留用户修改的版本
 * - override_system: 覆盖为系统生成的版本
 * - manual_merge: 用户手动合并
 */
export type ConflictResolution = 'keep_user' | 'override_system' | 'manual_merge';

/**
 * 冲突信息
 * 用于记录单个用例的哈希对比结果
 */
export interface ConflictInfo {
  /** 用例 ID */
  caseId: string;
  /** 当前用例内容的 SHA-256 哈希 */
  currentHash: string;
  /** 原始（系统生成时）的 SHA-256 哈希，无记录时为空字符串 */
  originalHash: string;
  /** 是否存在冲突（哈希不一致且非 custom 用例） */
  isConflict: boolean;
}
