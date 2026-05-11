import fs from 'fs';
import path from 'path';
import type { TraceEvent, TraceCollector } from '../types/trace.js';

/**
 * 创建 Trace 收集器实例
 *
 * @param outputPath JSONL 输出文件的完整路径
 * @returns TraceCollector 实例
 *
 * 功能说明：
 * - 同步记录事件，确保事件顺序与实际执行顺序一致
 * - 缓冲区管理：record 将事件加入缓冲区，flush 将缓冲区写入文件
 * - 多次 flush 不会重复写入已刷新的事件
 * - flush 后继续 record 的新事件会在下次 flush 时追加写入
 */
export function createTraceCollector(outputPath: string): TraceCollector {
  // 事件缓冲区
  const buffer: TraceEvent[] = [];
  // 已刷新到文件的事件数量（用于避免重复写入）
  let flushedCount = 0;

  /**
   * 记录一个 Trace 事件
   * 自动添加 ISO 8601 格式时间戳
   */
  function record(event: Omit<TraceEvent, 'timestamp'>): void {
    const fullEvent: TraceEvent = {
      timestamp: new Date().toISOString(),
      ...event,
    };
    buffer.push(fullEvent);
  }

  /**
   * 将缓冲区中的新事件追加写入 JSONL 文件
   * 只有自上次 flush 后新增的事件会被写入
   */
  function flush(): void {
    // 如果没有新事件，直接返回
    if (buffer.length <= flushedCount) {
      return;
    }

    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 获取需要写入的新事件
    const newEvents = buffer.slice(flushedCount);

    // 将新事件序列化为 JSONL 格式并追加写入
    const lines = newEvents.map((event) => JSON.stringify(event)).join('\n') + '\n';
    fs.appendFileSync(outputPath, lines, 'utf-8');

    // 更新已刷新计数
    flushedCount = buffer.length;
  }

  /**
   * 获取 Trace 输出文件路径
   */
  function getTracePath(): string {
    return outputPath;
  }

  /**
   * 获取已记录的事件总数
   */
  function getEventCount(): number {
    return buffer.length;
  }

  return {
    record,
    flush,
    getTracePath,
    getEventCount,
  };
}
