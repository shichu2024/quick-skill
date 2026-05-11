import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkResult } from '../../../../src/eval/checkers/result-checker.js';
import type { CheckContext, CheckResult } from '../../../../src/eval/checkers/result-checker.js';
import type { LoadedCase } from '../../../../src/types/eval.js';
import type { SandboxContext } from '../../../../src/eval/sandbox-manager.js';
import type { SkillAnchor } from '../../../../src/types/skill.js';
import type { TraceCollector } from '../../../../src/types/trace.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'result-checker');

/** 清理测试 fixture 目录 */
function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/** 创建模拟的 CheckContext */
function createMockContext(overrides: Partial<CheckContext> = {}): CheckContext {
  const sandboxDir = path.join(testDir, 'sandbox');
  fs.mkdirSync(sandboxDir, { recursive: true });

  const defaultTestCase: LoadedCase = {
    id: 'case-1',
    should_trigger: true,
    prompt: '测试 prompt',
    pass_criteria: '测试标准',
    custom: false,
    deprecated: false,
    isValid: true,
    missingFields: [],
  };

  const defaultSkillAnchor: SkillAnchor = {
    name: 'test-skill',
    description: '测试 Skill',
    whenToUse: '当需要测试时',
    whenNotToUse: '不需要测试时',
    definitionOfDone: '1. 生成 output.txt 文件\n2. 生成 dist/ 目录\n3. 命令退出码为 0',
    whatToBuild: '一个输出文件和目录',
  };

  const defaultSandbox: SandboxContext = {
    sandboxDir,
    skillMdPath: path.join(sandboxDir, 'SKILL.md'),
    timeoutMs: 10000,
    cleanup: () => {},
    abortSignal: new AbortController().signal,
  };

  const defaultTraceCollector: TraceCollector = {
    record: () => {},
    flush: () => {},
    getTracePath: () => path.join(testDir, 'trace.jsonl'),
    getEventCount: () => 0,
  };

  return {
    testCase: defaultTestCase,
    sandbox: defaultSandbox,
    skillAnchor: defaultSkillAnchor,
    traceCollector: defaultTraceCollector,
    ...overrides,
  };
}

describe('checkResult', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('当 definitionOfDone 中提到的文件都存在时，返回 pass=true 并给满分', () => {
    const context = createMockContext();
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'output.txt'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'));

    const result: CheckResult = checkResult(context);

    expect(result.checkerId).toBe('result');
    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.notApplicable).toBe(false);
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('当 definitionOfDone 中提到的文件缺失时，返回 pass=false 并扣分', () => {
    const context = createMockContext();

    const result: CheckResult = checkResult(context);

    expect(result.checkerId).toBe('result');
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.notApplicable).toBe(false);
    expect(result.details.some(d => d.includes('output.txt'))).toBe(true);
  });

  it('当 definitionOfDone 为空字符串时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '一个输出',
      },
    });

    const result: CheckResult = checkResult(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 definitionOfDone 为 undefined 时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: undefined as unknown as string,
        whatToBuild: '一个输出',
      },
    });

    const result: CheckResult = checkResult(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 exitCode 与预期不匹配时，扣分', () => {
    const context = createMockContext({
      testCase: {
        id: 'case-1',
        should_trigger: true,
        prompt: '测试 prompt',
        pass_criteria: '测试标准',
        custom: false,
        deprecated: false,
        isValid: true,
        missingFields: [],
        exitCode: 0,
      } as LoadedCase,
    });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'output.txt'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'));
    (context.sandbox as any).actualExitCode = 1;

    const result: CheckResult = checkResult(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.details.some(d => d.includes('退出码'))).toBe(true);
  });

  it('当 sandboxDir 不存在时，返回失败', () => {
    const context = createMockContext({
      sandbox: {
        sandboxDir: path.join(testDir, 'nonexistent-sandbox'),
        skillMdPath: '',
        timeoutMs: 10000,
        cleanup: () => {},
        abortSignal: new AbortController().signal,
      },
    });

    const result: CheckResult = checkResult(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('沙箱'))).toBe(true);
  });

  it('score 范围始终在 0-25 之间', () => {
    const contexts: CheckContext[] = [
      createMockContext(),
      createMockContext({
        skillAnchor: {
          name: 'test',
          description: 'test',
          whenToUse: '',
          whenNotToUse: '',
          definitionOfDone: '',
          whatToBuild: '',
        },
      }),
    ];

    fs.writeFileSync(path.join(contexts[0].sandbox.sandboxDir, 'output.txt'), '内容');
    fs.mkdirSync(path.join(contexts[0].sandbox.sandboxDir, 'dist'));

    for (const ctx of contexts) {
      const result = checkResult(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(25);
    }
  });

  // ─── AC-003-1: 结果目标检查 — 验证核心输出文件/目录生成 ───

  it('当 definitionOfDone 中提到的目录存在时，验证通过', () => {
    const context = createMockContext();
    // 只创建 dist/ 目录，不创建 output.txt
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'));

    const result: CheckResult = checkResult(context);

    // dist/ 存在但 output.txt 缺失，应部分扣分
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.score).toBeGreaterThan(0);
    expect(result.details.some(d => d.includes('dist'))).toBe(true);
  });

  it('当 definitionOfDone 中提到的目录缺失时，记录缺失信息', () => {
    const context = createMockContext();
    // 不创建 dist/ 目录

    const result: CheckResult = checkResult(context);

    expect(result.details.some(d => d.toLowerCase().includes('dist'))).toBe(true);
  });

  it('当 exitCode 与预期匹配时，不扣分', () => {
    const context = createMockContext({
      testCase: {
        id: 'case-1',
        should_trigger: true,
        prompt: '测试 prompt',
        pass_criteria: '测试标准',
        custom: false,
        deprecated: false,
        isValid: true,
        missingFields: [],
        exitCode: 0, // 用例中指定预期退出码
      } as LoadedCase,
    });
    // 创建所有要求的文件
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'output.txt'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'));
    // 模拟实际退出码（通过 sandbox 的 detail 注入）
    (context.sandbox as any).actualExitCode = 0;

    const result: CheckResult = checkResult(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  // ─── AC-003-1: 结果目标检查 — Definition of Done 匹配 ───

  it('当 definitionOfDone 只包含不可量化的主观描述时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '代码质量要高，架构要合理', // 无可量化标准
        whatToBuild: '一个输出',
      },
    });

    const result: CheckResult = checkResult(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 definitionOfDone 包含多种模式（文件、目录、退出码）时，分别计分', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '1. 生成 output.txt\n2. 生成 dist/ 目录\n3. 生成 logs/ 目录\n4. 退出码为 0',
        whatToBuild: '多个输出',
      },
    });

    // 只创建 output.txt 和 dist/，不创建 logs/
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'output.txt'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'));

    const result: CheckResult = checkResult(context);

    // 部分通过：output.txt ✓, dist/ ✓, logs/ ✗
    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
    expect(result.details.length).toBeGreaterThanOrEqual(3);
  });

  // ─── 边界场景 ───

  it('当 definitionOfDone 中包含复杂的编号格式时，正确提取检查项', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '- 创建 src/index.ts\n- 创建 build/ 目录\n* 退出码为 0',
        whatToBuild: '源码和构建',
      },
    });

    // 创建 src/index.ts（需要创建父目录）
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), '内容');

    const result: CheckResult = checkResult(context);

    // src/index.ts 存在，build/ 缺失
    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('index.ts'))).toBe(true);
    expect(result.details.some(d => d.includes('build'))).toBe(true);
  });

  it('返回的 details 包含每个检查项的通过/失败状态', () => {
    const context = createMockContext();
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'output.txt'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'));

    const result: CheckResult = checkResult(context);

    // 每个 detail 应该包含检查项名称和状态
    expect(result.details.every(d => d.includes('✓') || d.includes('✗') || d.includes('⚠'))).toBe(true);
  });

  it('当所有检查项都不适用时，notApplicable 为 true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '代码应该写得优雅', // 无可量化标准
        whatToBuild: '一个输出',
      },
    });

    const result: CheckResult = checkResult(context);

    expect(result.notApplicable).toBe(true);
  });

  it('当 definitionOfDone 中包含嵌套目录路径时，正确检查文件存在性', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '生成 dist/bundle.js',
        whatToBuild: '构建产物',
      },
    });

    // 创建嵌套目录和文件
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'dist', 'bundle.js'), '内容');

    const result: CheckResult = checkResult(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('当嵌套目录文件缺失时，正确报告缺失', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '生成 dist/bundle.js',
        whatToBuild: '构建产物',
      },
    });

    // 只创建 dist/ 目录，不创建 bundle.js
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'), { recursive: true });

    const result: CheckResult = checkResult(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('bundle.js'))).toBe(true);
  });
});
