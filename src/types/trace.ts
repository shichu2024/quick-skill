/**
 * Trace 事件类型枚举
 * - skill_trigger: Skill 触发事件
 * - command_exec: 命令执行事件
 * - file_op: 文件操作事件
 * - token_usage: Token 用量事件
 * - model_call: 模型调用事件
 */
export type TraceEventType =
  | 'skill_trigger'
  | 'command_exec'
  | 'file_op'
  | 'token_usage'
  | 'model_call';

/**
 * 单次执行的结果状态
 * - success: 执行成功
 * - failure: 执行失败
 * - skip: 跳过执行
 */
export type TraceResult = 'success' | 'failure' | 'skip';

/**
 * Trace 事件接口
 * 记录评测执行过程中的单个事件
 */
export interface TraceEvent {
  /** ISO 8601 格式时间戳 */
  timestamp: string;
  /** 关联的用例 ID */
  caseId: string;
  /** 事件类型 */
  eventType: TraceEventType;
  /** 事件详情（上下文信息） */
  detail: Record<string, unknown>;
  /** 执行结果 */
  result: TraceResult;
  /** 失败原因（仅 result 为 failure 时存在） */
  failureReason?: string;
}

/**
 * Trace 收集器接口
 * 负责记录、缓冲和持久化 Trace 事件
 */
export interface TraceCollector {
  /**
   * 记录一个 Trace 事件（自动添加时间戳）
   * @param event 不包含 timestamp 的事件对象
   */
  record(event: Omit<TraceEvent, 'timestamp'>): void;

  /**
   * 将缓冲区中的事件写入 JSONL 文件
   * 多次 flush 不会重复写入已刷新的事件
   */
  flush(): void;

  /**
   * 获取 Trace 输出文件的完整路径
   */
  getTracePath(): string;

  /**
   * 获取已记录的事件总数
   */
  getEventCount(): number;
}

/**
 * Trace 日志接口（用于外部引用）
 */
export interface TraceLog {
  /** Trace 文件路径 */
  path: string;
  /** 事件总数 */
  eventCount: number;
}
