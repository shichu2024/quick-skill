/**
 * 自动修复引擎 - 基于改造清单执行自动修复
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { RemediationItem, RemediationPlan } from './remediation-plan.js';
import { Fixer, FixResult } from './fixers/types.js';
import { RenameFixer } from './fixers/rename-fixer.js';
import { StructureFixer } from './fixers/structure-fixer.js';
import { EncodingFixer } from './fixers/encoding-fixer.js';

export interface AutoFixResult {
  /** 是否成功 */
  success: boolean;
  /** 已修复项数量 */
  fixedCount: number;
  /** 修复内容摘要 */
  summary: string[];
  /** 备份路径 */
  backupPath?: string;
  /** 失败项（如果有） */
  failures?: string[];
}

export class AutoFixEngine {
  private fixers: Map<string, Fixer>;

  constructor() {
    this.fixers = new Map();
    this.registerFixers();
  }

  /**
   * 注册所有修复器
   */
  private registerFixers(): void {
    const renameFixer = new RenameFixer();
    const structureFixer = new StructureFixer();
    const encodingFixer = new EncodingFixer();

    this.fixers.set(renameFixer.action, renameFixer);
    this.fixers.set(structureFixer.action, structureFixer);
    this.fixers.set(encodingFixer.action, encodingFixer);
  }

  /**
   * 执行自动修复
   * @param plan 改造清单
   * @param skillPath 技能路径
   * @returns 修复结果
   */
  async execute(
    plan: RemediationPlan,
    skillPath: string
  ): Promise<AutoFixResult> {
    if (plan.autoFixableItems.length === 0) {
      return {
        success: true,
        fixedCount: 0,
        summary: ['无需自动修复项'],
      };
    }

    // 创建备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(skillPath, '.backup', timestamp);
    await this.createBackup(skillPath, backupPath);

    const summary: string[] = [];
    const failures: string[] = [];
    let fixedCount = 0;

    try {
      // 执行每个可自动修复项
      for (const item of plan.autoFixableItems) {
        if (!item.fixAction) {
          failures.push(`跳过 "${item.description}": 未指定修复动作`);
          continue;
        }

        const fixer = this.fixers.get(item.fixAction);
        if (!fixer) {
          failures.push(`跳过 "${item.description}": 未找到修复器 "${item.fixAction}"`);
          continue;
        }

        try {
          const result = await fixer.fix(item, skillPath);
          if (result.success) {
            fixedCount++;
            summary.push(`✅ ${result.description}`);
          } else {
            failures.push(`❌ ${result.description}`);
            // 修复失败，回滚
            await this.rollback(backupPath, skillPath);
            return {
              success: false,
              fixedCount,
              summary,
              backupPath,
              failures: [...failures, '已回滚所有修改'],
            };
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          failures.push(`❌ 修复失败: ${errorMsg}`);
          // 修复失败，回滚
          await this.rollback(backupPath, skillPath);
          return {
            success: false,
            fixedCount,
            summary,
            backupPath,
            failures: [...failures, '已回滚所有修改'],
          };
        }
      }

      return {
        success: failures.length === 0,
        fixedCount,
        summary,
        backupPath,
        failures: failures.length > 0 ? failures : undefined,
      };
    } catch (error) {
      // 发生异常，回滚
      await this.rollback(backupPath, skillPath);
      throw error;
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(
    skillPath: string,
    backupPath: string
  ): Promise<void> {
    await fs.mkdir(backupPath, { recursive: true });

    // 复制所有文件到备份目录
    await this.copyDirectory(skillPath, backupPath, (filePath) => {
      // 跳过备份目录本身
      const relative = path.relative(skillPath, filePath);
      return !relative.startsWith('.backup');
    });
  }

  /**
   * 复制目录
   */
  private async copyDirectory(
    src: string,
    dest: string,
    filter?: (filePath: string) => boolean
  ): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (filter && !filter(srcPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath, filter);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 回滚到备份
   */
  private async rollback(
    backupPath: string,
    skillPath: string
  ): Promise<void> {
    // 删除技能目录中除备份外的所有文件
    const entries = await fs.readdir(skillPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.backup') {
        continue;
      }
      const fullPath = path.join(skillPath, entry.name);
      await fs.rm(fullPath, { recursive: true, force: true });
    }

    // 从备份恢复
    await this.copyDirectory(backupPath, skillPath, (filePath) => {
      const relative = path.relative(backupPath, filePath);
      return !relative.startsWith('.backup');
    });
  }
}

// 导出单例实例
export const defaultAutoFixEngine = new AutoFixEngine();
