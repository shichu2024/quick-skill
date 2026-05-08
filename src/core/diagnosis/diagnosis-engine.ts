/**
 * 诊断引擎 - 调度检查器并收集诊断结果
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  DiagnosticResult,
  CheckResult,
  DiagnosisConfig,
} from './types.js';
import { CheckerRegistry, defaultRegistry } from './checker-registry.js';
import { defaultScoringEngine } from './scoring-engine.js';

export class DiagnosisEngine {
  private registry: CheckerRegistry;
  private config: DiagnosisConfig;

  constructor(config?: DiagnosisConfig) {
    this.config = config || {};
    this.registry = defaultRegistry;
  }

  /**
   * 对指定技能路径执行全维度诊断
   * @param skillPath 技能目录路径
   * @returns 诊断结果（包含评分）
   */
  async diagnose(skillPath: string): Promise<DiagnosticResult> {
    // 验证路径有效性
    await this.validateSkillPath(skillPath);

    // 提取技能名称
    const skillName = await this.extractSkillName(skillPath);

    // 执行所有注册的检查器
    const checks = await this.registry.executeAll(skillPath);

    // 构建诊断结果
    const result: DiagnosticResult = {
      skillPath,
      skillName,
      timestamp: new Date().toISOString(),
      checks,
    };

    // 计算并附加评分
    return defaultScoringEngine.enrichResult(result);
  }

  /**
   * 获取检查器注册表（用于注册新检查器）
   */
  getRegistry(): CheckerRegistry {
    return this.registry;
  }

  /**
   * 验证技能路径有效性
   */
  private async validateSkillPath(skillPath: string): Promise<void> {
    let stats;
    try {
      stats = await fs.stat(skillPath);
    } catch {
      throw new Error(`Path does not exist: ${skillPath}`);
    }

    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${skillPath}`);
    }
  }

  /**
   * 提取技能名称
   * 优先从 SKILL.md 的 front matter 中读取 name 字段，否则使用目录名
   */
  private async extractSkillName(skillPath: string): Promise<string> {
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    try {
      const content = await fs.readFile(skillMdPath, 'utf-8');
      // 尝试从 YAML front matter 中提取 name
      const nameMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (nameMatch) {
        const frontMatter = nameMatch[1];
        const nameLine = frontMatter
          .split('\n')
          .find((line) => line.startsWith('name:'));
        if (nameLine) {
          const name = nameLine.substring(5).trim().replace(/['"]/g, '');
          if (name) {
            return name;
          }
        }
      }
    } catch {
      // SKILL.md 不存在或读取失败，使用目录名
    }

    // 使用目录名作为技能名称
    return path.basename(skillPath);
  }
}

// 导出默认引擎实例
export const defaultEngine = new DiagnosisEngine();
