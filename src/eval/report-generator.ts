import fs from 'fs';
import path from 'path';
import { generateReportHtml } from './templates/report.html.js';
import type { SkillScore, CaseEvalResult } from '../types/eval.js';
import type { RegressionResult } from './regression-detector.js';

/**
 * 报告数据接口
 */
export interface ReportData {
  /** Skill 名称 */
  skillName: string;
  /** 业务分类 */
  category: string;
  /** Skill 级别打分结果 */
  skillScore: SkillScore;
  /** 用例评测原始结果列表 */
  caseResults: CaseEvalResult[];
  /** 回归检测结果 */
  regression: RegressionResult;
  /** Trace 日志相对路径 */
  traceRelativePath: string;
  /** 评测时间戳（ISO 8601） */
  timestamp: string;
}

/**
 * 生成 HTML 可视化报告
 *
 * 将评测结果渲染为轻量级 HTML 报告，包含：
 * - 得分概览（综合得分、正例通过率、负例准确率、Rubric 均分）
 * - 回归检测提示（首次评测、无回归、有回归）
 * - 用例总览表格（所有用例状态一览）
 * - 失败用例详情（失败检查项、trace 链接）
 * - Trace 日志跳转链接
 *
 * 报告使用纯内联 CSS，不依赖任何外部资源，可离线查看。
 *
 * @param data 报告数据
 * @param outputPath HTML 输出文件的完整路径
 * @returns 输出文件的绝对路径
 */
export function generateHtmlReport(data: ReportData, outputPath: string): string {
  // 确保输出目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 生成 HTML 内容
  const htmlContent = generateReportHtml(data);

  // 写入文件
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');

  // 返回绝对路径
  return path.resolve(outputPath);
}
