import type {
  RubricSchema,
  RubricResult,
  RubricCheck,
  RubricEvalConfig,
  ModelProvider,
} from '../types/rubric.js';

/**
 * 默认最大重试次数
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * 默认是否只读
 */
const DEFAULT_READ_ONLY = true;

/**
 * 模型评分响应接口
 * 模型返回的标准化评分结果
 */
interface ModelScoreResponse {
  score: number;
  pass: boolean;
  notes: string;
}

/**
 * 将分数归一化到 [0, 1] 区间
 * @param score 原始分数
 * @returns 归一化后的分数
 */
function normalizeScore(score: number): number {
  if (score <= 0) return 0;
  if (score >= 1) return 1;
  return score;
}

/**
 * 安全解析模型返回的评分结果
 * 处理非标准响应、null/undefined 等情况
 * @param response 模型原始响应
 * @returns 标准化后的评分结果
 */
function parseModelResponse(response: unknown): ModelScoreResponse {
  // 处理 null/undefined 或非对象类型
  if (!response || typeof response !== 'object') {
    return { score: 0, pass: false, notes: '模型返回无效响应' };
  }

  const obj = response as Record<string, unknown>;

  const score = typeof obj.score === 'number' ? normalizeScore(obj.score) : 0;
  const pass = typeof obj.pass === 'boolean' ? obj.pass : score > 0;
  const notes = typeof obj.notes === 'string' ? obj.notes : '无备注';

  return { score, pass, notes };
}

/**
 * 带重试机制的模型调用
 * @param provider 模型提供者
 * @param prompt 评分提示词
 * @param maxRetries 最大重试次数
 * @param readOnly 是否只读模式
 * @returns { response, retries } 模型响应和实际重试次数
 */
async function callWithRetry(
  provider: ModelProvider,
  prompt: string,
  maxRetries: number,
  readOnly: boolean
): Promise<{ response: unknown; retries: number }> {
  let retries = 0;

  // 初始调用（attempt = 0）
  try {
    const response = await provider.callModel(prompt, { readOnly });
    return { response, retries: 0 };
  } catch {
    // 初始调用失败，进入重试循环
  }

  // 最多 maxRetries 次重试
  for (let i = 0; i < maxRetries; i++) {
    retries++;
    try {
      const response = await provider.callModel(prompt, { readOnly });
      return { response, retries };
    } catch {
      // 重试失败，继续下一次重试
      if (i === maxRetries - 1) {
        // 最后一次重试也失败了
        break;
      }
    }
  }

  // 所有尝试均失败
  return {
    response: null,
    retries,
  };
}

/**
 * 运行 Rubric 定性评测
 *
 * 根据自定义的 Rubric Schema 对内容进行多维度评分。
 * 模型辅助为可选功能，默认不启用。
 * 评分执行采用只读模式，模型调用失败内置重试机制。
 *
 * @param schema Rubric 评分 Schema，定义维度和通过阈值
 * @param content 待评测的内容
 * @param config 评测配置（可选）
 * @returns Rubric 评测结果
 */
export async function runRubricEval(
  schema: RubricSchema,
  content: string,
  config: RubricEvalConfig = {}
): Promise<RubricResult> {
  const {
    modelProvider,
    maxRetries = DEFAULT_MAX_RETRIES,
    readOnly = DEFAULT_READ_ONLY,
  } = config;

  const checks: RubricCheck[] = [];
  let totalModelCalls = 0;
  let totalRetries = 0;

  // 遍历每个维度进行评分
  for (const dimension of schema.dimensions) {
    let checkResult: ModelScoreResponse;

    if (modelProvider) {
      // 构建发送给模型的评分提示
      const prompt = `${dimension.prompt}\n\n待评测内容：\n${content}`;

      // 调用模型（带重试机制）
      const { response, retries } = await callWithRetry(
        modelProvider,
        prompt,
        maxRetries,
        readOnly
      );

      totalModelCalls += 1 + retries; // 初始调用 + 重试次数
      totalRetries += retries;

      checkResult = parseModelResponse(response);
    } else {
      // 无模型提供者时返回默认分数
      checkResult = { score: 0, pass: false, notes: '未启用模型辅助评分' };
      totalModelCalls += 0;
    }

    checks.push({
      id: dimension.id,
      pass: checkResult.pass,
      score: checkResult.score,
      notes: checkResult.notes,
    });
  }

  // 计算加权总分
  const totalWeight = schema.dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedScore =
    totalWeight > 0
      ? checks.reduce((sum, check, index) => {
          return sum + check.score * schema.dimensions[index].weight;
        }, 0) / totalWeight
      : 0;

  // 判断是否通过
  const overallPass = weightedScore >= schema.passingThreshold;

  return {
    overallPass,
    score: weightedScore,
    checks,
    modelCalls: totalModelCalls,
    retries: totalRetries,
  };
}
