/**
 * 文件/目录重命名修复器
 * 将不符合 kebab-case 的文件名转换为 kebab-case
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Fixer, FixResult } from './types.js';
import { RemediationItem } from '../remediation-plan.js';

export class RenameFixer implements Fixer {
  action = 'rename files';

  async fix(item: RemediationItem, skillPath: string): Promise<FixResult> {
    try {
      // 查找所有需要重命名的文件
      const filesToRename = await this.findNonKebabFiles(skillPath);

      if (filesToRename.length === 0) {
        return {
          success: true,
          description: '未发现需要重命名的文件',
        };
      }

      let renamedCount = 0;
      const renamedFiles: string[] = [];

      for (const filePath of filesToRename) {
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath);
        const ext = path.extname(baseName);
        const nameWithoutExt = path.parse(baseName).name;

        // 转换为 kebab-case
        const newName = this.toKebabCase(nameWithoutExt) + ext;
        const newPath = path.join(dir, newName);

        if (baseName !== newName) {
          await fs.rename(filePath, newPath);
          renamedCount++;
          renamedFiles.push(`${baseName} -> ${newName}`);
        }
      }

      return {
        success: true,
        description: `成功重命名 ${renamedCount} 个文件: ${renamedFiles.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        description: `重命名失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 查找所有不符合 kebab-case 的文件
   */
  private async findNonKebabFiles(dirPath: string): Promise<string[]> {
    const nonKebabFiles: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // 跳过隐藏文件和备份目录
      if (entry.name.startsWith('.') || entry.name === '.backup') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.findNonKebabFiles(fullPath);
        nonKebabFiles.push(...subFiles);
      } else if (entry.isFile()) {
        const nameWithoutExt = path.parse(entry.name).name;
        if (!this.isKebabCase(nameWithoutExt)) {
          nonKebabFiles.push(fullPath);
        }
      }
    }

    return nonKebabFiles;
  }

  /**
   * 将字符串转换为 kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
      .replace(/[\s_]+/g, '-') // spaces and underscores to dashes
      .replace(/[^a-z0-9-]/gi, '') // remove special characters
      .replace(/-+/g, '-') // multiple dashes to single
      .replace(/^-|-$/g, '') // remove leading/trailing dashes
      .toLowerCase();
  }

  /**
   * 检查字符串是否符合 kebab-case
   */
  private isKebabCase(str: string): boolean {
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return kebabCaseRegex.test(str);
  }
}
