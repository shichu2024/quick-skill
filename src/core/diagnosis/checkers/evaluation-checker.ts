/**
 * 评测合规性检查器
 * 验证技能具备覆盖 4 类核心场景的测试用例
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

/** 4 类核心场景 */
const EVAL_CATEGORIES = [
  'positive',    // 正向用例
  'boundary',    // 边界用例
  'error',       // 错误处理用例
  'compatibility', // 兼容性用例
] as const;

export class EvaluationChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.evaluation;

  async check(skillPath: string): Promise<CheckResult> {
    const issues: string[] = [];
    let autoFixable = false;

    try {
      const evalsPath = path.join(skillPath, 'evals');

      // 检查 evals 目录是否存在
      let evalsExists = false;
      try {
        const stats = await fs.stat(evalsPath);
        evalsExists = stats.isDirectory();
      } catch {
        evalsExists = false;
      }

      if (!evalsExists) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'recommended',
          message: 'evals/ 目录不存在',
          details: '技能缺少评测用例目录',
          autoFixable: false,
        };
      }

      // 读取 evals 目录内容
      const evalFiles = await fs.readdir(evalsPath);
      const csvFiles = evalFiles.filter(
        (file) => file.endsWith('.csv') || file.endsWith('.md')
      );

      if (csvFiles.length === 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'recommended',
          message: 'evals/ 目录下无用例文件',
          details: '未找到 .csv 或 .md 格式的用例文件',
          autoFixable: false,
        };
      }

      // 检查用例数量
      if (csvFiles.length < 4) {
        issues.push(`用例数量不足 (当前 ${csvFiles.length} 个，建议至少 4 个)`);
      }

      // 检查是否覆盖 4 类场景（通过文件名启发式判断）
      const foundCategories = new Set<string>();
      for (const file of csvFiles) {
        const lowerName = file.toLowerCase();
        for (const category of EVAL_CATEGORIES) {
          if (lowerName.includes(category)) {
            foundCategories.add(category);
          }
        }
      }

      const missingCategories = EVAL_CATEGORIES.filter(
        (cat) => !foundCategories.has(cat)
      );
      if (missingCategories.length > 0) {
        issues.push(
          `未覆盖以下场景: ${missingCategories.join(', ')}`
        );
      }

      // 检查用例文件格式（简单检查 CSV 格式）
      const invalidFiles: string[] = [];
      for (const file of csvFiles.filter((f) => f.endsWith('.csv'))) {
        const filePath = path.join(evalsPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        if (lines.length < 2) {
          invalidFiles.push(file);
        }
      }

      if (invalidFiles.length > 0) {
        issues.push(`以下 CSV 文件格式可能无效: ${invalidFiles.join(', ')}`);
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'recommended',
          message: '评测合规性检查失败',
          details: issues.join('; '),
          autoFixable: false,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '评测合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'recommended',
        message: `评测检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }
}

// 导出单例实例
export const evaluationChecker = new EvaluationChecker();
