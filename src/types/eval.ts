import { TestCase } from './test-case.js';
import type { DeterministicEvalResult } from '../eval/deterministic-engine.js';
import type { RubricResult } from './rubric.js';

/**
 * 加载后的用例，扩展 TestCase 增加校验元信息
 */
export interface LoadedCase extends TestCase {
  /** 该用例是否通过必填字段校验 */
  isValid: boolean;
  /** 缺失的必填字段列表 */
  missingFields: string[];
}

/**
 * 用例加载结果
 */
export interface LoadResult {
  /** 有效用例列表（含 isValid=false 的无效用例，供调用方排查） */
  cases: LoadedCase[];
  /** 因 deprecated=true 跳过的用例数 */
  skippedCount: number;
  /** 警告信息（文件不存在、字段缺失等） */
  warnings: string[];
}

// ==================== 打分体系类型 ====================

/**
 * 扣分项信息
 * 记录每项扣分的原因和扣分值
 */
export interface DeductionInfo {
  /** 扣分原因描述 */
  reason: string;
  /** 扣分值（0-100） */
  amount: number;
  /** 扣分来源：'deterministic' | 'rubric' */
  source: 'deterministic' | 'rubric';
}

/**
 * 单条用例打分结果
 */
export interface CaseScore {
  /** 用例唯一标识 */
  caseId: string;
  /** 综合得分（0-100） */
  score: number;
  /** 确定性评测得分（0-100） */
  deterministicScore: number;
  /** Rubric 定性评测得分（0-100），未启用时为 null */
  rubricScore: number | null;
  /** 扣分项列表 */
  deductions: DeductionInfo[];
  /** 该用例是否期望触发 Skill（用于区分正例/负例） */
  shouldTrigger: boolean;
}

/**
 * 单个 Skill 打分结果
 */
export interface SkillScore {
  /** Skill 名称 */
  skillName: string;
  /** 综合得分（0-100） */
  score: number;
  /** 正例通过率（0-1） */
  positivePassRate: number;
  /** 负例准确率（0-1） */
  negativePassRate: number;
  /** Rubric 平均分（0-100），未启用时为 null */
  rubricAvgScore: number | null;
  /** 所有用例的打分详情 */
  caseScores: CaseScore[];
  /** 打分公式描述 */
  formula: string;
}

/**
 * 全量 Skill 打分结果
 */
export interface AllSkillsScore {
  /** 全量 Skill 平均分 */
  averageScore: number;
  /** Skill 总数 */
  totalSkills: number;
  /** Top 3 高分 Skill */
  topSkills: SkillScore[];
  /** 末位 3 低分 Skill */
  bottomSkills: SkillScore[];
  /** 整体健康度（0-100） */
  overallHealth: number;
  /** 所有 Skill 的打分详情 */
  skillScores: SkillScore[];
}

/**
 * 单条用例评测原始结果（scoreCase 的输入）
 */
export interface CaseEvalResult {
  /** 用例唯一标识 */
  caseId: string;
  /** 该用例是否期望触发 Skill */
  shouldTrigger: boolean;
  /** 确定性评测结果 */
  deterministicResult: DeterministicEvalResult;
  /** Rubric 评测结果（可选，未启用时为 undefined） */
  rubricResult?: RubricResult;
}
