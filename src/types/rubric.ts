/**
 * Rubric 评测维度定义
 * 每个维度代表一个独立的评分标准
 */
export interface RubricDimension {
  /** 维度唯一标识 */
  id: string;
  /** 维度显示名称 */
  name: string;
  /** 维度权重（数值越大权重越高，引擎会自动归一化） */
  weight: number;
  /** 发送给模型的评分提示词 */
  prompt: string;
}

/**
 * Rubric 评分 Schema
 * 定义评测的维度集合和通过阈值
 */
export interface RubricSchema {
  /** 评分维度列表 */
  dimensions: RubricDimension[];
  /** 通过阈值（0-1 之间的加权分数） */
  passingThreshold: number;
}

/**
 * 单个维度的评分结果
 */
export interface RubricCheck {
  /** 对应维度的 id */
  id: string;
  /** 该维度是否通过 */
  pass: boolean;
  /** 该维度得分（0-1 之间） */
  score: number;
  /** 评分备注或说明 */
  notes: string;
}

/**
 * Rubric 评测总结果
 */
export interface RubricResult {
  /** 总体是否通过（基于加权分与 passingThreshold 比较） */
  overallPass: boolean;
  /** 加权总分（0-1 之间） */
  score: number;
  /** 各维度的评分详情 */
  checks: RubricCheck[];
  /** 模型调用总次数 */
  modelCalls: number;
  /** 重试总次数 */
  retries: number;
}

/**
 * 模型提供者接口
 * 封装对大语言模型的调用能力
 */
export interface ModelProvider {
  /**
   * 调用模型进行评分
   * @param prompt 评分提示词
   * @param options 可选配置
   * @returns 模型返回的评分结果
   */
  callModel: (
    prompt: string,
    options?: { readOnly?: boolean }
  ) => Promise<unknown>;
}

/**
 * Rubric 评测配置
 */
export interface RubricEvalConfig {
  /** 模型提供者（可选，不提供时返回默认分数） */
  modelProvider?: ModelProvider;
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 是否只读模式（默认 true） */
  readOnly?: boolean;
}
