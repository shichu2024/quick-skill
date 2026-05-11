import type { CheckContext } from './result-checker.js';
import type { TraceEvent } from '../../types/trace.js';

/**
 * 效率检查结果接口
 * 效率目标检查器的输出
 */
export interface EfficiencyCheckResult {
  /** 检查器标识 */
  checkerId: 'efficiency';
  /** 是否通过 */
  pass: boolean;
  /** 得分（0-25，满分 25） */
  score: number;
  /** 检查详情列表 */
  details: string[];
  /** 此检查器始终适用，始终为 false */
  notApplicable: false;
}

/**
 * 效率检查默认阈值配置
 */
const DEFAULT_THRESHOLDS = {
  /** 命令执行次数上限 */
  maxCommandCount: 10,
  /** Token 用量上限 */
  maxTokenUsage: 10000,
  /** 执行时长上限（毫秒） */
  maxDurationMs: 30000,
};

/**
 * 效率目标检查器
 *
 * 验证执行效率是否达标：
 * 1. 命令执行总次数在预设阈值内（无循环或无效执行）
 * 2. 总 token 用量在预设阈值内
 * 3. 执行时长未超过超时限制
 *
 * 评分分配：
 * - 命令次数检查：8 分
 * - Token 用量检查：9 分
 * - 执行时长检查：8 分
 * - 总计：25 分
 *
 * 此检查器不依赖 SKILL.md 章节，始终适用（notApplicable=false）
 *
 * @param context 检查上下文
 * @returns 检查结果
 */
export function checkEfficiency(context: CheckContext): EfficiencyCheckResult {
  // 从上下文中获取 trace 事件
  // 兼容两种获取方式：直接字段或通过 traceCollector
  const traceEvents = extractTraceEvents(context);

  // 1. 命令执行次数检查（8 分）
  const commandResult = checkCommandCount(traceEvents);

  // 2. Token 用量检查（9 分）
  const tokenResult = checkTokenUsage(traceEvents);

  // 3. 执行时长检查（8 分）
  const durationResult = checkExecutionDuration(traceEvents);

  // 汇总得分
  const score = commandResult.score + tokenResult.score + durationResult.score;
  const allPassed = commandResult.pass && tokenResult.pass && durationResult.pass;

  return {
    checkerId: 'efficiency',
    pass: allPassed,
    score,
    details: [commandResult.message, tokenResult.message, durationResult.message],
    notApplicable: false,
  };
}

/**
 * 从上下文中提取 trace 事件列表
 */
function extractTraceEvents(context: CheckContext): Omit<TraceEvent, 'timestamp'>[] {
  // 优先使用 _traceEvents 扩展字段（测试和实际调用均可能注入）
  const ctx = context as unknown as Record<string, unknown>;
  const extEvents = ctx._traceEvents as
    | Omit<TraceEvent, 'timestamp'>[]
    | undefined;
  if (extEvents && extEvents.length > 0) {
    return extEvents;
  }

  // 如果 traceCollector 有 getEvents 方法，使用它
  const collector = context.traceCollector as unknown as Record<string, unknown>;
  if (typeof collector.getEvents === 'function') {
    return (collector.getEvents() as Omit<TraceEvent, 'timestamp'>[]) || [];
  }

  return [];
}

/**
 * 检查命令执行次数是否在阈值内
 *
 * 满分 8 分
 */
function checkCommandCount(
  events: Omit<TraceEvent, 'timestamp'>[]
): { pass: boolean; score: number; message: string } {
  const commandEvents = events.filter(e => e.eventType === 'command_exec');
  const count = commandEvents.length;
  const maxCount = DEFAULT_THRESHOLDS.maxCommandCount;

  if (count <= maxCount) {
    return {
      pass: true,
      score: 8,
      message: `✓ 命令次数检查: 执行 ${count} 次，在阈值 ${maxCount} 内`,
    };
  }

  // 超标时按比例扣分，严重超标时得 0 分
  const ratio = Math.max(0, 1 - (count - maxCount) / maxCount);
  const score = Math.round(ratio * 8);

  return {
    pass: false,
    score,
    message: `✗ 命令次数检查: 执行 ${count} 次，超过阈值 ${maxCount}（超出 ${count - maxCount} 次）`,
  };
}

/**
 * 检查 Token 用量是否在阈值内
 *
 * 满分 9 分
 */
function checkTokenUsage(
  events: Omit<TraceEvent, 'timestamp'>[]
): { pass: boolean; score: number; message: string } {
  const tokenEvents = events.filter(e => e.eventType === 'token_usage');

  // 无 token 用量事件时，视为未超标，通过检查
  if (tokenEvents.length === 0) {
    return {
      pass: true,
      score: 9,
      message: '⚠ Token 用量检查: 无 token 用量记录，跳过检查',
    };
  }

  // 取最大 token 用量值（totalTokens 字段）
  let maxTokens = 0;
  for (const event of tokenEvents) {
    const totalTokens = (event.detail?.totalTokens as number) ?? 0;
    if (totalTokens > maxTokens) {
      maxTokens = totalTokens;
    }
  }

  const maxUsage = DEFAULT_THRESHOLDS.maxTokenUsage;

  if (maxTokens <= maxUsage) {
    return {
      pass: true,
      score: 9,
      message: `✓ Token 用量检查: 最大 ${maxTokens} tokens，在阈值 ${maxUsage} 内`,
    };
  }

  // 超标时按比例扣分
  const ratio = Math.max(0, 1 - (maxTokens - maxUsage) / maxUsage);
  const score = Math.round(ratio * 9);

  return {
    pass: false,
    score,
    message: `✗ Token 用量检查: 最大 ${maxTokens} tokens，超过阈值 ${maxUsage}（超出 ${maxTokens - maxUsage} tokens）`,
  };
}

/**
 * 检查执行时长是否超过超时限制
 *
 * 满分 8 分
 *
 * 时长计算方式：
 * - 优先使用 command_exec 事件中的 startTime/endTime 计算最大跨度
 * - 若无时间信息，视为未超时
 */
function checkExecutionDuration(
  events: Omit<TraceEvent, 'timestamp'>[]
): { pass: boolean; score: number; message: string } {
  // 尝试从 command_exec 事件中提取时间跨度
  let maxDurationMs = 0;
  let hasTimeInfo = false;

  for (const event of events) {
    if (event.eventType !== 'command_exec') continue;

    const startTime = event.detail?.startTime as string | undefined;
    const endTime = event.detail?.endTime as string | undefined;

    if (startTime && endTime) {
      hasTimeInfo = true;
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
      if (duration > maxDurationMs) {
        maxDurationMs = duration;
      }
    }
  }

  // 无时间信息时，视为未超时
  if (!hasTimeInfo) {
    return {
      pass: true,
      score: 8,
      message: '⚠ 执行时长检查: 无时间信息记录，跳过检查',
    };
  }

  const maxDuration = DEFAULT_THRESHOLDS.maxDurationMs;
  const durationSeconds = Math.round(maxDurationMs / 1000);

  if (maxDurationMs <= maxDuration) {
    return {
      pass: true,
      score: 8,
      message: `✓ 执行时长检查: 最长 ${durationSeconds} 秒，在阈值 ${maxDuration / 1000} 秒内`,
    };
  }

  // 超时按比例扣分
  const ratio = Math.max(0, 1 - (maxDurationMs - maxDuration) / maxDuration);
  const score = Math.round(ratio * 8);

  return {
    pass: false,
    score,
    message: `✗ 执行时长检查: 最长 ${durationSeconds} 秒，超过阈值 ${maxDuration / 1000} 秒（超出 ${Math.round((maxDurationMs - maxDuration) / 1000)} 秒）`,
  };
}
