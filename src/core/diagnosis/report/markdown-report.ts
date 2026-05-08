/**
 * Markdown 诊断报告生成器
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticResult, CheckStatus, FixLevel } from '../types.js';
import { ScoringResult, DimensionScore } from '../scoring-engine.js';
import {
  RemediationPlan,
  defaultRemediationPlanGenerator,
} from '../remediation-plan.js';

export class MarkdownReportGenerator {
  /**
   * 生成 Markdown 格式的诊断报告
   * @param result 诊断结果
   * @param scoringResult 评分结果
   * @param remediationPlan 改造清单（可选）
   * @returns Markdown 报告内容
   */
  generate(
    result: DiagnosticResult,
    scoringResult: ScoringResult,
    remediationPlan?: RemediationPlan
  ): string {
    const lines: string[] = [];

    // 元信息区
    lines.push(this.generateMetadataSection(result));
    lines.push('');

    // 合规评分摘要
    lines.push(this.generateScoreSummarySection(result, scoringResult));
    lines.push('');

    // 按优先级排序的维度详情
    lines.push(this.generateDimensionDetailsSection(result, scoringResult));
    lines.push('');

    // 改造清单章节
    if (remediationPlan) {
      lines.push(
        defaultRemediationPlanGenerator.toMarkdown(remediationPlan)
      );
    }

    return lines.join('\n');
  }

  /**
   * 生成报告并写入文件
   * @param result 诊断结果
   * @param scoringResult 评分结果
   * @param outputPath 输出路径（文件或目录）
   * @param remediationPlan 改造清单（可选）
   * @returns 生成的文件路径
   */
  async generateToFile(
    result: DiagnosticResult,
    scoringResult: ScoringResult,
    outputPath: string,
    remediationPlan?: RemediationPlan
  ): Promise<string> {
    const content = this.generate(result, scoringResult, remediationPlan);

    // 判断输出路径是文件还是目录
    let filePath: string;
    try {
      const stats = await fs.stat(outputPath);
      if (stats.isDirectory()) {
        // 是目录，生成默认文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filePath = path.join(
          outputPath,
          `diagnosis-report-${result.skillName}-${timestamp}.md`
        );
      } else {
        // 是文件
        filePath = outputPath;
      }
    } catch {
      // 路径不存在，当作文件处理
      filePath = outputPath;
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * 生成元信息区
   */
  private generateMetadataSection(result: DiagnosticResult): string {
    const lines: string[] = [];

    lines.push('# 技能合规诊断报告\n');
    lines.push('| 项目 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 技能名称 | ${result.skillName} |`);
    lines.push(`| 技能路径 | ${result.skillPath} |`);
    lines.push(`| 诊断时间 | ${result.timestamp} |`);
    lines.push(`| 检查维度 | ${result.checks.length} |`);

    return lines.join('\n');
  }

  /**
   * 生成合规评分摘要
   */
  private generateScoreSummarySection(
    result: DiagnosticResult,
    scoringResult: ScoringResult
  ): string {
    const lines: string[] = [];
    const score = result.score ?? scoringResult.totalScore;

    lines.push('## 合规评分\n');
    lines.push(`**总分: ${score}/100**\n`);

    // 评分等级
    const grade = this.getScoreGrade(score);
    lines.push(`**等级: ${grade}**\n`);

    // 各维度分数
    lines.push('### 各维度评分\n');
    lines.push('| 维度 | 分数 | 状态 |');
    lines.push('|------|------|------|');

    for (const dimScore of scoringResult.dimensionScores) {
      const statusIcon = this.getStatusIcon(dimScore.status);
      lines.push(
        `| ${dimScore.dimension} | ${dimScore.score} | ${statusIcon} |`
      );
    }

    return lines.join('\n');
  }

  /**
   * 生成维度详情
   */
  private generateDimensionDetailsSection(
    result: DiagnosticResult,
    scoringResult: ScoringResult
  ): string {
    const lines: string[] = [];

    lines.push('## 维度详情\n');

    // 按优先级排序：required fail > recommended fail > pass
    const sortedChecks = [...result.checks].sort((a, b) => {
      const priorityA = this.getCheckPriority(a);
      const priorityB = this.getCheckPriority(b);
      return priorityA - priorityB;
    });

    for (const check of sortedChecks) {
      const statusIcon = this.getStatusIcon(check.status);
      lines.push(`### ${statusIcon} ${check.dimension}\n`);
      lines.push(`- **状态**: ${check.status}`);
      lines.push(`- **描述**: ${check.message}`);

      if (check.details) {
        lines.push(`- **详情**: ${check.details}`);
      }

      if (check.status === 'fail') {
        lines.push(
          `- **修复等级**: ${check.fixLevel || 'recommended'}`
        );
        lines.push(`- **可自动修复**: ${check.autoFixable ? '是' : '否'}`);
        if (check.fixAction) {
          lines.push(`- **修复动作**: ${check.fixAction}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 获取检查项优先级（数字越小优先级越高）
   */
  private getCheckPriority(check: {
    status: CheckStatus;
    fixLevel?: FixLevel;
  }): number {
    if (check.status === 'pass' || check.status === 'not_applicable') {
      return 3;
    }

    if (check.fixLevel === 'required') {
      return 1;
    }

    return 2;
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: CheckStatus): string {
    switch (status) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'not_applicable':
        return '⚠️';
      default:
        return '❓';
    }
  }

  /**
   * 获取评分等级
   */
  private getScoreGrade(score: number): string {
    if (score >= 90) return '优秀';
    if (score >= 75) return '良好';
    if (score >= 60) return '合格';
    if (score >= 40) return '需改进';
    return '不合格';
  }
}

// 导出单例实例
export const defaultMarkdownReportGenerator = new MarkdownReportGenerator();
