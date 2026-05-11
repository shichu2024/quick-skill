import fs from 'fs';
import path from 'path';
import type { SkillScore, CaseScore } from '../types/eval.js';

/**
 * 回归类型
 * - new_failure: 之前通过的用例现在完全失败（得分为 0）
 * - score_drop: 用例得分下降但未完全失败
 */
export type RegressionType = 'new_failure' | 'score_drop';

/**
 * 单条回归项
 */
export interface RegressionItem {
  /** 用例唯一标识 */
  caseId: string;
  /** 回归类型 */
  type: RegressionType;
  /** 上次得分 */
  previousScore?: number;
  /** 当前得分 */
  currentScore: number;
  /** 下降幅度 */
  dropAmount?: number;
}

/**
 * 回归检测结果
 */
export interface RegressionResult {
  /** 是否为首次评测（无历史结果） */
  isFirstRun: boolean;
  /** 回归项列表 */
  regressions: RegressionItem[];
  /** 是否存在回归 */
  hasRegression: boolean;
  /** 上次 Skill 级别得分 */
  previousScore: number | null;
  /** 得分变化量（当前 - 上次） */
  scoreDelta: number | null;
}

/**
 * detectRegression 函数输入参数
 */
export interface DetectRegressionInput {
  /** 当前 Skill 级别打分结果 */
  currentSkillScore: SkillScore;
  /** Skill 名称 */
  skillName: string;
  /** Skill 业务分类 */
  category: string;
  /** 当前评测时间戳（ISO 8601） */
  currentTimestamp: string;
  /** 评测归档根目录（默认 .quick-skill-eval） */
  evalRoot?: string;
}

/**
 * 从持久化结果文件中提取 SkillScore
 */
interface PersistedResult {
  skillScore: SkillScore;
}

/**
 * 自动对比当前评测结果与该 Skill 上一次的历史结果，
 * 标注新增失败和得分下降。
 *
 * @param input 回归检测输入参数
 * @returns 回归检测结果
 *
 * 查找逻辑:
 * - 扫描 evalRoot 下所有时间目录
 * - 按时间排序，找到当前时间戳之前最近的一次
 * - 读取该时间目录下对应 category/skillName 的 result.json
 *
 * 对比逻辑:
 * - 对比 Skill 级别得分变化
 * - 对比每条共有用例的得分变化
 * - 得分降到 0 视为 new_failure
 * - 得分下降但未到 0 视为 score_drop
 *
 * 错误处理:
 * - 无历史结果时标注首次评测
 * - 历史结果文件不存在或解析失败时视为首次评测
 * - evalRoot 目录不存在时视为首次评测
 */
export function detectRegression(input: DetectRegressionInput): RegressionResult {
  const evalRoot = input.evalRoot ?? process.env.QUICK_SKILL_EVAL_ROOT ?? path.join(process.cwd(), '.quick-skill-eval');

  // 尝试查找上一次历史结果
  const previousResult = findPreviousResult(
    evalRoot,
    input.category,
    input.skillName,
    input.currentTimestamp
  );

  // 无历史结果，标注首次评测
  if (previousResult === null) {
    return {
      isFirstRun: true,
      regressions: [],
      hasRegression: false,
      previousScore: null,
      scoreDelta: null,
    };
  }

  const previousScore = previousResult.skillScore.score;
  const currentScore = input.currentSkillScore.score;
  const scoreDelta = currentScore - previousScore;

  // 对比用例级别得分
  const regressions = compareCaseScores(
    previousResult.skillScore.caseScores,
    input.currentSkillScore.caseScores
  );

  // 判断是否存在回归：有用例回归或 Skill 级别得分下降
  const hasRegression = regressions.length > 0 || scoreDelta < 0;

  return {
    isFirstRun: false,
    regressions,
    hasRegression,
    previousScore,
    scoreDelta,
  };
}

/**
 * 查找上一次历史结果
 *
 * 扫描 evalRoot 下所有时间目录，按时间排序，
 * 找到当前时间戳之前最近的一次，读取对应 skill 的 result.json。
 *
 * @param evalRoot 评测归档根目录
 * @param category 业务分类
 * @param skillName Skill 名称
 * @param currentTimestamp 当前时间戳
 * @returns 历史结果，找不到时返回 null
 */
function findPreviousResult(
  evalRoot: string,
  category: string,
  skillName: string,
  currentTimestamp: string
): PersistedResult | null {
  // 目录不存在时视为首次评测
  if (!fs.existsSync(evalRoot)) {
    return null;
  }

  try {
    // 读取所有时间目录
    const entries = fs.readdirSync(evalRoot, { withFileTypes: true });
    const timeDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      // 过滤出符合 YYYYMMDD-HHmmss 格式的目录名
      .filter(name => /^\d{8}-\d{6}$/.test(name))
      // 转换为时间戳并排序
      .map(name => ({
        name,
        timestamp: timeDirToTimestamp(name),
      }))
      // 只保留当前时间之前的目录
      .filter(item => item.timestamp < new Date(currentTimestamp).getTime())
      // 按时间降序排列
      .sort((a, b) => b.timestamp - a.timestamp);

    // 遍历最近的时间目录，找到第一个包含目标 skill 结果的
    for (const timeDir of timeDirs) {
      const resultPath = path.join(evalRoot, timeDir.name, category, skillName, 'result.json');

      if (fs.existsSync(resultPath)) {
        try {
          const content = fs.readFileSync(resultPath, 'utf-8');
          const parsed = JSON.parse(content) as PersistedResult;

          // 验证必要字段存在
          if (parsed.skillScore && typeof parsed.skillScore.score === 'number') {
            return parsed;
          }
        } catch {
          // JSON 解析失败，跳过此目录继续查找
          continue;
        }
      }
    }
  } catch {
    // 读取目录失败，视为首次评测
    return null;
  }

  return null;
}

/**
 * 将 YYYYMMDD-HHmmss 格式的目录名转换为时间戳
 *
 * @param timeDir 目录名
 * @returns 毫秒时间戳
 */
function timeDirToTimestamp(timeDir: string): number {
  // 格式: 20260509-103000
  const year = parseInt(timeDir.substring(0, 4), 10);
  const month = parseInt(timeDir.substring(4, 6), 10) - 1; // 月份从 0 开始
  const day = parseInt(timeDir.substring(6, 8), 10);
  const hour = parseInt(timeDir.substring(9, 11), 10);
  const minute = parseInt(timeDir.substring(11, 13), 10);
  const second = parseInt(timeDir.substring(13, 15), 10);

  return new Date(Date.UTC(year, month, day, hour, minute, second)).getTime();
}

/**
 * 对比用例级别得分，找出回归项
 *
 * 只对比历史结果和当前结果中都存在的用例（共有用例）。
 * - 当前得分为 0 且历史得分 > 0：标记为 new_failure
 * - 当前得分 < 历史得分且当前得分 > 0：标记为 score_drop
 *
 * @param previousCases 历史用例得分列表
 * @param currentCases 当前用例得分列表
 * @returns 回归项列表
 */
function compareCaseScores(
  previousCases: CaseScore[],
  currentCases: CaseScore[]
): RegressionItem[] {
  const regressions: RegressionItem[] = [];

  // 构建当前用例的得分映射
  const currentScoreMap = new Map<string, number>();
  for (const cs of currentCases) {
    currentScoreMap.set(cs.caseId, cs.score);
  }

  // 遍历历史用例，只对比共有用例
  for (const prev of previousCases) {
    const currentScore = currentScoreMap.get(prev.caseId);

    // 当前结果中不存在该用例，跳过（不算回归）
    if (currentScore === undefined) {
      continue;
    }

    // 得分下降才视为回归
    if (currentScore < prev.score) {
      const dropAmount = prev.score - currentScore;

      // 得分降到 0 视为新增失败
      const type: RegressionType = currentScore === 0 ? 'new_failure' : 'score_drop';

      regressions.push({
        caseId: prev.caseId,
        type,
        previousScore: prev.score,
        currentScore,
        dropAmount,
      });
    }
  }

  return regressions;
}
