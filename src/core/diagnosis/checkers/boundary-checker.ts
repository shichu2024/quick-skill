/**
 * 边界合规性检查器
 * 验证技能定义了 "When to use this" 和 "When NOT to use this"
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

export class BoundaryChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.boundary;

  async check(skillPath: string): Promise<CheckResult> {
    const issues: string[] = [];

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

      // 检查 "When to use this" 章节
      const whenToUseMatch = content.match(
        /^#{1,3}\s+When\s+to\s+use\s+(this|it)/im
      );
      if (!whenToUseMatch) {
        issues.push('缺少 "When to use this" 章节');
      } else {
        // 检查章节内容是否非空
        const sectionContent = this.extractSectionContent(
          content,
          whenToUseMatch.index!
        );
        if (!sectionContent || sectionContent.trim().length < 10) {
          issues.push('"When to use this" 章节内容为空或过短');
        }
      }

      // 检查 "When NOT to use this" 章节
      const whenNotToUseMatch = content.match(
        /^#{1,3}\s+When\s+NOT\s+to\s+use\s+(this|it)/im
      );
      if (!whenNotToUseMatch) {
        issues.push('缺少 "When NOT to use this" 章节');
      } else {
        const sectionContent = this.extractSectionContent(
          content,
          whenNotToUseMatch.index!
        );
        if (!sectionContent || sectionContent.trim().length < 10) {
          issues.push('"When NOT to use this" 章节内容为空或过短');
        }
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: '边界合规性检查失败',
          details: issues.join('; '),
          autoFixable: false,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '边界合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'required',
        message: `边界检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }

  /**
   * 提取章节内容（从标题结束到下一个标题开始）
   */
  private extractSectionContent(content: string, startIndex: number): string {
    const restContent = content.slice(startIndex);
    const nextHeadingMatch = restContent.match(/^#{1,3}\s+/m);
    if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
      return restContent.slice(0, nextHeadingMatch.index);
    }
    return restContent;
  }
}

// 导出单例实例
export const boundaryChecker = new BoundaryChecker();
