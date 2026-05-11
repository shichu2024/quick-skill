import { checkResult } from './checkers/result-checker.js';
import { checkProcess } from './checkers/process-checker.js';
import { checkStyle } from './checkers/style-checker.js';
import { checkEfficiency } from './checkers/efficiency-checker.js';
import type { CheckContext } from './checkers/result-checker.js';
import type { CheckResult as ResultCheckResult } from './checkers/result-checker.js';
import type { ProcessCheckResult } from './checkers/process-checker.js';
import type { StyleCheckResult } from './checkers/style-checker.js';
import type { EfficiencyCheckResult } from './checkers/efficiency-checker.js';

/**
 * 统一检查器结果类型
 * 所有 4 类检查器的结果都符合此接口
 */
export type CheckerResult = ResultCheckResult | ProcessCheckResult | StyleCheckResult | EfficiencyCheckResult;

/**
 * 确定性评测结果接口
 * 包含 4 类检查器的汇总结果
 */
export interface DeterministicEvalResult {
  /** 总分 0-100（按适用检查器数量等比缩放） */
  totalScore: number;
  /** 实际满分（适用检查器的满分之和） */
  maxScore: number;
  /** 4 个检查器的结果 */
  checks: CheckerResult[];
  /** 所有适用检查器是否全部通过 */
  allPassed: boolean;
  /** 标记为不适用的检查器 id 列表 */
  notApplicableChecks: string[];
}

/**
 * 确定性评测引擎编排器
 *
 * 编排 4 个检查器（结果、流程、风格、效率）的执行，
 * 汇总检查结果，计算确定性评测总分，处理"不适用"场景。
 *
 * 评分规则：
 * - 每个检查器满分 25 分，4 个检查器总计满分 100 分
 * - 不适用的检查器不计入总分分母，按剩余适用检查器等比缩放至 100
 * - 当所有检查器都不适用时，totalScore = 0，maxScore = 0
 * - allPassed 仅考虑适用检查器，不适用的不参与 allPassed 判断
 *
 * @param context 检查上下文，包含用例、沙箱、Skill 锚点和 Trace 收集器
 * @returns 确定性评测结果
 */
export function runDeterministicEval(context: CheckContext): DeterministicEvalResult {
  // 按固定顺序执行 4 个检查器
  const checks: CheckerResult[] = [
    checkResult(context),
    checkProcess(context),
    checkStyle(context),
    checkEfficiency(context),
  ];

  // 分离适用与不适用的检查器
  const applicableChecks = checks.filter(c => !c.notApplicable);
  const notApplicableChecks = checks
    .filter(c => c.notApplicable)
    .map(c => c.checkerId);

  // 计算适用检查器的实际总分和满分
  const totalScoreRaw = applicableChecks.reduce((sum, c) => sum + c.score, 0);
  const maxScore = applicableChecks.reduce((sum, c) => sum + 25, 0);

  // 等比缩放至 100 分制
  // 当无适用检查器时，totalScore = 0
  const totalScore = maxScore > 0
    ? Math.round((totalScoreRaw / maxScore) * 100)
    : 0;

  // allPassed：所有适用检查器的 pass 均为 true
  const allPassed = applicableChecks.length > 0
    ? applicableChecks.every(c => c.pass)
    : false;

  return {
    totalScore,
    maxScore,
    checks,
    allPassed,
    notApplicableChecks,
  };
}
