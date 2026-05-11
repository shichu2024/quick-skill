import type {
  CaseScore,
  SkillScore,
  AllSkillsScore,
  CaseEvalResult,
  DeductionInfo,
} from '../types/eval.js';

/**
 * 有 Rubric 时的权重配置
 * 正例通过率 50% + 负例准确率 30% + Rubric 均分 20%
 */
const WEIGHT_POSITIVE_WITH_RUBRIC = 0.5;
const WEIGHT_NEGATIVE_WITH_RUBRIC = 0.3;
const WEIGHT_RUBRIC_WITH_RUBRIC = 0.2;

/**
 * 无 Rubric 时的权重配置
 * 正例通过率 60% + 负例准确率 40%
 */
const WEIGHT_POSITIVE_NO_RUBRIC = 0.6;
const WEIGHT_NEGATIVE_NO_RUBRIC = 0.4;

/**
 * 单条用例打分
 *
 * 基于确定性评测结果计算单条用例得分，
 * 记录每项扣分原因，支持 Rubric 定性评分补充。
 *
 * @param caseResult 用例评测原始结果
 * @returns 单条用例打分结果
 */
export function scoreCase(caseResult: CaseEvalResult): CaseScore {
  const { caseId, shouldTrigger, deterministicResult, rubricResult } = caseResult;

  // 确定性评测得分（0-100）
  const deterministicScore = deterministicResult.totalScore;

  // Rubric 得分（0-1 归一化到 0-100），未启用时为 null
  const rubricScore = rubricResult !== undefined
    ? Math.round(rubricResult.score * 100)
    : null;

  // 收集扣分项：从确定性引擎的未通过检查项中提取
  const deductions: DeductionInfo[] = [];

  for (const check of deterministicResult.checks) {
    // 不适用的检查器不参与扣分
    if (check.notApplicable) continue;

    if (!check.pass) {
      deductions.push({
        reason: `[${check.checkerId}] 检查未通过: ${check.details.join('; ')}`,
        amount: 25 - check.score, // 每个检查器满分 25
        source: 'deterministic',
      });
    }
  }

  // Rubric 未通过时的扣分
  if (rubricResult !== undefined && !rubricResult.overallPass) {
    const rubricDeduction = 100 - (rubricResult.score * 100);
    if (rubricDeduction > 0) {
      deductions.push({
        reason: `Rubric 定性评测未通过（得分: ${Math.round(rubricResult.score * 100)}/100）`,
        amount: Math.round(rubricDeduction),
        source: 'rubric',
      });
    }
  }

  // 单条用例综合得分 = 确定性评测得分
  // Rubric 评分作为定性补充，在 Skill 级别加权时生效
  const score = deterministicScore;

  return {
    caseId,
    score,
    deterministicScore,
    rubricScore,
    deductions,
    shouldTrigger,
  };
}

/**
 * 单个 Skill 打分
 *
 * 根据用例打分结果聚合计算 Skill 级别得分。
 * 区分正例（shouldTrigger=true）和负例（shouldTrigger=false），
 * 根据是否启用 Rubric 自动调整权重公式。
 *
 * @param skillName Skill 名称
 * @param caseScores 该 Skill 下所有用例的打分结果
 * @returns 单个 Skill 打分结果
 */
export function scoreSkill(skillName: string, caseScores: CaseScore[]): SkillScore {
  // 分离正例和负例
  const positiveCases = caseScores.filter(c => c.shouldTrigger);
  const negativeCases = caseScores.filter(c => !c.shouldTrigger);

  // 计算正例通过率：确定性评测 allPassed 的比例
  const positivePassRate = positiveCases.length > 0
    ? positiveCases.filter(c => c.deterministicScore === 100).length / positiveCases.length
    : 0;

  // 计算负例准确率：确定性评测 totalScore 为 0 的比例（即正确未触发）
  const negativePassRate = negativeCases.length > 0
    ? negativeCases.filter(c => c.deterministicScore === 0).length / negativeCases.length
    : 0;

  // 计算 Rubric 平均分（仅统计启用了 Rubric 的用例）
  const rubricScores = caseScores
    .map(c => c.rubricScore)
    .filter((s): s is number => s !== null);

  const rubricAvgScore = rubricScores.length > 0
    ? rubricScores.reduce((sum, s) => sum + s, 0) / rubricScores.length
    : null;

  // 判断是否启用 Rubric
  const hasRubric = rubricAvgScore !== null;

  // 根据是否启用 Rubric 选择权重公式
  let score: number;
  let formula: string;

  if (hasRubric) {
    // 有 Rubric: 正例通过率 50% + 负例准确率 30% + Rubric 均分 20%
    // Rubric 均分需要从 0-100 归一化到 0-1
    score = Math.round(
      (positivePassRate * WEIGHT_POSITIVE_WITH_RUBRIC
        + negativePassRate * WEIGHT_NEGATIVE_WITH_RUBRIC
        + (rubricAvgScore / 100) * WEIGHT_RUBRIC_WITH_RUBRIC)
        * 100
    );
    formula = `正例通过率(${(positivePassRate * 100).toFixed(1)}%) × ${WEIGHT_POSITIVE_WITH_RUBRIC * 100}% + 负例准确率(${(negativePassRate * 100).toFixed(1)}%) × ${WEIGHT_NEGATIVE_WITH_RUBRIC * 100}% + Rubric 均分(${rubricAvgScore.toFixed(1)}) × ${WEIGHT_RUBRIC_WITH_RUBRIC * 100}%`;
  } else {
    // 无 Rubric: 正例通过率 60% + 负例准确率 40%
    score = Math.round(
      (positivePassRate * WEIGHT_POSITIVE_NO_RUBRIC
        + negativePassRate * WEIGHT_NEGATIVE_NO_RUBRIC)
        * 100
    );
    formula = `正例通过率(${(positivePassRate * 100).toFixed(1)}%) × ${WEIGHT_POSITIVE_NO_RUBRIC * 100}% + 负例准确率(${(negativePassRate * 100).toFixed(1)}%) × ${WEIGHT_NEGATIVE_NO_RUBRIC * 100}%`;
  }

  return {
    skillName,
    score,
    positivePassRate,
    negativePassRate,
    rubricAvgScore,
    caseScores,
    formula,
  };
}

/**
 * 全量 Skill 打分
 *
 * 聚合所有 Skill 的打分结果，计算整体指标，
 * 输出 Top 3 和末位 3 排行。
 *
 * @param skillScores 所有 Skill 的打分结果
 * @returns 全量 Skill 打分结果
 */
export function scoreAllSkills(skillScores: SkillScore[]): AllSkillsScore {
  const totalSkills = skillScores.length;

  // 计算平均分
  const averageScore = totalSkills > 0
    ? Math.round(
        (skillScores.reduce((sum, s) => sum + s.score, 0) / totalSkills) * 100
      ) / 100
    : 0;

  // 按分数降序排序
  const sorted = [...skillScores].sort((a, b) => b.score - a.score);

  // Top 3 高分 Skill
  const topSkills = sorted.slice(0, Math.min(3, totalSkills));

  // 末位 3 低分 Skill
  const bottomSkills = sorted.slice(Math.max(0, totalSkills - 3)).reverse();

  // 整体健康度 = 平均分（0-100）
  const overallHealth = Math.round(averageScore);

  return {
    averageScore,
    totalSkills,
    topSkills,
    bottomSkills,
    overallHealth,
    skillScores,
  };
}
