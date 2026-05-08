/**
 * 元数据合规性检查器
 * 验证技能包含 name 和 description 定义
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

export class MetadataChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.metadata;

  async check(skillPath: string): Promise<CheckResult> {
    const issues: string[] = [];
    let autoFixable = false;
    let fixAction: string | undefined;

    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      let content: string;

      try {
        content = await fs.readFile(skillMdPath, 'utf-8');
      } catch {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: 'SKILL.md 文件不存在',
          autoFixable: false,
        };
      }

      // 解析 YAML front matter
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontMatterMatch) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: 'SKILL.md 缺少 YAML front matter',
          autoFixable: false,
        };
      }

      const frontMatter = frontMatterMatch[1];

      // 检查 name 字段
      const nameMatch = frontMatter.match(/^name:\s*(.+)$/m);
      if (!nameMatch) {
        issues.push('缺少 name 字段');
        autoFixable = false;
      } else {
        const name = nameMatch[1].trim().replace(/['"]/g, '');
        if (!name) {
          issues.push('name 字段为空');
          autoFixable = false;
        } else if (!this.isKebabCase(name)) {
          issues.push(`name "${name}" 不符合 kebab-case 规范`);
          autoFixable = true;
          fixAction = 'convert name to kebab-case';
        }
      }

      // 检查 description 字段
      const descMatch = frontMatter.match(/^description:\s*(.+)$/m);
      if (!descMatch) {
        issues.push('缺少 description 字段');
        autoFixable = false;
      } else {
        const desc = descMatch[1].trim().replace(/['"]/g, '');
        if (!desc) {
          issues.push('description 字段为空');
          autoFixable = false;
        }
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: '元数据合规性检查失败',
          details: issues.join('; '),
          autoFixable,
          fixAction,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '元数据合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'required',
        message: `元数据检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }

  /**
   * 检查字符串是否符合 kebab-case 规范
   * kebab-case: 小写字母、数字和连字符，不能以连字符开头或结尾，不能有连续连字符
   */
  private isKebabCase(str: string): boolean {
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return kebabCaseRegex.test(str);
  }
}

// 导出单例实例
export const metadataChecker = new MetadataChecker();
