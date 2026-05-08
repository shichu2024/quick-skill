/**
 * 兼容性合规性检查器
 * 验证技能无单一 Agent 强绑定逻辑，可跨 Agent 通用
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

/** Agent 专有模式关键词（可配置） */
const AGENT_SPECIFIC_PATTERNS = [
  // Claude 专有
  'claude only',
  'anthropic only',
  'claude-specific',
  'anthropic-specific',
  'claude api',
  'anthropic api',
  'claude tool',
  'anthropic tool',

  // OpenCode 专有
  'opencode only',
  'opencode-specific',
  'opencode api',
  'opencode tool',

  // 其他 Agent 专有
  'agent-specific',
  'agent only',
];

/** 硬编码路径模式 */
const HARDCODED_PATH_PATTERNS = [
  /\/Users\/.*\/\.claude/i,
  /\/Users\/.*\/\.anthropic/i,
  /\/Users\/.*\/\.opencode/i,
  /%USERPROFILE%.*\\.claude/i,
  /%USERPROFILE%.*\\.opencode/i,
];

export class CompatibilityChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.compatibility;

  async check(skillPath: string): Promise<CheckResult> {
    const issues: string[] = [];

    try {
      // 读取技能目录下所有 Markdown 文件
      const mdFiles = await this.findMarkdownFiles(skillPath);

      for (const file of mdFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(skillPath, file);

        // 检查 Agent 专有模式
        const lowerContent = content.toLowerCase();
        for (const pattern of AGENT_SPECIFIC_PATTERNS) {
          if (lowerContent.includes(pattern.toLowerCase())) {
            issues.push(
              `文件 "${relativePath}" 包含 Agent 强绑定逻辑: "${pattern}"`
            );
          }
        }

        // 检查硬编码路径
        for (const pathPattern of HARDCODED_PATH_PATTERNS) {
          const matches = content.match(pathPattern);
          if (matches) {
            issues.push(
              `文件 "${relativePath}" 包含硬编码的 Agent 路径: "${matches[0]}"`
            );
          }
        }
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'recommended',
          message: '兼容性合规性检查失败',
          details: issues.slice(0, 5).join('; ') + (issues.length > 5 ? ` 等${issues.length}个问题` : ''),
          autoFixable: false,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '兼容性合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'recommended',
        message: `兼容性检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }

  /**
   * 递归查找目录下所有 Markdown 文件
   */
  private async findMarkdownFiles(dirPath: string): Promise<string[]> {
    const mdFiles: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // 跳过隐藏目录和 node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.findMarkdownFiles(fullPath);
        mdFiles.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        mdFiles.push(fullPath);
      }
    }

    return mdFiles;
  }
}

// 导出单例实例
export const compatibilityChecker = new CompatibilityChecker();
