/**
 * 修复器接口和类型定义
 */

import { RemediationItem } from '../remediation-plan.js';

/** 修复结果 */
export interface FixResult {
  /** 是否成功 */
  success: boolean;
  /** 描述 */
  description: string;
  /** 备份路径（如果有） */
  backupPath?: string;
}

/** 修复器接口 */
export interface Fixer {
  /** 修复动作名称 */
  action: string;
  /**
   * 执行修复
   * @param item 改造项
   * @param skillPath 技能路径
   * @returns 修复结果
   */
  fix(item: RemediationItem, skillPath: string): Promise<FixResult>;
}
