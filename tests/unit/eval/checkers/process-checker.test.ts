import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkProcess } from '../../../../src/eval/checkers/process-checker.js';
import type { ProcessCheckResult } from '../../../../src/eval/checkers/process-checker.js';
import type { LoadedCase } from '../../../../src/types/eval.js';
import type { SandboxContext } from '../../../../src/eval/sandbox-manager.js';
import type { SkillAnchor } from '../../../../src/types/skill.js';
import type { TraceCollector, TraceEvent } from '../../../../src/types/trace.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'process-checker');

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

/** 创建模拟的 CheckContext（包含 process 检查所需的扩展字段） */
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

describe('checkProcess', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ─── should_trigger 验证 ───

  it('当 should_trigger=true 且 trace 中有 skill_trigger 事件时，trigger 检查通过', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: { steps: '' }, // 无步骤定义，仅检查触发
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.checkerId).toBe('process');
    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 should_trigger=false 且 trace 中无 skill_trigger 事件（或 triggered=false）时，trigger 检查通过', () => {
    const context = createMockContext({
      testCase: { should_trigger: false },
      skillAnchor: { steps: '' },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: false },
          result: 'skip',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 should_trigger=true 但实际未触发时，trigger 检查失败', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: {
        steps: '1. 执行操作',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: false },
          result: 'skip',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.details.some(d => d.includes('触发'))).toBe(true);
  });

  it('当 should_trigger=false 但实际触发了时，trigger 检查失败', () => {
    const context = createMockContext({
      testCase: { should_trigger: false },
      skillAnchor: {
        steps: '1. 执行操作',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('不应被触发'))).toBe(true);
  });

  it('当 trace 中无 skill_trigger 事件且 should_trigger=true 时，trigger 检查失败', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: {
        steps: '1. 执行操作',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('触发'))).toBe(true);
  });

  it('当 trace 中无 skill_trigger 事件且 should_trigger=false 时，trigger 检查通过', () => {
    const context = createMockContext({
      testCase: { should_trigger: false },
      skillAnchor: {
        steps: '1. 执行操作',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  // ─── 步骤一致性验证 ───

  it('当 steps 与 trace 中的 command_exec 事件一致时，步骤检查通过', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 读取输入文件\n2. 处理数据\n3. 生成输出文件',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '读取输入文件' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '处理数据' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '生成输出文件' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('当 steps 与 trace 中的命令不一致时（缺少步骤），步骤检查失败', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 读取输入文件\n2. 处理数据\n3. 生成输出文件',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '读取输入文件' },
          result: 'success',
        },
        // 缺少"处理数据"和"生成输出文件"
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.details.some(d => d.includes('步骤'))).toBe(true);
  });

  it('当 trace 中有多余步骤（超出 steps 定义）时，步骤检查失败', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 读取输入文件',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '读取输入文件' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '多余步骤' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('多余'))).toBe(true);
  });

  // ─── 命令顺序验证 ───

  it('当命令执行顺序与 steps 顺序一致时，顺序检查通过', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 步骤A\n2. 步骤B\n3. 步骤C',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤A' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤B' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤C' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
  });

  it('当命令执行顺序与 steps 顺序不一致时，顺序检查失败', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 步骤A\n2. 步骤B\n3. 步骤C',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤C' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤A' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤B' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('顺序'))).toBe(true);
  });

  // ─── notApplicable 场景 ───

  it('当 skillAnchor 缺少 steps 字段时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        // 显式移除 steps 字段
        steps: undefined as unknown as string,
        name: 'test-skill',
        description: '测试',
        whenToUse: '',
        whenNotToUse: '',
        definitionOfDone: '',
        whatToBuild: '',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 steps 为空字符串时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.notApplicable).toBe(true);
  });

  it('当 steps 仅为空白字符时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '   \n  \t  ',
      },
      traceEvents: [],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.notApplicable).toBe(true);
  });

  // ─── 综合场景 ───

  it('当 trigger 正确但步骤缺失时，部分得分', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: {
        steps: '1. 步骤A\n2. 步骤B',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤A' },
          result: 'success',
        },
        // 缺少步骤B
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
  });

  it('当 trigger 错误但步骤完全匹配时，部分得分', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: {
        steps: '1. 步骤A',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: false },
          result: 'skip',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤A' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
  });

  it('当所有检查都失败时，score 为 0', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: {
        steps: '1. 步骤A\n2. 步骤B',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: false },
          result: 'skip',
        },
        // 无任何 command_exec 事件
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  // ─── 边界场景 ───

  it('score 范围始终在 0-25 之间', () => {
    const contexts = [
      createMockContext({
        testCase: { should_trigger: true },
        traceEvents: [
          { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: true }, result: 'success' },
        ],
      }),
      createMockContext({
        testCase: { should_trigger: true },
        skillAnchor: { steps: '1. 步骤A' },
        traceEvents: [
          { caseId: 'case-1', eventType: 'skill_trigger', detail: { triggered: false }, result: 'skip' },
        ],
      }),
      createMockContext({
        skillAnchor: { steps: '' },
        traceEvents: [],
      }),
    ];

    for (const ctx of contexts) {
      const result = checkProcess(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(25);
    }
  });

  it('当 steps 包含编号前缀（如 "1."、"-"）时，正确解析', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '- 初始化环境\n* 执行核心逻辑\n• 清理资源',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '初始化环境' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行核心逻辑' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '清理资源' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('当 steps 只有一行时，正确解析为单个步骤', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '执行单一操作',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行单一操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
  });

  it('当 trace 中有 command_exec 但 steps 为空时，标记 notApplicable', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: undefined as unknown as string,
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '某命令' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.notApplicable).toBe(true);
  });

  it('返回的 details 包含各检查项的通过/失败状态', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      skillAnchor: {
        steps: '1. 步骤A\n2. 步骤B',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤A' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '步骤B' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details.every(d => d.includes('✓') || d.includes('✗') || d.includes('⚠'))).toBe(true);
  });

  // ─── AC-003-2: 流程目标检查 — should_trigger 预期、步骤一致性、命令顺序 ───

  it('AC-003-2: should_trigger=true 时 Skill 被正确触发，验证通过', () => {
    const context = createMockContext({
      testCase: { should_trigger: true },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.notApplicable).toBe(false);
  });

  it('AC-003-2: should_trigger=false 时 Skill 未被触发，验证通过', () => {
    const context = createMockContext({
      testCase: { should_trigger: false },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行操作' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('AC-003-2: 执行步骤与 Steps 定义完全一致，无跳步无多余，验证通过', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 解析配置文件\n2. 验证输入参数\n3. 执行核心逻辑\n4. 输出结果',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '解析配置文件' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '验证输入参数' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '执行核心逻辑' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '输出结果' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.details.some(d => d.includes('步骤'))).toBe(true);
  });

  it('AC-003-2: 命令执行顺序与 Steps 定义一致，验证通过', () => {
    const context = createMockContext({
      skillAnchor: {
        steps: '1. 初始化\n2. 处理\n3. 输出',
      },
      traceEvents: [
        {
          caseId: 'case-1',
          eventType: 'skill_trigger',
          detail: { triggered: true },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '初始化' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '处理' },
          result: 'success',
        },
        {
          caseId: 'case-1',
          eventType: 'command_exec',
          detail: { command: '输出' },
          result: 'success',
        },
      ],
    });

    const result: ProcessCheckResult = checkProcess(context);

    expect(result.pass).toBe(true);
    expect(result.details.some(d => d.includes('顺序'))).toBe(true);
  });
});
