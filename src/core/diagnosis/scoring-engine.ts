/**
 * 量化评分引擎 - 基于诊断结果计算合规评分
 */

import {
  DiagnosticResult,
  CheckResult,
  CheckStatus,
  FixLevel,
  DiagnosticDimension,
} from './types.js';

/** 维度评分结果 */
export interface DimensionScore {
  dimension: DiagnosticDimension;
  score: number; // 0-100
  weight: number; // 权重
  status: CheckStatus;
}

/** 评分结果 */
export interface ScoringResult {
  totalScore: number; // 0-100
  dimensionScores: DimensionScore[];
}

/** 权重配置 */
interface WeightConfig {
  /** required 维度总权重 (默认 60%) */
  requiredWeight: number;
  /** recommended 维度总权重 (默认 40%) */
  recommendedWeight: number;
}

/** 默认权重配置 */
const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  requiredWeight: 0.6,
  recommendedWeight: 0.4,
};

/** 修复等级对应的维度权重映射 */
const FIX_LEVEL_WEIGHTS: Record<FixLevel, number> = {
  required: 0.6,
  recommended: 0.4,
};

export class ScoringEngine {
  private weightConfig: WeightConfig;

  constructor(weightConfig?: Partial<WeightConfig>) {
    this.weightConfig = {
      ...DEFAULT_WEIGHT_CONFIG,
      ...weightConfig,
    };
  }

  /**
   * 计算诊断结果的评分
   * @param result 诊断结果
   * @returns 评分结果
   */
  calculateScore(result: DiagnosticResult): ScoringResult {
    const dimensionScores = this.calculateDimensionScores(result.checks);
    const totalScore = this.calculateTotalScore(dimensionScores);

    return {
      totalScore,
      dimensionScores,
    };
  }

  /**
   * 计算各维度评分
   */
  private calculateDimensionScores(checks: CheckResult[]): DimensionScore[] {
    const dimensionScores: DimensionScore[] = [];

    for (const check of checks) {
      const weight = this.getDimensionWeight(check);
      const score = this.calculateDimensionScore(check, weight);

      dimensionScores.push({
        dimension: check.dimension,
        score,
        weight,
        status: check.status,
      });
    }

    return dimensionScores;
  }

  /**
   * 获取维度权重
   * required 维度共享 60% 权重，recommended 维度共享 40% 权重
   */
  private getDimensionWeight(check: CheckResult): number {
    const fixLevel = check.fixLevel || 'recommended';
    const baseWeight = FIX_LEVEL_WEIGHTS[fixLevel];

    // 计算同 fixLevel 的维度数量
    const sameLevelCount = this.countChecksWithFixLevel(check.fixLevel);

    // 均分权重
    return baseWeight / sameLevelCount;
  }

  /**
   * 计算单个维度得分
   */
  private calculateDimensionScore(
    check: CheckResult,
    weight: number
  ): number {
    if (check.status === 'pass') {
      return 100;
    }

    if (check.status === 'not_applicable') {
      return 100; // 不适用维度不扣分
    }

    // fail 状态按权重扣分
    const deduction = weight * 100;
    return Math.max(0, 100 - deduction);
  }

  /**
   * 计算总分
   */
  private calculateTotalScore(dimensionScores: DimensionScore[]): number {
    if (dimensionScores.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const dimScore of dimensionScores) {
      totalScore += dimScore.score * dimScore.weight;
      totalWeight += dimScore.weight;
    }

    // 加权平均
    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * 统计具有相同 fixLevel 的检查数量
   */
  private countChecksWithFixLevel(fixLevel?: FixLevel): number {
    // 默认统计所有 required 或 recommended 维度
    const targetLevel = fixLevel || 'recommended';
    const allDimensions = Object.values(DiagnosticDimension);

    // 这里简化处理：假设 required 有 4 个维度，recommended 有 3 个维度
    // 实际应用中可以从检查结果中动态计算
    if (targetLevel === 'required') {
      return 4; // structure, metadata, boundary, standard
    }
    return 3; // format, evaluation, compatibility
  }

  /**
   * 将评分结果附加到诊断结果上
   */
  enrichResult(result: DiagnosticResult): DiagnosticResult {
    const scoringResult = this.calculateScore(result);
    return {
      ...result,
      score: scoringResult.totalScore,
    };
  }
}

// 导出默认评分引擎实例
export const defaultScoringEngine = new ScoringEngine();
