import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkStyle } from '../../../../src/eval/checkers/style-checker.js';
import type { CheckContext } from '../../../../src/eval/checkers/result-checker.js';
import type { StyleCheckResult } from '../../../../src/eval/checkers/style-checker.js';
import type { LoadedCase } from '../../../../src/types/eval.js';
import type { SandboxContext } from '../../../../src/eval/sandbox-manager.js';
import type { SkillAnchor } from '../../../../src/types/skill.js';
import type { TraceCollector } from '../../../../src/types/trace.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'style-checker');

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
    definitionOfDone: '生成 output.txt',
    whatToBuild: '1. src/index.ts — 入口文件\n2. src/utils/helper.ts — 工具函数\n3. dist/ — 构建产物目录',
    steps: '1. 执行操作',
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

describe('checkStyle', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ─── notApplicable 场景 ───

  it('当 whatToBuild 为空字符串时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '',
      },
    });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.checkerId).toBe('style');
    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 whatToBuild 为 undefined 时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: undefined as unknown as string,
      },
    });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 whatToBuild 仅为空白字符时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '   \n  \t  ',
      },
    });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  // ─── 文件结构检查 ───

  it('当 whatToBuild 中提到的文件全部存在时，文件结构检查通过', () => {
    const context = createMockContext();
    // 创建 whatToBuild 中提到的文件
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'utils', 'helper.ts'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'), { recursive: true });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.checkerId).toBe('style');
    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.notApplicable).toBe(false);
  });

  it('当 whatToBuild 中提到的文件部分缺失时，部分扣分', () => {
    const context = createMockContext();
    // 只创建 src/index.ts，缺失其他文件
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), '内容');

    const result: StyleCheckResult = checkStyle(context);

    expect(result.checkerId).toBe('style');
    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
    expect(result.details.some(d => d.includes('缺失'))).toBe(true);
  });

  it('当 whatToBuild 中提到的文件全部缺失时，文件结构检查得 0 分', () => {
    const context = createMockContext();
    // 不创建任何文件

    const result: StyleCheckResult = checkStyle(context);

    expect(result.checkerId).toBe('style');
    expect(result.pass).toBe(false);
    // 文件结构部分为 0，但命名和格式部分可能有分
    expect(result.score).toBeLessThan(25);
  });

  // ─── 命名规则检查 ───

  it('当文件名符合 kebab-case 命名规范时，命名检查通过', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/my-component.ts\n2. src/utils/data-helper.ts',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'my-component.ts'), '内容');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'utils', 'data-helper.ts'), '内容');

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('当文件名包含大写字母（非 PascalCase 文件）时，命名检查扣分', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/my-component.ts',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 使用不符合 kebab-case 的命名
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'MyComponent.ts'), '内容');

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.details.some(d => d.includes('命名'))).toBe(true);
  });

  it('当目录名符合 kebab-case 命名规范时，命名检查通过', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/components/ — 组件目录\n2. src/utils/ — 工具目录',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'components'), { recursive: true });
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'utils'), { recursive: true });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
  });

  // ─── 格式约束检查 ───

  it('当文件内容使用 2 空格缩进时，格式检查通过', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/index.ts — 入口文件',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 使用 2 空格缩进
    fs.writeFileSync(
      path.join(context.sandbox.sandboxDir, 'src', 'index.ts'),
      'function hello() {\n  return "world";\n}'
    );

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('当文件内容使用 Tab 缩进时，格式检查扣分', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/index.ts — 入口文件',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 使用 Tab 缩进
    fs.writeFileSync(
      path.join(context.sandbox.sandboxDir, 'src', 'index.ts'),
      'function hello() {\n\treturn "world";\n}'
    );

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(25);
    expect(result.details.some(d => d.includes('缩进'))).toBe(true);
  });

  it('当文件包含过长的行（超过 120 字符）时，格式检查扣分', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/index.ts — 入口文件',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 包含超过 120 字符的长行
    const longLine = 'const extremelyLongVariableNameThatDefinitelyExceedsTheMaximumAllowedLineLengthOfOneHundredTwentyCharactersForSure = true;';
    fs.writeFileSync(
      path.join(context.sandbox.sandboxDir, 'src', 'index.ts'),
      `function hello() {\n  ${longLine}\n}`
    );

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('行长'))).toBe(true);
  });

  // ─── 综合场景 ───

  it('当所有检查都通过时，返回满分', () => {
    const context = createMockContext();
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), 'function main() {\n  return true;\n}');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'utils', 'helper.ts'), 'export const help = () => {};');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'), { recursive: true });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.notApplicable).toBe(false);
  });

  it('当文件存在但格式有问题时，部分得分', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/index.ts — 入口文件',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 文件存在，但使用 Tab 缩进
    fs.writeFileSync(
      path.join(context.sandbox.sandboxDir, 'src', 'index.ts'),
      'function hello() {\n\treturn "world";\n}'
    );

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
  });

  it('score 范围始终在 0-25 之间', () => {
    const contexts: CheckContext[] = [
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
      createMockContext(),
    ];

    // 为第二个上下文创建文件
    fs.mkdirSync(path.join(contexts[1].sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(contexts[1].sandbox.sandboxDir, 'src', 'index.ts'), '内容');

    for (const ctx of contexts) {
      const result = checkStyle(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(25);
    }
  });

  it('返回的 details 包含各检查项的通过/失败状态', () => {
    const context = createMockContext();
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), 'function main() {\n  return true;\n}');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'utils', 'helper.ts'), 'export const help = () => {};');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'), { recursive: true });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details.every(d => d.includes('✓') || d.includes('✗') || d.includes('⚠'))).toBe(true);
  });

  // ─── 边界场景 ───

  it('当 whatToBuild 只包含文本描述（无文件路径）时，标记 notApplicable=true', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '一个美观的用户界面，具有良好的交互体验', // 无可提取的文件路径
      },
    });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.notApplicable).toBe(true);
    expect(result.score).toBe(0);
  });

  it('当 whatToBuild 包含混合格式（编号、符号、无前缀）时，正确解析', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '- src/index.ts\n* src/utils.ts\n  src/config.ts',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), '内容');
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'utils.ts'), '内容');
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'config.ts'), '内容');

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
  });

  it('当 whatToBuild 包含嵌套目录路径时，正确检查', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/components/button/index.tsx\n2. src/components/button/styles.css',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'components', 'button'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'components', 'button', 'index.tsx'), '内容');
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'components', 'button', 'styles.css'), '内容');

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('当文件存在但命名不符合规范时，正确报告命名问题', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/my-component.ts',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 文件存在但命名不符合 kebab-case
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'my_component.ts'), '内容');

    const result: StyleCheckResult = checkStyle(context);

    // 文件不存在（因为名字不对），所以文件结构检查失败
    expect(result.pass).toBe(false);
    expect(result.details.some(d => d.includes('缺失') || d.includes('命名'))).toBe(true);
  });

  // ─── AC-003-3: 风格目标检查 — 文件结构、命名、格式约束 ───

  it('AC-003-3: 产物文件结构和命名符合 "What to build" 中的约定，验证通过', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/index.ts — 入口文件\n2. src/utils/helper.ts — 工具函数\n3. dist/ — 构建产物目录',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'index.ts'), 'export const main = () => {};');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(context.sandbox.sandboxDir, 'src', 'utils', 'helper.ts'), 'export const helper = () => {};');
    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'dist'), { recursive: true });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
    expect(result.notApplicable).toBe(false);
  });

  it('AC-003-3: 代码/配置格式符合预设规则（缩进、行长），验证通过', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. src/index.ts — 入口文件',
      },
    });

    fs.mkdirSync(path.join(context.sandbox.sandboxDir, 'src'), { recursive: true });
    // 符合格式：2 空格缩进，行长不超过 120
    fs.writeFileSync(
      path.join(context.sandbox.sandboxDir, 'src', 'index.ts'),
      'function greet(name: string) {\n  return `Hello, ${name}!`;\n}'
    );

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.details.some(d => d.includes('缩进'))).toBe(true);
  });

  it('AC-003-3: 输出内容满足格式约束，验证通过', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '',
        whatToBuild: '1. output.json — JSON 配置文件',
      },
    });

    // 创建符合 JSON 格式的文件
    fs.writeFileSync(
      path.join(context.sandbox.sandboxDir, 'output.json'),
      '{\n  "name": "test",\n  "version": "1.0.0"\n}'
    );

    const result: StyleCheckResult = checkStyle(context);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(25);
  });

  it('AC-003-3: 缺少 "What to build" 章节时，标记为不适用而非失败', () => {
    const context = createMockContext({
      skillAnchor: {
        name: 'test-skill',
        description: '测试 Skill',
        whenToUse: '当需要测试时',
        whenNotToUse: '不需要测试时',
        definitionOfDone: '生成 output.txt',
        whatToBuild: '',
      },
    });

    const result: StyleCheckResult = checkStyle(context);

    expect(result.notApplicable).toBe(true);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.details.some(d => d.includes('What to build'))).toBe(true);
  });
});
