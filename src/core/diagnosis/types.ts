/**
 * 诊断系统核心类型定义
 */

/** 诊断维度枚举 - 7 个合规性检查维度 */
export enum DiagnosticDimension {
  /** 结构合规性：技能为独立目录，包含核心文件，无零散文件 */
  structure = 'structure',
  /** 元数据合规性：包含 name 和 description 定义 */
  metadata = 'metadata',
  /** 边界合规性：定义 When to use / When NOT to use */
  boundary = 'boundary',
  /** 标准合规性：包含可量化的 Definition of done */
  standard = 'standard',
  /** 格式合规性：文件命名符合 kebab-case */
  format = 'format',
  /** 评测合规性：具备覆盖 4 类核心场景的测试用例 */
  evaluation = 'evaluation',
  /** 兼容性合规性：无单一 Agent 强绑定逻辑 */
  compatibility = 'compatibility',
}

/** 修复等级 */
export type FixLevel = 'required' | 'recommended';

/** 检查状态 */
export type CheckStatus = 'pass' | 'fail' | 'not_applicable';

/** 单个检查项的结果 */
export interface CheckResult {
  /** 所属诊断维度 */
  dimension: DiagnosticDimension;
  /** 检查状态 */
  status: CheckStatus;
  /** 修复等级（仅当 status 为 fail 时有效） */
  fixLevel?: FixLevel;
  /** 检查结果描述 */
  message: string;
  /** 详细信息（可选） */
  details?: string;
  /** 是否可自动修复 */
  autoFixable: boolean;
  /** 修复动作描述（如 "rename", "create directory"） */
  fixAction?: string;
}

/** 单个技能的完整诊断结果 */
export interface DiagnosticResult {
  /** 技能路径 */
  skillPath: string;
  /** 技能名称（从元数据或目录名提取） */
  skillName: string;
  /** 诊断时间戳 */
  timestamp: string;
  /** 各维度检查结果 */
  checks: CheckResult[];
  /** 合规评分（0-100，由评分引擎计算后填入） */
  score?: number;
}

/** 诊断检查器接口 - 每个维度实现此接口 */
export interface DiagnosticChecker {
  /** 所属维度 */
  dimension: DiagnosticDimension;
  /**
   * 执行检查
   * @param skillPath 技能目录路径
   * @returns 检查结果
   */
  check(skillPath: string): Promise<CheckResult>;
}

/** 检查器注册配置 */
export interface CheckerRegistration {
  /** 检查器实例 */
  checker: DiagnosticChecker;
  /** 执行顺序（数字越小越先执行） */
  order: number;
}

/** 诊断引擎配置 */
export interface DiagnosisConfig {
  /** 是否跳过不存在的检查维度 */
  skipNotApplicable?: boolean;
}

/** 批量诊断结果 */
export interface BatchDiagnosticResult {
  /** 总扫描技能数 */
  totalScanned: number;
  /** 合规技能数 */
  compliantCount: number;
  /** 不合规技能数 */
  nonCompliantCount: number;
  /** 诊断失败的技能数 */
  failedCount: number;
  /** 各技能诊断结果 */
  results: (DiagnosticResult | BatchDiagnosisFailure)[];
}

/** 批量诊断中失败的技能记录 */
export interface BatchDiagnosisFailure {
  skillPath: string;
  skillName: string;
  error: string;
  timestamp: string;
}
