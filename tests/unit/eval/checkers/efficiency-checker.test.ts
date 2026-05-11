import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkEfficiency } from '../../../../src/eval/checkers/efficiency-checker.js';
import type { CheckContext } from '../../../../src/eval/checkers/result-checker.js';
import type { EfficiencyEfficiencyCheckResult } from '../../../../src/eval/checkers/efficiency-checker.js';
import type { LoadedCase } from '../../../../src/types/eval.js';
import type { SandboxContext } from '../../../../src/eval/sandbox-manager.js';
import type { SkillAnchor } from '../../../../src/types/skill.js';
import type { TraceCollector, TraceEvent } from '../../../../src/types/trace.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'efficiency-checker');

/** 清理测试 fixture 目录 */
function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/** 创建模拟的 TraceCollector，支持注入预定义事件 */
function createMockTraceCollector(events: Omit<TraceEvent, 'timestamp'>[] = []): TraceCollector {
  const tracePath = path.join(testDir, 'trace.jsonl');
  const recordedEvents: Omit<TraceEvent, 'timestamp'>[] = [...events];

  return {
    record: (event: Omit<TraceEvent, 'timestamp'>) => {
      recordedEvents.push(event);
    },
    flush: () => {},
    getTracePath: () => tracePath,
    getEventCount: () => recordedEvents.length,
  };
}

/** 创建默认的 LoadedCase */
function createDefaultTestCase(overrides: Partial<LoadedCase> = {}): LoadedCase {
  return {
    id: 'case-1',
    should_trigger: true,
    prompt: '测试 prompt',
    pass_criteria: '测试标准',
    custom: false,
    deprecated: false,
    isValid: true,
    missingFields: [],
    ...overrides,
  };
}

/** 创建默认的 SkillAnchor */
function createDefaultSkillAnchor(overrides: Partial<SkillAnchor> = {}): SkillAnchor {
  return {
    name: 'test-skill',
    description: '测试 Skill',
    whenToUse: '当需要测试时',
    whenNotToUse: '不需要测试时',
    definitionOfDone: '生成 output.txt',
    whatToBuild: '一个输出',
    steps: '1. 执行操作',
    ...overrides,
  };
}

/** 创建默认的 SandboxContext */
function createDefaultSandbox(): SandboxContext {
  const sandboxDir = path.join(testDir, 'sandbox');
  fs.mkdirSync(sandboxDir, { recursive: true });

  return {
    sandboxDir,
    skillMdPath: path.join(sandboxDir, 'SKILL.md'),
    timeoutMs: 10000,
    cleanup: () => {},
    abortSignal: new AbortController().signal,
  };
}

/** 创建模拟的 CheckContext（包含 efficiency 检查所需的扩展字段） */
function createMockContext(overrides: {
  testCase?: Partial<LoadedCase>;
  skillAnchor?: Partial<SkillAnchor>;
  traceEvents?: Omit<TraceEvent, 'timestamp'>[];
} = {}) {
  const testCase = createDefaultTestCase(overrides.testCase);
  const skillAnchor = createDefaultSkillAnchor(overrides.skillAnchor);
  const sandbox = createDefaultSandbox();
  const traceEvents = overrides.traceEvents || [];
  const traceCollector = createMockTraceCollector(traceEvents);

  return {
    testCase,
    sandbox,
    skillAnchor,
    traceCollector,
    _traceEvents: traceEvents,
  };
}

describe('checkEfficiency', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ─── 命令执行次数检查 ───

  it('当命令执行次数在阈值内时，命令次数检查通过', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd2' }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd3' }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.checkerId).toBe('efficiency');
    expect(result.pass).toBe(true);
    expect(result.notApplicable).toBe(false);
  });

  it('当命令执行次数等于默认阈值（10）时，命令次数检查通过', () => {
    const traceEvents: Omit<TraceEvent, 'timestamp'>[] = [
      { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
    ];
    // 添加恰好 10 个 command_exec 事件
    for (let i = 0; i < 10; i++) {
      traceEvents.push({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: `cmd${i}` },
        result: 'success',
      });
    }

    const context = createMockContext({ traceEvents });
    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('当命令执行次数超过默认阈值（10）时，命令次数检查失败', () => {
    const traceEvents: Omit<TraceEvent, 'timestamp'>[] = [
      { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
    ];
    // 添加 11 个 command_exec 事件
    for (let i = 0; i < 11; i++) {
      traceEvents.push({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: `cmd${i}` },
        result: 'success',
      });
    }

    const context = createMockContext({ traceEvents });
    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('命令'))).toBe(true);
  });

  it('当无命令执行时，命令次数检查通过', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  // ─── Token 用量检查 ───

  it('当 token 用量在阈值内时，token 检查通过', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 5000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('当 token 用量等于默认阈值（10000）时，token 检查通过', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 10000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('当 token 用量超过默认阈值（10000）时，token 检查失败', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 15000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('token') || d.includes('Token'))).toBe(true);
  });

  it('当无 token_usage 事件时，token 检查通过（默认视为未超标）', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('当有多个 token_usage 事件时，取最大值进行检查', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 3000 }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 8000 }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 6000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    // 最大值为 8000，在阈值内
    expect(result.pass).toBe(true);
  });

  // ─── 执行时长检查 ───

  it('当执行时长在阈值内时，时长检查通过', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 5000).toISOString(); // 5 秒前
    const endTime = now.toISOString();

    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1', startTime, endTime }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('当执行时长等于默认阈值（30 秒）时，时长检查通过', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 30000).toISOString(); // 30 秒前
    const endTime = now.toISOString();

    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1', startTime, endTime }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('当执行时长超过默认阈值（30 秒）时，时长检查失败', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 35000).toISOString(); // 35 秒前
    const endTime = now.toISOString();

    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1', startTime, endTime }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('时长') || d.includes('超时'))).toBe(true);
  });

  it('当无时间信息时，时长检查通过（默认视为未超时）', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  // ─── 综合场景 ───

  it('当所有检查都通过时，返回满分 25', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 10000).toISOString(); // 10 秒前
    const endTime = now.toISOString();

    const traceEvents: Omit<TraceEvent, 'timestamp'>[] = [
      { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
    ];
    // 5 个命令
    for (let i = 0; i < 5; i++) {
      traceEvents.push({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: `cmd${i}`, startTime, endTime },
        result: 'success',
      });
    }
    traceEvents.push({ caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 5000 }, result: 'success' });

    const context = createMockContext({ traceEvents });
    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.checkerId).toBe('efficiency');
    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.notApplicable).toBe(false);
  });

  it('当命令次数超标但其他通过时，部分得分', () => {
    const traceEvents: Omit<TraceEvent, 'timestamp'>[] = [
      { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
    ];
    // 15 个命令（超标）
    for (let i = 0; i < 15; i++) {
      traceEvents.push({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: `cmd${i}` },
        result: 'success',
      });
    }
    traceEvents.push({ caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 5000 }, result: 'success' });

    const context = createMockContext({ traceEvents });
    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
  });

  it('当 token 超标但其他通过时，部分得分', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 20000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
  });

  it('当所有检查都失败时，score 为 0', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60000).toISOString(); // 60 秒前
    const endTime = now.toISOString();

    const traceEvents: Omit<TraceEvent, 'timestamp'>[] = [
      { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
    ];
    // 20 个命令（超标）
    for (let i = 0; i < 20; i++) {
      traceEvents.push({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: `cmd${i}`, startTime, endTime },
        result: 'success',
      });
    }
    traceEvents.push({ caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 50000 }, result: 'success' });

    const context = createMockContext({ traceEvents });
    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  // ─── 边界场景 ───

  it('score 范围始终在 0-25 之间', () => {
    const contexts = [
      // 空 trace
      createMockContext({
        traceEvents: [],
      }),
      // 全部通过
      createMockContext({
        traceEvents: [
          { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
          { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
        ],
      }),
      // 全部失败
      createMockContext({
        traceEvents: (() => {
          const now = new Date();
          const startTime = new Date(now.getTime() - 60000).toISOString();
          const endTime = now.toISOString();
          const events: Omit<TraceEvent, 'timestamp'>[] = [
            { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
          ];
          for (let i = 0; i < 20; i++) {
            events.push({
              caseId: 'case-1',
              eventType: 'command_exec',
              detail: { command: `cmd${i}`, startTime, endTime },
              result: 'success',
            });
          }
          events.push({ caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 50000 }, result: 'success' });
          return events;
        })(),
      }),
    ];

    for (const ctx of contexts) {
      const result = checkEfficiency(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(25);
    }
  });

  it('返回的 details 包含各检查项的通过/失败状态', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 5000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details.every(d => d.includes('✓') || d.includes('✗') || d.includes('⚠'))).toBe(true);
  });

  it('notApplicable 始终为 false', () => {
    const context = createMockContext({
      traceEvents: [],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.notApplicable).toBe(false);
  });

  // ─── AC-003-4: 效率目标检查 — 命令次数、token 用量、执行时长 ───

  it('AC-003-4: 命令执行总次数在预设阈值内（无循环或无效执行），验证通过', () => {
    const traceEvents: Omit<TraceEvent, 'timestamp'>[] = [
      { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
    ];
    // 合理的命令数量（5 个）
    for (let i = 0; i < 5; i++) {
      traceEvents.push({
        caseId: 'case-1',
        eventType: 'command_exec',
        detail: { command: `cmd${i}` },
        result: 'success',
      });
    }

    const context = createMockContext({ traceEvents });
    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('AC-003-4: 总 token 用量在预设阈值内，验证通过', () => {
    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 8000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
  });

  it('AC-003-4: 执行时长未超过超时限制，验证通过', () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 15000).toISOString(); // 15 秒
    const endTime = now.toISOString();

    const context = createMockContext({
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1', startTime, endTime }, result: 'success' },
        { caseId: 'case-1', eventType: 'token_usage', detail: { totalTokens: 5000 }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.pass).toBe(true);
    expect(result.details.some(d => d.includes('时长'))).toBe(true);
  });

  it('AC-003-4: 此检查器不依赖 SKILL.md 章节，始终适用', () => {
    // 即使 skillAnchor 中缺少各种章节，efficiency 检查仍然适用
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试',
        whenToUse: '',
        whenNotToUse: '',
        definitionOfDone: '',
        whatToBuild: '',
        steps: '',
      },
      traceEvents: [
        { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        { caseId: 'case-1', eventType: 'command_exec', detail: { command: 'cmd1' }, result: 'success' },
      ],
    });

    const result: EfficiencyCheckResult = checkEfficiency(context);

    expect(result.notApplicable).toBe(false);
  });
});
