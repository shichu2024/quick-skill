/**
 * 标准合规性检查器
 * 验证技能有可量化的 "Definition of done"
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

export class StandardChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.standard;

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

      // 检查 "Definition of done" 章节
      const dodMatch = content.match(
        /^#{1,3}\s+Definition\s+of\s+done/im
      );
      if (!dodMatch) {
        issues.push('缺少 "Definition of done" 章节');
      } else {
        // 检查章节内容是否包含量化指标
        const sectionContent = this.extractSectionContent(
          content,
          dodMatch.index!
        );

        if (!sectionContent || sectionContent.trim().length < 10) {
          issues.push('"Definition of done" 章节内容为空或过短');
        } else if (!this.hasQuantifiableMetrics(sectionContent)) {
          issues.push(
            '"Definition of done" 缺少可量化指标（数字、百分比、明确判断条件）'
          );
        }
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: '标准合规性检查失败',
          details: issues.join('; '),
          autoFixable: false,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '标准合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'required',
        message: `标准检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }

  /**
   * 检查内容是否包含可量化指标
   * 启发式检测：是否包含数字、百分比、明确的布尔条件描述
   */
  private hasQuantifiableMetrics(content: string): boolean {
    // 检测数字
    const hasNumbers = /\d+/.test(content);
    // 检测百分比
    const hasPercentages = /\d+%/.test(content);
    // 检测明确的判断条件关键词
    const hasConditionals =
      /必须|应该|包含|至少|超过|少于|等于|大于|小于|完成|成功|失败|通过|不通过/i.test(
        content
      );

    return hasNumbers || hasPercentages || hasConditionals;
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
export const standardChecker = new StandardChecker();
