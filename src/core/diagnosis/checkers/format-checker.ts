/**
 * 格式合规性检查器
 * 验证技能文件命名符合 kebab-case 规范，无特殊字符和空格
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

export class FormatChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.format;

  async check(skillPath: string): Promise<CheckResult> {
    const issues: string[] = [];
    let autoFixable = false;
    let fixAction: string | undefined;

    try {
      // 检查目录名是否符合 kebab-case
      const dirName = path.basename(skillPath);
      if (!this.isKebabCase(dirName)) {
        issues.push(`目录名 "${dirName}" 不符合 kebab-case 规范`);
        autoFixable = true;
        fixAction = 'rename directory';
      }

      // 递归检查所有文件和子目录
      const allEntries = await this.readAllEntries(skillPath);

      for (const entry of allEntries) {
        const relativePath = path.relative(skillPath, entry);
        const baseName = path.basename(entry);

        // 跳过隐藏文件和目录
        if (baseName.startsWith('.')) {
          continue;
        }

        // 检查文件名是否符合 kebab-case
        const nameWithoutExt = path.parse(baseName).name;
        if (!this.isKebabCase(nameWithoutExt)) {
          issues.push(
            `文件/目录名 "${relativePath}" 不符合 kebab-case 规范`
          );
          autoFixable = true;
          fixAction = fixAction || 'rename files';
        }

        // 检查是否包含特殊字符或空格
        if (/[^\w-]/.test(baseName)) {
          issues.push(
            `文件/目录名 "${relativePath}" 包含特殊字符或空格`
          );
          autoFixable = true;
          fixAction = fixAction || 'rename files';
        }
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'recommended',
          message: '格式合规性检查失败',
          details: issues.slice(0, 5).join('; ') + (issues.length > 5 ? ` 等${issues.length}个问题` : ''),
          autoFixable,
          fixAction,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '格式合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'recommended',
        message: `格式检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }

  /**
   * 递归读取所有文件和目录
   */
  private async readAllEntries(dirPath: string): Promise<string[]> {
    const entries: string[] = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      entries.push(fullPath);

      if (item.isDirectory()) {
        const subEntries = await this.readAllEntries(fullPath);
        entries.push(...subEntries);
      }
    }

    return entries;
  }

  /**
   * 检查字符串是否符合 kebab-case 规范
   */
  private isKebabCase(str: string): boolean {
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return kebabCaseRegex.test(str);
  }
}

// 导出单例实例
export const formatChecker = new FormatChecker();
