import type { TraceEvent } from '../../types/trace.js';
import type { SkillAnchor } from '../../types/skill.js';

/**
 * 流程检查结果接口
 * 流程目标检查器的输出
 */
export interface ProcessCheckResult {
  /** 检查器标识 */
  checkerId: 'process';
  /** 是否通过 */
  pass: boolean;
  /** 得分（0-25，满分 25） */
  score: number;
  /** 检查详情列表 */
  details: string[];
  /** 缺少 "Steps" 章节时为 true */
  notApplicable: boolean;
}

/**
 * 流程检查上下文
 * 复用 CheckContext 的结构
 */
export interface ProcessCheckContext {
  testCase: {
    id: string;
    should_trigger: boolean;
  };
  sandbox: {
    sandboxDir: string;
  };
  skillAnchor: SkillAnchor;
  traceCollector: {
    getEventCount(): number;
  };
  // 用于获取 trace 事件的扩展字段
  _traceEvents?: Omit<TraceEvent, 'timestamp'>[];
}

/**
 * 流程目标检查器
 *
 * 验证执行过程是否合规：
 * 1. Skill 触发/不触发是否符合 should_trigger 预期
 * 2. 执行步骤是否与 "Steps" 定义一致，无跳步或多余步骤
 * 3. 命令执行顺序是否符合预期
 *
 * 评分分配：
 * - 触发检查：10 分
 * - 步骤一致性：10 分
 * - 命令顺序：5 分
 * - 总计：25 分
 *
 * @param context 检查上下文
 * @returns 检查结果
 */
export function checkProcess(context: ProcessCheckContext): ProcessCheckResult {
  const { skillAnchor, testCase, _traceEvents: traceEvents = [] } = context;

  // 检查 steps 字段是否存在且非空
  if (!skillAnchor.steps || skillAnchor.steps.trim() === '') {
    return {
      checkerId: 'process',
      pass: false,
      score: 0,
      details: ['缺少 "Steps" 章节，无法进行流程检查'],
      notApplicable: true,
    };
  }

  // 解析 steps
  const expectedSteps = parseSteps(skillAnchor.steps);

  // 从 trace 中提取命令执行事件
  const actualCommands = extractCommands(traceEvents);

  // 1. 检查 should_trigger 预期与实际触发是否一致（10 分）
  const triggerResult = checkTrigger(traceEvents, testCase.should_trigger);

  // 2. 检查步骤一致性（10 分）
  const stepResult = checkStepConsistency(expectedSteps, actualCommands);

  // 3. 检查命令执行顺序（5 分）
  const orderResult = checkCommandOrder(expectedSteps, actualCommands);

  // 汇总得分
  const score = triggerResult.score + stepResult.score + orderResult.score;
  const allPassed = triggerResult.pass && stepResult.pass && orderResult.pass;

  return {
    checkerId: 'process',
    pass: allPassed,
    score,
    details: [triggerResult.message, stepResult.message, orderResult.message],
    notApplicable: false,
  };
}

/**
 * 从 steps 文本中解析出步骤列表
 *
 * 支持的格式：
 * - "1. 步骤内容"
 * - "- 步骤内容"
 * - "* 步骤内容"
 * - "• 步骤内容"
 * - "步骤内容"（无前缀）
 */
function parseSteps(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // 移除编号前缀（如 "1."、"2." 等）
      let cleaned = line.replace(/^\d+[\.\)\-]\s*/, '');
      // 移除列表符号前缀
      cleaned = cleaned.replace(/^[\-\*\•]\s*/, '');
      return cleaned.trim();
    })
    .filter(Boolean);
}

/**
 * 从 trace 事件中提取 command_exec 事件的命令名称
 */
function extractCommands(events: Omit<TraceEvent, 'timestamp'>[]): string[] {
  return events
    .filter(e => e.eventType === 'command_exec')
    .map(e => {
      const cmd = e.detail?.command as string | undefined;
      return cmd || '';
    })
    .filter(Boolean);
}

/**
 * 检查 Skill 触发是否符合 should_trigger 预期
 *
 * 满分 10 分
 */
function checkTrigger(
  events: Omit<TraceEvent, 'timestamp'>[],
  expectedTrigger: boolean
): { pass: boolean; score: number; message: string } {
  // 查找 skill_trigger 事件
  const triggerEvent = events.find(e => e.eventType === 'skill_trigger');
  const actualTriggered = triggerEvent
    ? Boolean((triggerEvent.detail as Record<string, unknown>)?.triggered)
    : false;

  const pass = actualTriggered === expectedTrigger;

  if (pass) {
    return {
      pass: true,
      score: 10,
      message: expectedTrigger
        ? '✓ 触发检查: Skill 按预期被触发'
        : '✓ 触发检查: Skill 按预期未被触发',
    };
  }

  return {
    pass: false,
    score: 0,
    message: expectedTrigger
      ? '✗ 触发检查: Skill 应该被触发但实际未触发'
      : '✗ 触发检查: Skill 不应被触发但实际被触发',
  };
}

/**
 * 检查执行步骤是否与 "Steps" 定义一致
 *
 * 满分 10 分，按匹配比例计分
 */
function checkStepConsistency(
  expectedSteps: string[],
  actualCommands: string[]
): { pass: boolean; score: number; message: string } {
  if (expectedSteps.length === 0 && actualCommands.length === 0) {
    return {
      pass: true,
      score: 10,
      message: '✓ 步骤检查: 无步骤定义且无命令执行，一致',
    };
  }

  // 计算预期步骤中有多少在实际命令中出现
  const actualSet = new Set(actualCommands);
  const matchedSteps = expectedSteps.filter(s => actualSet.has(s));

  // 计算实际命令中有多少在预期步骤中
  const expectedSet = new Set(expectedSteps);
  const matchedCommands = actualCommands.filter(c => expectedSet.has(c));

  // 步骤一致性得分：基于预期步骤的覆盖率
  const stepCoverage = expectedSteps.length > 0
    ? matchedSteps.length / expectedSteps.length
    : 1;

  // 多余命令惩罚：如果有不在预期中的命令，按比例扣分
  const extraCommands = actualCommands.filter(c => !expectedSet.has(c));
  const extraPenalty = actualCommands.length > 0
    ? extraCommands.length / actualCommands.length
    : 0;

  // 综合得分：覆盖率 - 多余惩罚，最低 0
  const ratio = Math.max(0, stepCoverage - extraPenalty);
  const score = Math.round(ratio * 10);

  if (score === 10) {
    return {
      pass: true,
      score: 10,
      message: '✓ 步骤检查: 所有步骤均已执行，无跳步无多余',
    };
  }

  const missingSteps = expectedSteps.filter(s => !actualSet.has(s));
  const details: string[] = [];
  if (missingSteps.length > 0) {
    details.push(`缺失步骤: ${missingSteps.join('、')}`);
  }
  if (extraCommands.length > 0) {
    details.push(`多余步骤: ${extraCommands.join('、')}`);
  }

  return {
    pass: false,
    score,
    message: `✗ 步骤检查: 步骤不一致（${details.join('，')}）`,
  };
}

/**
 * 检查命令执行顺序是否符合预期
 *
 * 满分 5 分，按顺序正确的命令比例计分
 */
function checkCommandOrder(
  expectedSteps: string[],
  actualCommands: string[]
): { pass: boolean; score: number; message: string } {
  if (actualCommands.length === 0) {
    if (expectedSteps.length === 0) {
      return {
        pass: true,
        score: 5,
        message: '✓ 顺序检查: 无命令需要检查顺序',
      };
    }
    return {
      pass: false,
      score: 0,
      message: `✗ 顺序检查: 预期 ${expectedSteps.length} 个步骤但无命令执行`,
    };
  }

  // 获取每个实际命令在预期步骤中的位置
  const positions: number[] = [];
  for (const cmd of actualCommands) {
    const idx = expectedSteps.indexOf(cmd);
    if (idx >= 0) {
      positions.push(idx);
    }
  }

  if (positions.length === 0) {
    return {
      pass: false,
      score: 0,
      message: '✗ 顺序检查: 实际命令与预期步骤完全不匹配',
    };
  }

  // 计算有多少命令保持了正确的相对顺序
  let inOrderCount = 0;
  let maxPos = -1;
  for (const pos of positions) {
    if (pos >= maxPos) {
      inOrderCount++;
      maxPos = pos;
    }
  }

  const ratio = inOrderCount / positions.length;
  const score = Math.round(ratio * 5);

  if (score === 5) {
    return {
      pass: true,
      score: 5,
      message: '✓ 顺序检查: 命令执行顺序与预期一致',
    };
  }

  const outOfOrder = positions.length - inOrderCount;
  return {
    pass: false,
    score,
    message: `✗ 顺序检查: ${outOfOrder} 个命令顺序不正确`,
  };
}
