import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createTraceCollector } from '../../../src/eval/trace-collector.js';
import type { TraceCollector, TraceEvent } from '../../../src/types/trace.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'trace-collector');

/** 清理测试 fixture 目录 */
function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/** 读取 JSONL 文件并解析为事件数组 */
function readJsonlEvents(filePath: string): TraceEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter((line) => line.length > 0);
  return lines.map((line) => JSON.parse(line));
}

describe('createTraceCollector', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ─── AC-006-1: JSONL 格式结构化 trace 日志 ───

  describe('JSONL 格式', () => {
    it('flush 后将事件写入 JSONL 文件，每行一个 JSON 对象', () => {
      const tracePath = path.join(testDir, 'trace.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: { skillName: 'test-skill' },
        result: 'success',
      });

      collector.flush();

      expect(fs.existsSync(tracePath)).toBe(true);
      const content = fs.readFileSync(tracePath, 'utf-8');
      const lines = content.trim().split('\n').filter((line) => line.length > 0);
      expect(lines.length).toBe(1);

      // 验证每行是有效的 JSON
      const parsed = JSON.parse(lines[0]);
      expect(parsed.caseId).toBe('case-1');
      expect(parsed.eventType).toBe('skill_trigger');
    });

    it('多次 record 后 flush，每行对应一个事件', () => {
      const tracePath = path.join(testDir, 'trace-multi.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      collector.record({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: 'npm test' },
        result: 'success',
      });
      collector.record({
        caseId: 'case-1',
        eventType: 'file_op',
        detail: { path: 'output.txt', op: 'create' },
        result: 'success',
      });

      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events.length).toBe(3);
      expect(events[0].eventType).toBe('skill_trigger');
      expect(events[1].eventType).toBe('command_exec');
      expect(events[2].eventType).toBe('file_op');
    });
  });

  // ─── AC-006-2: 5 类事件类型 ───

  describe('事件类型支持', () => {
    const eventTypes: Array<TraceEvent['eventType']> = [
      'skill_trigger',
      'command_exec',
      'file_op',
      'token_usage',
      'model_call',
    ];

    it.each(eventTypes)('支持记录 %s 类型事件', (eventType) => {
      const tracePath = path.join(testDir, `trace-${eventType}.jsonl`);
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType,
        detail: { test: true },
        result: 'success',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe(eventType);
    });
  });

  // ─── AC-006-3: 每条事件包含时间戳、用例 id、事件类型、详情、结果 ───

  describe('事件字段完整性', () => {
    it('record 后自动添加 ISO 8601 格式时间戳', () => {
      const tracePath = path.join(testDir, 'trace-timestamp.jsonl');
      const collector = createTraceCollector(tracePath);

      const beforeRecord = new Date().toISOString();
      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      const afterRecord = new Date().toISOString();
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events[0].timestamp).toBeDefined();

      // 验证时间戳在 record 调用期间生成
      expect(events[0].timestamp >= beforeRecord).toBe(true);
      expect(events[0].timestamp <= afterRecord).toBe(true);
    });

    it('事件包含 caseId、eventType、detail、result 字段', () => {
      const tracePath = path.join(testDir, 'trace-fields.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-42',
        eventType: 'command_exec',
        detail: { command: 'npm run build', exitCode: 0 },
        result: 'success',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      const event = events[0];

      expect(event.caseId).toBe('case-42');
      expect(event.eventType).toBe('command_exec');
      expect(event.detail).toEqual({ command: 'npm run build', exitCode: 0 });
      expect(event.result).toBe('success');
    });

    it('失败事件包含 failureReason 字段', () => {
      const tracePath = path.join(testDir, 'trace-failure.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: 'npm test' },
        result: 'failure',
        failureReason: 'Exit code 1: 2 tests failed',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events[0].failureReason).toBe('Exit code 1: 2 tests failed');
    });

    it('成功事件不包含 failureReason 字段', () => {
      const tracePath = path.join(testDir, 'trace-success.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events[0].failureReason).toBeUndefined();
    });
  });

  // ─── AC-006-4: 事件顺序与实际执行顺序一致 ───

  describe('顺序一致性', () => {
    it('record 的顺序与 flush 后文件中的顺序一致', () => {
      const tracePath = path.join(testDir, 'trace-order.jsonl');
      const collector = createTraceCollector(tracePath);

      // 模拟实际执行顺序
      const expectedOrder = [
        { eventType: 'skill_trigger' as const, caseId: 'case-1' },
        { eventType: 'command_exec' as const, caseId: 'case-1' },
        { eventType: 'file_op' as const, caseId: 'case-1' },
        { eventType: 'token_usage' as const, caseId: 'case-1' },
        { eventType: 'model_call' as const, caseId: 'case-1' },
        { eventType: 'skill_trigger' as const, caseId: 'case-2' },
        { eventType: 'command_exec' as const, caseId: 'case-2' },
      ];

      expectedOrder.forEach((item) => {
        collector.record({
          caseId: item.caseId,
          eventType: item.eventType,
          detail: {},
          result: 'success',
        });
      });

      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events.length).toBe(expectedOrder.length);

      expectedOrder.forEach((expected, index) => {
        expect(events[index].eventType).toBe(expected.eventType);
        expect(events[index].caseId).toBe(expected.caseId);
      });
    });

    it('时间戳顺序与 record 顺序一致', () => {
      const tracePath = path.join(testDir, 'trace-timestamp-order.jsonl');
      const collector = createTraceCollector(tracePath);

      for (let i = 0; i < 5; i++) {
        collector.record({
          caseId: `case-${i}`,
          eventType: 'command_exec',
          detail: { index: i },
          result: 'success',
        });
      }
      collector.flush();

      const events = readJsonlEvents(tracePath);
      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i].timestamp <= events[i + 1].timestamp).toBe(true);
      }
    });
  });

  // ─── AC-006-5: 失败时输出 trace 日志路径 ───

  describe('getTracePath', () => {
    it('返回创建时指定的输出文件路径', () => {
      const tracePath = path.join(testDir, 'trace-path.jsonl');
      const collector = createTraceCollector(tracePath);

      expect(collector.getTracePath()).toBe(tracePath);
    });
  });

  // ─── AC-006-6: 失败节点包含失败原因和上下文 ───

  describe('失败事件处理', () => {
    it('记录失败事件时包含 failureReason 和上下文 detail', () => {
      const tracePath = path.join(testDir, 'trace-failure-context.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-fail-1',
        eventType: 'model_call',
        detail: {
          model: 'gpt-4',
          prompt: 'test prompt',
          attempt: 3,
        },
        result: 'failure',
        failureReason: 'API timeout after 3 retries',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      const event = events[0];

      expect(event.result).toBe('failure');
      expect(event.failureReason).toBe('API timeout after 3 retries');
      expect(event.detail).toEqual({
        model: 'gpt-4',
        prompt: 'test prompt',
        attempt: 3,
      });
    });

    it('支持 skip 结果类型', () => {
      const tracePath = path.join(testDir, 'trace-skip.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-skip-1',
        eventType: 'command_exec',
        detail: { command: 'npm test', reason: 'deprecated' },
        result: 'skip',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events[0].result).toBe('skip');
    });
  });

  // ─── 其他功能测试 ───

  describe('getEventCount', () => {
    it('返回已记录的事件总数', () => {
      const tracePath = path.join(testDir, 'trace-count.jsonl');
      const collector = createTraceCollector(tracePath);

      expect(collector.getEventCount()).toBe(0);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      expect(collector.getEventCount()).toBe(1);

      collector.record({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: {},
        result: 'success',
      });
      expect(collector.getEventCount()).toBe(2);

      collector.flush();
      // flush 后事件计数保持不变
      expect(collector.getEventCount()).toBe(2);
    });
  });

  describe('多次 flush', () => {
    it('多次 flush 不会重复写入已刷新的事件', () => {
      const tracePath = path.join(testDir, 'trace-multi-flush.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      collector.flush();
      collector.flush();
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events.length).toBe(1);
    });

    it('flush 后继续 record 新事件，再次 flush 追加写入', () => {
      const tracePath = path.join(testDir, 'trace-append.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      collector.flush();

      collector.record({
        caseId: 'case-2',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events.length).toBe(2);
      expect(events[0].caseId).toBe('case-1');
      expect(events[1].caseId).toBe('case-2');
    });
  });

  describe('边界条件', () => {
    it('空 detail 对象也能正确序列化', () => {
      const tracePath = path.join(testDir, 'trace-empty-detail.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'skill_trigger',
        detail: {},
        result: 'success',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events[0].detail).toEqual({});
    });

    it('detail 包含嵌套对象也能正确序列化', () => {
      const tracePath = path.join(testDir, 'trace-nested.jsonl');
      const collector = createTraceCollector(tracePath);

      collector.record({
        caseId: 'case-1',
        eventType: 'model_call',
        detail: {
          model: 'gpt-4',
          config: { temperature: 0.7, maxTokens: 1000 },
          response: { content: 'test', usage: { prompt: 100, completion: 50 } },
        },
        result: 'success',
      });
      collector.flush();

      const events = readJsonlEvents(tracePath);
      expect(events[0].detail).toEqual({
        model: 'gpt-4',
        config: { temperature: 0.7, maxTokens: 1000 },
        response: { content: 'test', usage: { prompt: 100, completion: 50 } },
      });
    });
  });
});
