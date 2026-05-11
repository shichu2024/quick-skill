/**
 * 变更检测相关类型定义
 * 用于 FEAT-005 eval-sync 的 SKILL.md 变更检测引擎
 */

/**
 * 变更类型枚举
 * - added: 章节新增
 * - modified: 章节内容修改
 * - removed: 章节删除
 */
export type ChangeType = 'added' | 'modified' | 'removed';

/**
 * 章节级别的变更
 * 以 SKILL.md 的章节为最小变更单位
 */
export interface SectionChange {
  /** 章节名称 */
  section: 'name' | 'description' | 'whenToUse' | 'whenNotToUse' | 'definitionOfDone' | 'whatToBuild' | 'steps';
  /** 变更类型 */
  changeType: ChangeType;
  /** 变更前的内容（新增时为空） */
  previousContent: string;
  /** 变更后的内容（删除时为空） */
  currentContent: string;
}

/**
 * 变更检测结果
 */
export interface ChangeDetectionResult {
  /** 是否存在变更 */
  hasChanges: boolean;
  /** 变更列表 */
  changes: SectionChange[];
}
