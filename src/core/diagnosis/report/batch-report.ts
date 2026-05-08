/**
 * 批量诊断汇总报告生成
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BatchDiagnosticResult,
  DiagnosticResult,
  BatchDiagnosisFailure,
} from '../types.js';

export class BatchReportGenerator {
  /**
   * 生成批量诊断汇总报告
   * @param batchResult 批量诊断结果
   * @returns Markdown 格式汇总报告
   */
  generate(batchResult: BatchDiagnosticResult): string {
    const lines: string[] = [];

    // 报告标题
    lines.push('# 批量诊断汇总报告\n');

    // 汇总统计
    lines.push('## 汇总统计\n');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 总扫描数 | ${batchResult.totalScanned} |`);
    lines.push(`| 合规数 | ${batchResult.compliantCount} |`);
    lines.push(`| 不合规数 | ${batchResult.nonCompliantCount} |`);
    lines.push(`| 诊断失败 | ${batchResult.failedCount} |`);

    const complianceRate =
      batchResult.totalScanned > 0
        ? Math.round(
            (batchResult.compliantCount / batchResult.totalScanned) * 100
          )
        : 0;
    lines.push(`| 合规率 | ${complianceRate}% |`);
    lines.push('');

    // 按评分排序的技能清单
    lines.push('## 技能清单（按评分从低到高排序）\n');
    lines.push('| 排名 | 技能名称 | 评分 | 状态 | 不通过维度 |');
    lines.push('|------|----------|------|------|------------|');

    // 提取并排序成功的诊断结果
    const successResults = batchResult.results.filter(
      (r: DiagnosticResult | BatchDiagnosisFailure): r is DiagnosticResult =>
        'checks' in r
    );
    const sortedResults = [...successResults].sort(
      (a, b) => (a.score ?? 0) - (b.score ?? 0)
    );

    for (const [index, result] of sortedResults.entries()) {
      const score = result.score ?? 'N/A';
      const status = (result.score ?? 0) >= 80 ? '✅ 合规' : '❌ 不合规';

      // 获取不通过维度
      const failedDimensions = result.checks
        .filter((c: { status: string }) => c.status === 'fail')
        .map((c: { dimension: string }) => c.dimension)
        .join(', ');

      lines.push(
        `| ${index + 1} | ${result.skillName} | ${score} | ${status} | ${failedDimensions || '-'} |`
      );
    }

    // 诊断失败的技能
    const failedResults = batchResult.results.filter(
      (r: DiagnosticResult | BatchDiagnosisFailure): r is BatchDiagnosisFailure =>
        'error' in r
    );
    if (failedResults.length > 0) {
      lines.push('');
      lines.push('## 诊断失败的技能\n');
      lines.push('| 技能名称 | 错误原因 | 时间 |');
      lines.push('|----------|----------|------|');

      for (const failure of failedResults) {
        lines.push(
          `| ${failure.skillName} | ${failure.error} | ${failure.timestamp} |`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * 生成报告并写入文件
   * @param batchResult 批量诊断结果
   * @param outputPath 输出路径
   * @returns 生成的文件路径
   */
  async generateToFile(
    batchResult: BatchDiagnosticResult,
    outputPath: string
  ): Promise<string> {
    const content = this.generate(batchResult);

    let filePath: string;
    try {
      const stats = await fs.stat(outputPath);
      if (stats.isDirectory()) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filePath = path.join(
          outputPath,
          `batch-diagnosis-report-${timestamp}.md`
        );
      } else {
        filePath = outputPath;
      }
    } catch {
      filePath = outputPath;
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }
}

// 导出单例实例
export const defaultBatchReportGenerator = new BatchReportGenerator();
