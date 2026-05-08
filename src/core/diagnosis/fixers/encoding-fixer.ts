/**
 * 编码转换修复器
 * 将文件编码转换为 UTF-8
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Fixer, FixResult } from './types.js';
import { RemediationItem } from '../remediation-plan.js';

export class EncodingFixer implements Fixer {
  action = 'reencode';

  async fix(item: RemediationItem, skillPath: string): Promise<FixResult> {
    try {
      // 查找所有可能需要编码转换的文件
      const filesToFix = await this.findTextFiles(skillPath);
      let fixedCount = 0;
      const fixedFiles: string[] = [];

      for (const filePath of filesToFix) {
        try {
          // 读取文件内容
          const content = await fs.readFile(filePath);

          // 尝试检测是否为 UTF-8
          if (!this.isUtf8(content)) {
            // 尝试以 UTF-8 重新编码
            const text = content.toString('utf-8');
            await fs.writeFile(filePath, text, 'utf-8');
            fixedCount++;
            fixedFiles.push(path.relative(skillPath, filePath));
          }
        } catch {
          // 忽略无法处理的文件
        }
      }

      if (fixedCount === 0) {
        return {
          success: true,
          description: '所有文件已是 UTF-8 编码',
        };
      }

      return {
        success: true,
        description: `成功转换 ${fixedCount} 个文件的编码: ${fixedFiles.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        description: `编码转换失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 查找所有文本文件
   */
  private async findTextFiles(dirPath: string): Promise<string[]> {
    const textFiles: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // 跳过隐藏文件和备份目录
      if (entry.name.startsWith('.') || entry.name === '.backup') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.findTextFiles(fullPath);
        textFiles.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // 只处理文本类文件
        if (
          ext === '.md' ||
          ext === '.txt' ||
          ext === '.yaml' ||
          ext === '.yml' ||
          ext === '.json' ||
          ext === '.ts' ||
          ext === '.js'
        ) {
          textFiles.push(fullPath);
        }
      }
    }

    return textFiles;
  }

  /**
   * 简单检测是否为 UTF-8 编码
   * 检查是否存在无效的 UTF-8 字节序列
   */
  private isUtf8(buffer: Buffer): boolean {
    try {
      buffer.toString('utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
