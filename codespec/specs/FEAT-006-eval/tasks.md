# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|------|------|--------|
| T-001 | ST-001 | 用例加载器 | todo | 无 | dev |
| T-002 | ST-002 | 沙箱管理器 | todo | 无 | dev |
| T-003 | ST-006 | JSONL Trace 收集器 | todo | 无 | dev |
| T-004 | ST-003 | 确定性评测引擎 - 结果目标检查器 | todo | T-001, T-002, T-003 | dev |
| T-005 | ST-003 | 确定性评测引擎 - 流程目标检查器 | todo | T-001, T-002, T-003 | dev |
| T-006 | ST-003 | 确定性评测引擎 - 风格目标检查器 | todo | T-001, T-002, T-003 | dev |
| T-007 | ST-003 | 确定性评测引擎 - 效率目标检查器 | todo | T-001, T-002, T-003 | dev |
| T-008 | ST-003 | 确定性评测引擎编排器 | todo | T-004, T-005, T-006, T-007 | dev |
| T-009 | ST-004 | 模型辅助 Rubric 评测引擎 | todo | T-002, T-003 | dev |
| T-010 | ST-005 | 多维度量化打分体系 | todo | T-008, T-009 | dev |
| T-011 | ST-007 | 测试结果持久化与归档 | todo | T-008, T-010 | dev |
| T-012 | ST-008 | 回归检测与版本对比 | todo | T-011 | dev |
| T-013 | ST-011 | HTML 可视化报告生成 | todo | T-011 | dev |
| T-014 | ST-009 | eval 单 Skill 评测命令 | todo | T-010, T-011 | dev |
| T-015 | ST-010 | 批量与全量评测命令 | todo | T-014 | dev |

---

## T-001 用例加载器

```yaml
id: T-001
story_id: ST-001
title: 用例加载器
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/eval/case-loader.ts
  - src/types/test-case.ts
  - src/io/csv-reader.ts
write_paths:
  - src/eval/case-loader.ts
  - src/types/eval.ts
  - tests/unit/eval/case-loader.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/case-loader.test.ts
  - type: manual
    value: 验证 ST-001 全部 AC（AC-001-1 ~ AC-001-6）
```

### 目标

从 Skill 的 evals 目录加载并解析测试用例 CSV 文件，过滤 deprecated 用例，校验必填字段，输出结构化用例列表。

### 交付物

- `src/types/eval.ts` — 定义 `LoadedCase`（扩展 TestCase，增加校验元信息）、`LoadResult`
- `src/eval/case-loader.ts` — 导出 `loadCases(skillDir: string): LoadResult`
- `tests/unit/eval/case-loader.test.ts` — 覆盖正常加载、deprecated 过滤、字段缺失、文件不存在等场景

### 接口契约

```typescript
interface LoadResult {
  cases: LoadedCase[];
  skippedCount: number;    // deprecated 跳过数
  warnings: string[];      // 缺失字段等警告
}

interface LoadedCase extends TestCase {
  isValid: boolean;
  missingFields: string[];
}

function loadCases(skillDir: string): LoadResult;
// 路径: {skillDir}/evals/{skill-name}.prompts.csv
// 自动跳过 deprecated=true
// 缺少必填字段时标记 isValid=false 并收集警告
```

### 备注

- 复用 FEAT-004 的 `readCasesFromCsv` 和 `TestCase` 类型
- CSV 文件不存在时返回错误，不抛异常（不中断批量评测）
- 与 T-002、T-003 完全无依赖，可并行开发

---

## T-002 沙箱管理器

```yaml
id: T-002
story_id: ST-002
title: 沙箱管理器
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/eval/sandbox-manager.ts
  - src/types/eval.ts
write_paths:
  - src/eval/sandbox-manager.ts
  - tests/unit/eval/sandbox-manager.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/sandbox-manager.test.ts
  - type: manual
    value: 验证 ST-002 全部 AC（AC-002-1 ~ AC-002-6）
```

### 目标

为每条用例创建独立的临时沙箱目录，复制必要文件，管理生命周期（创建、超时控制、清理）。

### 交付物

- `src/eval/sandbox-manager.ts` — 导出 `createSandbox(skillDir: string, options?: SandboxOptions): SandboxContext` 和 `cleanupSandbox(context: SandboxContext): void`
- `tests/unit/eval/sandbox-manager.test.ts` — 覆盖沙箱创建、文件复制、超时控制、清理等场景

### 接口契约

```typescript
interface SandboxOptions {
  timeout?: number;  // 默认 10 秒，最大 30 秒
}

interface SandboxContext {
  sandboxDir: string;       // 临时沙箱目录路径
  skillMdPath: string;      // 沙箱内 SKILL.md 路径
  timeoutMs: number;
  cleanup: () => void;      // 清理回调
}

function createSandbox(skillDir: string, options?: SandboxOptions): SandboxContext;
// 在系统临时目录创建独立子目录
// 复制 SKILL.md 和 Skill 声明的依赖文件
// 返回沙箱上下文

function cleanupSandbox(context: SandboxContext): void;
// 无论成功/失败均清理临时目录
```

### 备注

- 使用 Node.js `os.tmpdir()` + `crypto.randomUUID()` 生成唯一沙箱目录
- 原始 Skill 源以只读方式引用，写入限定在沙箱目录内
- 超时使用 `AbortController` 实现，超时后标记失败并清理
- 与 T-001、T-003 完全无依赖，可并行开发

---

## T-003 JSONL Trace 收集器

```yaml
id: T-003
story_id: ST-006
title: JSONL Trace 收集器
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/eval/trace-collector.ts
  - src/types/trace.ts
write_paths:
  - src/eval/trace-collector.ts
  - src/types/trace.ts
  - tests/unit/eval/trace-collector.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/trace-collector.test.ts
  - type: manual
    value: 验证 ST-006 全部 AC（AC-006-1 ~ AC-006-6）
```

### 目标

实现评测执行过程的 JSONL 格式 trace 收集，支持 5 类事件记录，确保事件顺序与执行顺序一致。

### 交付物

- `src/types/trace.ts` — 定义 `TraceEvent`、`TraceEventType`（枚举: skill_trigger/command_exec/file_op/token_usage/model_call）、`TraceLog`
- `src/eval/trace-collector.ts` — 导出 `createTraceCollector(outputPath: string): TraceCollector`
- `tests/unit/eval/trace-collector.test.ts` — 覆盖事件记录、顺序一致性、JSONL 格式、失败事件等场景

### 接口契约

```typescript
type TraceEventType =
  | 'skill_trigger'    // Skill 触发事件
  | 'command_exec'     // 命令执行事件
  | 'file_op'          // 文件操作事件
  | 'token_usage'      // Token 用量事件
  | 'model_call';      // 模型调用事件

interface TraceEvent {
  timestamp: string;    // ISO 8601
  caseId: string;
  eventType: TraceEventType;
  detail: Record<string, unknown>;
  result: 'success' | 'failure' | 'skip';
  failureReason?: string;
}

interface TraceCollector {
  record(event: Omit<TraceEvent, 'timestamp'>): void;
  flush(): void;                           // 将缓冲区写入文件
  getTracePath(): string;                  // 获取输出文件路径
  getEventCount(): number;
}
```

### 备注

- JSONL 格式：每行一个 JSON 对象
- 事件顺序与实际执行顺序一致（同步记录，非异步）
- 失败事件必须包含 `failureReason` 和上下文信息
- 缓冲区满或 flush 时写入文件
- 与 T-001、T-002 完全无依赖，可并行开发

---

## T-004 确定性评测引擎 - 结果目标检查器

```yaml
id: T-004
story_id: ST-003
title: 确定性评测引擎 - 结果目标检查器
owner_role: dev
status: todo
depends_on: [T-001, T-002, T-003]
read_paths:
  - src/eval/checkers/result-checker.ts
  - src/types/eval.ts
  - src/types/trace.ts
  - src/eval/case-loader.ts
  - src/eval/sandbox-manager.ts
  - src/eval/trace-collector.ts
write_paths:
  - src/eval/checkers/result-checker.ts
  - tests/unit/eval/checkers/result-checker.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/checkers/result-checker.test.ts
  - type: manual
    value: 验证 AC-003-1（结果目标检查）
```

### 目标

验证任务是否完成：核心输出文件/目录是否按预期生成、命令退出码是否符合预期、最终产物是否满足 "Definition of done" 的可量化标准。

### 交付物

- `src/eval/checkers/result-checker.ts` — 导出 `checkResult(context: CheckContext): CheckResult`
- `tests/unit/eval/checkers/result-checker.test.ts` — 覆盖文件生成验证、退出码验证、Definition of Done 匹配等场景

### 接口契约

```typescript
interface CheckContext {
  testCase: LoadedCase;
  sandbox: SandboxContext;
  skillAnchor: SkillAnchor;
  traceCollector: TraceCollector;
}

interface CheckResult {
  checkerId: 'result';
  pass: boolean;
  score: number;        // 0-25（满分 25）
  details: string[];
  notApplicable: boolean;  // 无可量化标准时为 true
}
```

### 备注

- 从 `definitionOfDone` 提取可量化标准进行匹配
- 缺少 `definitionOfDone` 时标记 `notApplicable=true`
- 与 T-005、T-006、T-007 可并行开发

---

## T-005 确定性评测引擎 - 流程目标检查器

```yaml
id: T-005
story_id: ST-003
title: 确定性评测引擎 - 流程目标检查器
owner_role: dev
status: todo
depends_on: [T-001, T-002, T-003]
read_paths:
  - src/eval/checkers/process-checker.ts
  - src/types/eval.ts
  - src/types/trace.ts
  - src/eval/case-loader.ts
  - src/eval/sandbox-manager.ts
  - src/eval/trace-collector.ts
write_paths:
  - src/eval/checkers/process-checker.ts
  - tests/unit/eval/checkers/process-checker.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/checkers/process-checker.test.ts
  - type: manual
    value: 验证 AC-003-2（流程目标检查）
```

### 目标

验证执行过程是否合规：Skill 触发/不触发是否符合 should_trigger 预期、执行步骤是否与 "Steps" 一致、命令执行顺序是否符合预期。

### 交付物

- `src/eval/checkers/process-checker.ts` — 导出 `checkProcess(context: CheckContext): CheckResult`
- `tests/unit/eval/checkers/process-checker.test.ts` — 覆盖 should_trigger 验证、步骤一致性、命令顺序等场景

### 接口契约

```typescript
// 复用 CheckContext 和 CheckResult，checkerId 为 'process'
// score 满分 25
```

### 备注

- 核心检查项：should_trigger 预期与实际触发是否一致
- 步骤一致性检查基于 "Steps" 章节解析
- 缺少 "Steps" 章节时标记 `notApplicable=true`

---

## T-006 确定性评测引擎 - 风格目标检查器

```yaml
id: T-006
story_id: ST-003
title: 确定性评测引擎 - 风格目标检查器
owner_role: dev
status: todo
depends_on: [T-001, T-002, T-003]
read_paths:
  - src/eval/checkers/style-checker.ts
  - src/types/eval.ts
  - src/types/trace.ts
  - src/eval/case-loader.ts
  - src/eval/sandbox-manager.ts
  - src/eval/trace-collector.ts
write_paths:
  - src/eval/checkers/style-checker.ts
  - tests/unit/eval/checkers/style-checker.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/checkers/style-checker.test.ts
  - type: manual
    value: 验证 AC-003-3（风格目标检查）
```

### 目标

验证产出风格是否符合约定：文件结构和命名是否符合 "What to build" 约定、代码/配置格式是否符合预设规则、输出内容是否满足格式约束。

### 交付物

- `src/eval/checkers/style-checker.ts` — 导出 `checkStyle(context: CheckContext): CheckResult`
- `tests/unit/eval/checkers/style-checker.test.ts` — 覆盖文件结构、命名规则、格式约束等场景

### 接口契约

```typescript
// 复用 CheckContext 和 CheckResult，checkerId 为 'style'
// score 满分 25
```

### 备注

- 检查项基于 "What to build" 章节提取的文件结构和命名约定
- 缺少 "What to build" 章节时标记 `notApplicable=true`

---

## T-007 确定性评测引擎 - 效率目标检查器

```yaml
id: T-007
story_id: ST-003
title: 确定性评测引擎 - 效率目标检查器
owner_role: dev
status: todo
depends_on: [T-001, T-002, T-003]
read_paths:
  - src/eval/checkers/efficiency-checker.ts
  - src/types/eval.ts
  - src/types/trace.ts
  - src/eval/case-loader.ts
  - src/eval/sandbox-manager.ts
  - src/eval/trace-collector.ts
write_paths:
  - src/eval/checkers/efficiency-checker.ts
  - tests/unit/eval/checkers/efficiency-checker.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/checkers/efficiency-checker.test.ts
  - type: manual
    value: 验证 AC-003-4（效率目标检查）
```

### 目标

验证执行效率是否达标：命令执行总次数在阈值内、总 token 用量在阈值内、执行时长未超过超时限制。

### 交付物

- `src/eval/checkers/efficiency-checker.ts` — 导出 `checkEfficiency(context: CheckContext): CheckResult`
- `tests/unit/eval/checkers/efficiency-checker.test.ts` — 覆盖命令次数、token 用量、执行时长等场景

### 接口契约

```typescript
// 复用 CheckContext 和 CheckResult，checkerId 为 'efficiency'
// score 满分 25
// 阈值可配置，默认值在实现中定义
```

### 备注

- 默认阈值：命令执行次数 <= 10、token 用量 <= 10000、执行时长 <= 30 秒
- 超时判定委托沙箱管理器的超时机制
- 此检查器不依赖 SKILL.md 章节，始终适用（notApplicable=false）

---

## T-008 确定性评测引擎编排器

```yaml
id: T-008
story_id: ST-003
title: 确定性评测引擎编排器
owner_role: dev
status: todo
depends_on: [T-004, T-005, T-006, T-007]
read_paths:
  - src/eval/deterministic-engine.ts
  - src/eval/checkers/*.ts
  - src/types/eval.ts
write_paths:
  - src/eval/deterministic-engine.ts
  - tests/unit/eval/deterministic-engine.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/deterministic-engine.test.ts
  - type: manual
    value: 验证 AC-003-5 ~ AC-003-7（综合编排逻辑）
```

### 目标

编排 4 个检查器的执行，汇总检查结果，计算确定性评测总分，处理 "不适用" 场景。

### 交付物

- `src/eval/deterministic-engine.ts` — 导出 `runDeterministicEval(context: CheckContext): DeterministicEvalResult`
- `tests/unit/eval/deterministic-engine.test.ts` — 覆盖全部通过、部分失败、不适用等组合场景

### 接口契约

```typescript
interface DeterministicEvalResult {
  totalScore: number;            // 0-100（按适用检查器数量等比缩放）
  maxScore: number;              // 实际满分
  checks: CheckResult[];         // 4 个检查器的结果
  allPassed: boolean;
  notApplicableChecks: string[]; // 标记为不适用的检查器 id
}

function runDeterministicEval(context: CheckContext): DeterministicEvalResult;
// 编排 4 个检查器
// 不适用的检查器不计入总分，按剩余检查器等比缩放至 100
```

### 备注

- 4 类检查全部通过时确定性评测记满分
- 不适用的检查器从分母中排除，剩余按比例缩放
- 每类检查输出明确的 pass/fail 和详细说明

---

## T-009 模型辅助 Rubric 评测引擎

```yaml
id: T-009
story_id: ST-004
title: 模型辅助 Rubric 评测引擎
owner_role: dev
status: todo
depends_on: [T-002, T-003]
read_paths:
  - src/eval/rubric-engine.ts
  - src/types/eval.ts
  - src/types/trace.ts
  - src/eval/sandbox-manager.ts
  - src/eval/trace-collector.ts
write_paths:
  - src/eval/rubric-engine.ts
  - src/types/rubric.ts
  - tests/unit/eval/rubric-engine.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/rubric-engine.test.ts
  - type: manual
    value: 验证 ST-004 全部 AC（AC-004-1 ~ AC-004-6）
```

### 目标

实现可选的模型辅助 Rubric 定性评测引擎，支持自定义 JSON Schema 评分模板，输出结构化评分结果。

### 交付物

- `src/types/rubric.ts` — 定义 `RubricSchema`、`RubricResult`、`RubricCheck`
- `src/eval/rubric-engine.ts` — 导出 `runRubricEval(context: RubricContext): Promise<RubricResult>`
- `tests/unit/eval/rubric-engine.test.ts` — 覆盖正常评分、Schema 校验、重试机制、模型失败等场景

### 接口契约

```typescript
interface RubricSchema {
  dimensions: RubricDimension[];
  passingThreshold: number;   // 0-100
}

interface RubricDimension {
  id: string;
  name: string;
  weight: number;             // 权重总和须为 1.0
  prompt: string;             // 该维度的评分提示
}

interface RubricResult {
  overallPass: boolean;
  score: number;              // 0-100
  checks: RubricCheck[];
  modelCalls: number;
  retries: number;
}

interface RubricCheck {
  id: string;
  pass: boolean;
  score: number;              // 0-100
  notes: string;
}

// 固定输出格式:
// { overall_pass: boolean, score: number, checks: Array<{id, pass, notes}> }

interface RubricContext {
  testCase: LoadedCase;
  sandbox: SandboxContext;
  schema: RubricSchema;
  traceCollector: TraceCollector;
}
```

### 备注

- 模型辅助为可选功能，默认不启用
- 评分执行采用只读模式，不修改任何文件
- 模型调用失败内置重试机制（默认 3 次）
- 不内置默认 Rubric 模板

---

## T-010 多维度量化打分体系

```yaml
id: T-010
story_id: ST-005
title: 多维度量化打分体系
owner_role: dev
status: todo
depends_on: [T-008, T-009]
read_paths:
  - src/eval/scorer.ts
  - src/types/eval.ts
  - src/types/rubric.ts
  - src/eval/deterministic-engine.ts
  - src/eval/rubric-engine.ts
write_paths:
  - src/eval/scorer.ts
  - tests/unit/eval/scorer.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/scorer.test.ts
  - type: manual
    value: 验证 ST-005 全部 AC（AC-005-1 ~ AC-005-5）
```

### 目标

实现三级打分体系：单条用例打分、单个 Skill 打分、全量 Skill 打分，计算过程透明可追溯。

### 交付物

- `src/eval/scorer.ts` — 导出 `scoreCase(caseResult: CaseEvalResult): CaseScore`、`scoreSkill(skillResults: CaseScore[]): SkillScore`、`scoreAllSkills(skillScores: SkillScore[]): AllSkillsScore`
- `tests/unit/eval/scorer.test.ts` — 覆盖三级打分计算、权重分配、无 Rubric 调整等场景

### 接口契约

```typescript
// 单条用例打分
interface CaseScore {
  caseId: string;
  score: number;              // 0-100
  deterministicScore: number;
  rubricScore: number | null;
  deductions: DeductionInfo[];
}

// 单个 Skill 打分
interface SkillScore {
  skillName: string;
  score: number;              // 0-100
  positivePassRate: number;   // 正例通过率
  negativePassRate: number;   // 负例准确率
  rubricAvgScore: number | null;
  caseScores: CaseScore[];
  formula: string;            // 打分公式描述
}

// 全量 Skill 打分
interface AllSkillsScore {
  averageScore: number;
  totalSkills: number;
  topSkills: SkillScore[];    // Top 3
  bottomSkills: SkillScore[]; // 末位 3
  overallHealth: number;      // 整体健康度 0-100
  skillScores: SkillScore[];
}

// 打分公式:
// 有 Rubric: 正例通过率 50% + 负例准确率 30% + Rubric 均分 20%
// 无 Rubric: 正例通过率 60% + 负例准确率 40%
```

### 备注

- 分数计算过程透明，每项扣分原因可追溯到具体检查项
- 未启用 Rubric 时自动调整权重公式
- 所有分数计算为纯函数，无副作用

---

## T-011 测试结果持久化与归档

```yaml
id: T-011
story_id: ST-007
title: 测试结果持久化与归档
owner_role: dev
status: todo
depends_on: [T-008, T-010]
read_paths:
  - src/eval/persistence.ts
  - src/types/eval.ts
  - src/eval/scorer.ts
  - src/eval/trace-collector.ts
write_paths:
  - src/eval/persistence.ts
  - tests/unit/eval/persistence.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/persistence.test.ts
  - type: manual
    value: 验证 ST-007 全部 AC（AC-007-1 ~ AC-007-6）
```

### 目标

实现评测结果的本地持久化，按「测试时间/Skill 业务分类/Skill 名称」三级目录结构归档 JSON 结果和 trace 日志。

### 交付物

- `src/eval/persistence.ts` — 导出 `persistResult(result: PersistInput): PersistOutput`
- `tests/unit/eval/persistence.test.ts` — 覆盖目录创建、JSON 写入、权限不足等场景

### 接口契约

```typescript
interface PersistInput {
  skillName: string;
  category: string;
  skillScore: SkillScore;
  caseResults: CaseEvalResult[];
  tracePath: string;
  timestamp: string;         // ISO 8601
}

interface PersistOutput {
  resultDir: string;          // .quick-skill-eval/{time}/{category}/{skill-name}/
  jsonPath: string;           // result.json
  tracePath: string;          // trace.jsonl（复制到归档目录）
  htmlPath: string;           // report.html（T-013 生成）
}

function persistResult(input: PersistInput): PersistOutput;
// 目录: ./.quick-skill-eval/{YYYYMMDD-HHmmss}/{category}/{skill-name}/
```

### 备注

- 目标目录无写入权限时输出明确错误并终止
- JSON 结果包含所有用例执行情况、打分详情、检查项明细、trace 引用路径
- 持久化操作不阻塞主评测流程

---

## T-012 回归检测与版本对比

```yaml
id: T-012
story_id: ST-008
title: 回归检测与版本对比
owner_role: dev
status: todo
depends_on: [T-011]
read_paths:
  - src/eval/regression-detector.ts
  - src/types/eval.ts
  - src/eval/persistence.ts
write_paths:
  - src/eval/regression-detector.ts
  - tests/unit/eval/regression-detector.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/regression-detector.test.ts
  - type: manual
    value: 验证 ST-008 全部 AC（AC-008-1 ~ AC-008-5）
```

### 目标

自动对比当前评测结果与该 Skill 上一次的历史结果，标注新增失败和得分下降。

### 交付物

- `src/eval/regression-detector.ts` — 导出 `detectRegression(currentResult: SkillScore, skillName: string, category: string): RegressionResult`
- `tests/unit/eval/regression-detector.test.ts` — 覆盖首次评测、有回归、无回归、部分回归等场景

### 接口契约

```typescript
interface RegressionResult {
  isFirstRun: boolean;
  regressions: RegressionItem[];
  hasRegression: boolean;
  previousScore: number | null;
  scoreDelta: number | null;  // 正数=提升，负数=下降
}

interface RegressionItem {
  caseId: string;
  type: 'new_failure' | 'score_drop';
  previousScore?: number;
  currentScore: number;
  dropAmount?: number;
}

function detectRegression(currentResult: SkillScore, skillName: string, category: string): RegressionResult;
// 从 .quick-skill-eval/ 查找上一次结果
// 无历史结果时标记 isFirstRun=true
```

### 备注

- 仅对比上一次结果，不支持任意两次历史对比
- 回归检测结果写入当前 JSON 结果文件
- 发现回归时终端输出警告信息

---

## T-013 HTML 可视化报告生成

```yaml
id: T-013
story_id: ST-011
title: HTML 可视化报告生成
owner_role: dev
status: todo
depends_on: [T-011]
read_paths:
  - src/eval/report-generator.ts
  - src/types/eval.ts
  - src/eval/scorer.ts
  - src/eval/regression-detector.ts
write_paths:
  - src/eval/report-generator.ts
  - src/eval/templates/report.html.ts
  - tests/unit/eval/report-generator.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/eval/report-generator.test.ts
  - type: manual
    value: 验证 ST-011 全部 AC（AC-011-1 ~ AC-011-5）
```

### 目标

评测完成后生成轻量级 HTML 可视化报告，包含得分概览、失败用例详情、回归提示、trace 链接。

### 交付物

- `src/eval/templates/report.html.ts` — HTML 模板字符串生成器（纯函数，无外部依赖）
- `src/eval/report-generator.ts` — 导出 `generateHtmlReport(data: ReportData, outputPath: string): string`
- `tests/unit/eval/report-generator.test.ts` — 覆盖报告生成、失败用例展示、trace 链接等场景

### 接口契约

```typescript
interface ReportData {
  skillName: string;
  category: string;
  skillScore: SkillScore;
  caseResults: CaseEvalResult[];
  regression: RegressionResult;
  traceRelativePath: string;  // trace 文件相对路径
  timestamp: string;
}

function generateHtmlReport(data: ReportData, outputPath: string): string;
// 使用轻量模板引擎（字符串拼接或简单模板函数）
// 输出自包含 HTML，不依赖外部 CSS/JS
// 返回生成的 HTML 文件路径
```

### 备注

- 报告使用内联 CSS，不依赖外部资源，可离线打开
- 失败用例展示完整 prompt、预期结果、实际结果
- trace 日志通过相对路径链接跳转
- 与 T-012 可并行开发（均只依赖 T-011）

---

## T-014 eval 单 Skill 评测命令

```yaml
id: T-014
story_id: ST-009
title: eval 单 Skill 评测命令
owner_role: dev
status: todo
depends_on: [T-010, T-011]
read_paths:
  - src/cli/commands/eval.ts
  - src/eval/case-loader.ts
  - src/eval/sandbox-manager.ts
  - src/eval/deterministic-engine.ts
  - src/eval/rubric-engine.ts
  - src/eval/scorer.ts
  - src/eval/persistence.ts
  - src/eval/regression-detector.ts
  - src/eval/trace-collector.ts
  - src/eval/report-generator.ts
  - src/cli/utils/skill-finder.ts
write_paths:
  - src/cli/commands/eval.ts
  - tests/integration/eval.test.ts
verify:
  - type: command
    value: npx vitest run tests/integration/eval.test.ts
  - type: manual
    value: 验证 ST-009 全部 AC（AC-009-1 ~ AC-009-7）
```

### 目标

实现 `quick-skill eval [skill-name]` 命令，串联用例加载、沙箱创建、确定性评测、打分计算、持久化、回归检测的完整评测流程。

### 交付物

- `src/cli/commands/eval.ts` — 注册 `eval` 命令，编排完整评测流程
- `tests/integration/eval.test.ts` — 集成测试：端到端评测验证

### 接口契约

```typescript
function registerEvalCommand(program: Command): void;
// 参数:
//   skill-name (positional)
//   --rubric <schema-path>   启用模型辅助评测
//   --timeout <seconds>      单条用例超时（默认 10，最大 30）
```

### 备注

- Skill 不存在时输出明确错误并退出
- 无用例文件时提示先执行 eval-gen 并退出
- 评测过程展示进度条、当前用例 id、实时通过/失败状态
- 评测完成后输出汇总：平均分、用例通过率、回归风险提示
- 退出码 0（全部通过）或 1（存在失败）
- 失败用例自动输出 trace 路径

---

## T-015 批量与全量评测命令

```yaml
id: T-015
story_id: ST-010
title: 批量与全量评测命令
owner_role: dev
status: todo
depends_on: [T-014]
read_paths:
  - src/cli/commands/eval.ts
  - src/cli/utils/skill-scanner.ts
  - src/eval/case-loader.ts
  - src/eval/scorer.ts
write_paths:
  - src/cli/commands/eval.ts
  - tests/integration/eval-batch.test.ts
verify:
  - type: command
    value: npx vitest run tests/integration/eval-batch.test.ts
  - type: manual
    value: 验证 ST-010 全部 AC（AC-010-1 ~ AC-010-7）
```

### 目标

实现批量评测和全量评测能力，支持并发控制、分类筛选、增量评测。

### 交付物

- 修改 `src/cli/commands/eval.ts` — 添加批量/全量模式逻辑
- `tests/integration/eval-batch.test.ts` — 验证批量、全量、并发、分类筛选等

### 接口契约

```typescript
// 扩展 eval 命令参数:
//   --all                    全量评测
//   --concurrency <number>   并发数（默认 5）
//   --category <name>        按分类筛选
//   --incremental            仅测试上次后有变更的 Skill
//   skill-name 支持逗号分隔多个: eval skill1,skill2,...
```

### 备注

- 单个 Skill 失败不阻塞其他
- 并发使用 `Promise.allSettled` 实现
- 全量完成后输出极简汇总：总数、通过率、平均分、Top 3 高风险、回归项数量
- `--incremental` 通过对比 `.skill-snapshot.json` 哈希判断是否有变更

---

## 并行分析

```
T-001 ──┐                    T-004 ──┐
T-002 ──┼── T-004~T-007 ─────┤       │
T-003 ──┘       │            T-005 ──┤
                │            T-006 ──┼── T-008 ──┐
                │            T-007 ──┘            │
                │                                  │
                └── T-009 ────────────────────────┼── T-010 ── T-011 ──┬── T-012
                                                                  │       └── T-013
                                                                  └── T-014 ── T-015
```

**可并行组**:
- 第一层: T-001、T-002、T-003（完全无依赖，可三人并行）
- 第二层: T-004、T-005、T-006、T-007、T-009（T-004~T-007 依赖 T-001/002/003，T-009 依赖 T-002/003，共 5 个可并行）
- 第三层: T-008（汇聚 4 个检查器）
- 第四层: T-010（汇聚 T-008 + T-009）
- 第五层: T-011（依赖 T-008 + T-010）
- 第六层: T-012、T-013（均只依赖 T-011，可并行）
- 第六层（同时）: T-014（依赖 T-010 + T-011）
- 第七层: T-015（依赖 T-014）

## 跨 Feature 依赖声明

本 Feature 依赖 FEAT-004 的以下接口（只读引用）:

| 模块 | 路径 | 用途 |
|------|------|------|
| TestCase 类型 | `src/types/test-case.ts` | 用例数据结构 |
| SkillAnchor 类型 | `src/types/skill.ts` | SKILL.md 解析结果 |
| readCasesFromCsv | `src/io/csv-reader.ts` | 读取用例 CSV |
| parseSkillMd | `src/core/skill-parser.ts` | 解析 SKILL.md |
| findSkillDir | `src/cli/utils/skill-finder.ts` | Skill 查找 |
| scanAllSkills | `src/cli/utils/skill-scanner.ts` | 批量扫描 |

本 Feature 依赖 FEAT-005 的以下接口（只读引用）:

| 模块 | 路径 | 用途 |
|------|------|------|
| readSnapshot | `src/io/snapshot-manager.ts` | 读取快照（增量判断） |

## 共享接口契约汇总

| 模块 | 文件 | 消费方 |
|------|------|--------|
| 评测类型 | `src/types/eval.ts` | T-001 输出, 所有 T-004~T-015 消费 |
| Trace 类型 | `src/types/trace.ts` | T-003 输出, T-004~T-009/T-011 消费 |
| Rubric 类型 | `src/types/rubric.ts` | T-009 输出, T-010 消费 |
| 确定性引擎 | `src/eval/deterministic-engine.ts` | T-008 输出, T-010/T-014 消费 |
| Rubric 引擎 | `src/eval/rubric-engine.ts` | T-009 输出, T-010 消费 |
| 打分体系 | `src/eval/scorer.ts` | T-010 输出, T-011/T-013/T-014/T-015 消费 |
| 持久化 | `src/eval/persistence.ts` | T-011 输出, T-012/T-014 消费 |
| 回归检测 | `src/eval/regression-detector.ts` | T-012 输出, T-013/T-014 消费 |
| HTML 报告 | `src/eval/report-generator.ts` | T-013 输出, T-014 消费 |
