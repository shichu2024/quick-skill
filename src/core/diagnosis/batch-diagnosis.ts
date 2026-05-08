/**
 * 批量诊断调度逻辑
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  DiagnosticResult,
  BatchDiagnosticResult,
  BatchDiagnosisFailure,
} from './types.js';
import { DiagnosisEngine, defaultEngine } from './diagnosis-engine.js';
import { defaultScoringEngine } from './scoring-engine.js';

export class BatchDiagnosisEngine {
  private engine: DiagnosisEngine;

  constructor(engine?: DiagnosisEngine) {
    this.engine = engine || defaultEngine;
  }

  /**
   * 批量诊断指定目录下所有技能
   * @param dirPath 目录路径
   * @param options 批量诊断选项
   * @returns 批量诊断结果
   */
  async diagnoseBatch(
    dirPath: string,
    options?: {
      /** 技能文件类型过滤（如 'SKILL.md'） */
      filter?: string;
      /** 进度回调 */
      onProgress?: (current: number, total: number, skillName: string) => void;
    }
  ): Promise<BatchDiagnosticResult> {
    // 验证目录路径
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    // 扫描所有子目录
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const skillDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dirPath, entry.name));

    // 根据 filter 过滤
    const filteredSkillDirs = options?.filter
      ? await this.filterBySkillFile(skillDirs, options.filter)
      : skillDirs;

    const results: (DiagnosticResult | BatchDiagnosisFailure)[] = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    let failedCount = 0;

    // 串行执行诊断
    for (let i = 0; i < filteredSkillDirs.length; i++) {
      const skillPath = filteredSkillDirs[i];
      const skillName = path.basename(skillPath);

      // 进度回调
      options?.onProgress?.(i + 1, filteredSkillDirs.length, skillName);

      console.log(
        `[${i + 1}/${filteredSkillDirs.length}] Diagnosing ${skillName}...`
      );

      try {
        const result = await this.engine.diagnose(skillPath);
        results.push(result);

        // 判断是否合规（评分 >= 80 视为合规）
        if ((result.score ?? 0) >= 80) {
          compliantCount++;
        } else {
          nonCompliantCount++;
        }
      } catch (error) {
        const failure: BatchDiagnosisFailure = {
          skillPath,
          skillName,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };
        results.push(failure);
        failedCount++;
      }
    }

    return {
      totalScanned: filteredSkillDirs.length,
      compliantCount,
      nonCompliantCount,
      failedCount,
      results,
    };
  }

  /**
   * 根据技能文件类型过滤目录
   */
  private async filterBySkillFile(
    skillDirs: string[],
    filter: string
  ): Promise<string[]> {
    const filtered: string[] = [];

    for (const dir of skillDirs) {
      try {
        const skillFilePath = path.join(dir, filter);
        await fs.access(skillFilePath);
        filtered.push(dir);
      } catch {
        // 文件不存在，跳过
      }
    }

    return filtered;
  }
}

// 导出默认实例
export const defaultBatchDiagnosisEngine = new BatchDiagnosisEngine();
