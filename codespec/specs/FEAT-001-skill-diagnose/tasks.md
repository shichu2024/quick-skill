# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|------|------|--------|
| T-001 | - | CLI 命令注册与诊断框架基础 | done | - | dev |
| T-002 | ST-001 | 结构合规性检查器 | done | T-001 | dev |
| T-003 | ST-001 | 元数据合规性检查器 | done | T-001 | dev |
| T-004 | ST-001 | 边界合规性检查器 | done | T-001 | dev |
| T-005 | ST-001 | 标准合规性检查器 | done | T-001 | dev |
| T-006 | ST-001 | 格式合规性检查器 | done | T-001 | dev |
| T-007 | ST-001 | 评测合规性检查器 | done | T-001 | dev |
| T-008 | ST-001 | 兼容性合规性检查器 | done | T-001 | dev |
| T-009 | ST-002 | 量化评分引擎 | done | T-001 | dev |
| T-010 | ST-003 | Markdown 诊断报告生成器 | done | T-009 | dev |
| T-011 | ST-004 | 改造清单生成器 | done | T-009 | dev |
| T-012 | ST-005 | 批量诊断与汇总报告 | done | T-010, T-011 | dev |
| T-013 | ST-006 | 可标准化问题自动修复引擎 | done | T-011 | dev |

---

## T-001 CLI 命令注册与诊断框架基础

```yaml
id: T-001
story_id: "-"
title: CLI 命令注册与诊断框架基础
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/cli/**
  - src/core/**
  - src/types/**
write_paths:
  - src/cli/commands/diagnose.ts
  - src/core/diagnosis/diagnosis-engine.ts
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
verify:
  - type: command
    value: npm run build
  - type: command
    value: npm test -- --grep "diagnosis framework"
  - type: manual
    value: "quick-skill diagnose --help 输出正确的命令描述和参数列表"
```

### 目标

1. 建立 `diagnose` CLI 命令入口，注册 `--output`、`--fix-auto`、`--batch`、`--filter` 参数。
2. 实现诊断引擎抽象层：定义 `DiagnosticChecker` 接口、`DiagnosticResult` 类型、`CheckerRegistry` 注册机制。
3. 实现单技能诊断调度逻辑：接收路径，按序调用已注册的 7 个 checker，汇总结果。

### 交付物

- `diagnose.ts` -- CLI 命令定义与参数解析
- `types.ts` -- `DiagnosticDimension` 枚举、`DiagnosticResult`、`CheckResult`、`FixLevel` 类型定义
- `diagnosis-engine.ts` -- 诊断引擎，调度 checker 并收集结果
- `checker-registry.ts` -- checker 注册表，支持动态注册和按序执行

### 接口契约

```typescript
// types.ts 核心类型
type FixLevel = 'required' | 'recommended';

type CheckStatus = 'pass' | 'fail' | 'not_applicable';

interface CheckResult {
  dimension: DiagnosticDimension;
  status: CheckStatus;
  fixLevel?: FixLevel;
  message: string;
  details?: string;
  autoFixable: boolean;
  fixAction?: string;
}

interface DiagnosticResult {
  skillPath: string;
  skillName: string;
  timestamp: string;
  checks: CheckResult[];
  score?: number;
}

interface DiagnosticChecker {
  dimension: DiagnosticDimension;
  check(skillPath: string): Promise<CheckResult>;
}
```

### 备注

- `DiagnosticDimension` 枚举包含 7 个值：`structure`、`metadata`、`boundary`、`standard`、`format`、`evaluation`、`compatibility`。
- 此 task 不实现具体 checker 逻辑，仅定义接口和调度框架。
- `--batch`、`--fix-auto`、`--filter` 参数注册但不实现逻辑，留给后续 task。

---

## T-002 结构合规性检查器

```yaml
id: T-002
story_id: ST-001
title: 结构合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/structure-checker.ts
  - tests/unit/diagnosis/checkers/structure-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "structure-checker"
  - type: manual
    value: "对标准化目录结构的技能返回 pass，对零散文件结构的技能返回 fail + 具体原因"
```

### 目标

1. 实现结构合规性维度检查：验证技能为独立目录、包含核心技能文件、无零散散落文件。
2. 检测结果标注 `autoFixable` 和 `fixAction`（如"创建缺失目录"）。

### 交付物

- `structure-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 核心技能文件定义参考 SKILL.md 规范（必须存在至少一个技能定义文件）。
- 检查项：是否为独立目录、是否包含核心文件、是否存在零散散落文件（根目录下的非目录文件）。
- 修复等级：目录结构缺失为 `required`，零散文件为 `recommended`。

---

## T-003 元数据合规性检查器

```yaml
id: T-003
story_id: ST-001
title: 元数据合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/metadata-checker.ts
  - tests/unit/diagnosis/checkers/metadata-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "metadata-checker"
  - type: manual
    value: "缺少 name 或 description 的技能返回 fail"
```

### 目标

1. 实现元数据合规性维度检查：验证技能包含 `name` 和 `description` 定义。
2. 检测 SKILL.md 的 YAML front matter 中 `name`、`description` 字段的完整性和格式。

### 交付物

- `metadata-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 检查项：name 是否存在、name 是否为 kebab-case、description 是否存在且非空。
- name 不为 kebab-case 标记为 `autoFixable`，可自动转换。
- 无 SKILL.md 文件时整个维度标记为 `fail` + `required`。

---

## T-004 边界合规性检查器

```yaml
id: T-004
story_id: ST-001
title: 边界合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/boundary-checker.ts
  - tests/unit/diagnosis/checkers/boundary-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "boundary-checker"
  - type: manual
    value: "缺少 When to use / When NOT to use 的技能返回 fail"
```

### 目标

1. 实现边界合规性维度检查：验证技能定义了 "When to use this" 和 "When NOT to use this"。
2. 检查章节内容是否非空且有意义（非模板占位符）。

### 交付物

- `boundary-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 检查项：是否存在 "When to use this" 章节、是否存在 "When NOT to use this" 章节、内容是否非空。
- 此维度通常 `autoFixable: false`，因为边界定义需要人工判断。
- 修复等级：`required`。

---

## T-005 标准合规性检查器

```yaml
id: T-005
story_id: ST-001
title: 标准合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/standard-checker.ts
  - tests/unit/diagnosis/checkers/standard-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "standard-checker"
  - type: manual
    value: "缺少 Definition of done 或内容不可量化的技能返回 fail"
```

### 目标

1. 实现标准合规性维度检查：验证技能有可量化的 "Definition of done"。
2. 检查完成标准是否包含可量化指标（数字、百分比、明确判断条件）。

### 交付物

- `standard-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 检查项：是否存在 "Definition of done" 章节、内容是否包含量化指标（启发式检测）。
- 量化指标检测：是否包含数字、百分比、明确的布尔条件描述。
- 修复等级：`required`，`autoFixable: false`。

---

## T-006 格式合规性检查器

```yaml
id: T-006
story_id: ST-001
title: 格式合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/format-checker.ts
  - tests/unit/diagnosis/checkers/format-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "format-checker"
  - type: manual
    value: "文件名含空格或非 kebab-case 的返回 fail + autoFixable=true"
```

### 目标

1. 实现格式合规性维度检查：验证技能文件命名符合 kebab-case 规范，无特殊字符和空格。
2. 检测编码格式和换行符一致性。

### 交付物

- `format-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 检查项：目录名是否符合 kebab-case、文件名是否符合 kebab-case、是否存在特殊字符/空格。
- 文件重命名标记为 `autoFixable: true`，`fixAction: "rename"`。
- 编码问题标记为 `autoFixable: true`，`fixAction: "reencode"`。
- 修复等级：`recommended`。

---

## T-007 评测合规性检查器

```yaml
id: T-007
story_id: ST-001
title: 评测合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/evaluation-checker.ts
  - tests/unit/diagnosis/checkers/evaluation-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "evaluation-checker"
  - type: manual
    value: "无 evals/ 目录或用例不足的技能返回 fail"
```

### 目标

1. 实现评测合规性维度检查：验证技能具备覆盖 4 类核心场景的测试用例。
2. 检查 evals 目录和用例文件的完整性和格式。

### 交付物

- `evaluation-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 4 类核心场景：正向用例、边界用例、错误处理用例、兼容性用例。
- 检查项：evals/ 目录是否存在、用例文件是否存在、用例数量是否 >= 4、是否覆盖 4 类场景。
- 用例文件格式检查：是否为 CSV 格式、是否包含必要列。
- 修复等级：`recommended`，`autoFixable: false`（需调用 eval-gen 生成）。

---

## T-008 兼容性合规性检查器

```yaml
id: T-008
story_id: ST-001
title: 兼容性合规性检查器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/checker-registry.ts
write_paths:
  - src/core/diagnosis/checkers/compatibility-checker.ts
  - tests/unit/diagnosis/checkers/compatibility-checker.test.ts
verify:
  - type: command
    value: npm test -- --grep "compatibility-checker"
  - type: manual
    value: "检测到 Agent 强绑定逻辑的技能返回 fail"
```

### 目标

1. 实现兼容性合规性维度检查：验证技能无单一 Agent 强绑定逻辑，可跨 Agent 通用。
2. 检测技能内容中是否引用了特定 Agent 的专有 API 或硬编码路径。

### 交付物

- `compatibility-checker.ts` -- 实现 `DiagnosticChecker` 接口
- 对应单元测试文件

### 备注

- 检查项：是否引用特定 Agent 专有 API（Claude only / OpenCode only）、是否存在硬编码的 Agent 路径、是否使用非通用的工具调用方式。
- Agent 专有模式关键词可配置。
- 修复等级：`recommended`，`autoFixable: false`。

---

## T-009 量化评分引擎

```yaml
id: T-009
story_id: ST-002
title: 量化评分引擎
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/diagnosis/types.ts
write_paths:
  - src/core/diagnosis/scoring-engine.ts
  - tests/unit/diagnosis/scoring-engine.test.ts
verify:
  - type: command
    value: npm test -- --grep "scoring-engine"
  - type: manual
    value: "所有维度通过时得分 100，存在 fail 项时按权重扣分"
```

### 目标

1. 实现量化评分算法：基于 7 个维度的检查结果计算 0-100 总分。
2. 每个 `required` 维度权重高于 `recommended` 维度，不通过项按权重扣分。
3. 输出各维度独立评分。

### 交付物

- `scoring-engine.ts` -- 评分计算逻辑
- 对应单元测试文件

### 接口契约

```typescript
interface DimensionScore {
  dimension: DiagnosticDimension;
  score: number;       // 0-100
  weight: number;      // 权重
  status: CheckStatus;
}

interface ScoringResult {
  totalScore: number;  // 0-100
  dimensionScores: DimensionScore[];
}
```

### 备注

- 默认权重方案：`required` 维度占 60% 权重，`recommended` 占 40%。
- 各维度内部权重均分（即 7 个维度各占约 14.3% 的基础权重，再按 fixLevel 加权）。
- 所有维度通过时总分 = 100。
- ST-001 的 T-002~T-008 和 T-009 可并行开发，T-009 仅依赖类型定义（T-001）。

---

## T-010 Markdown 诊断报告生成器

```yaml
id: T-010
story_id: ST-003
title: Markdown 诊断报告生成器
owner_role: dev
status: todo
depends_on: [T-009]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/scoring-engine.ts
write_paths:
  - src/core/diagnosis/report/markdown-report.ts
  - tests/unit/diagnosis/report/markdown-report.test.ts
verify:
  - type: command
    value: npm test -- --grep "markdown-report"
  - type: manual
    value: "生成 Markdown 格式报告，包含评分、维度结果、风险项高亮、优先级排序"
```

### 目标

1. 实现 Markdown 格式诊断报告生成，包含合规评分、各维度诊断结果、风险项高亮、改造优先级排序。
2. 报告按 "必须修复 -> 建议修复 -> 已通过" 优先级排序展示各维度。
3. 支持 `--output` 参数自定义输出路径，默认输出到当前工作目录。

### 交付物

- `markdown-report.ts` -- 报告模板与生成逻辑
- 对应单元测试文件

### 备注

- 报告结构：(1) 元信息区（时间戳、技能路径、技能名称）(2) 合规评分摘要 (3) 按优先级排序的维度详情 (4) 改造清单章节（集成 T-011 的输出）。
- 文件名格式：`diagnosis-report-{skillName}-{timestamp}.md`。
- 报告生成不依赖 checker 实现，仅依赖 `DiagnosticResult` 和 `ScoringResult` 类型。

---

## T-011 改造清单生成器

```yaml
id: T-011
story_id: ST-004
title: 改造清单生成器
owner_role: dev
status: todo
depends_on: [T-009]
read_paths:
  - src/core/diagnosis/types.ts
write_paths:
  - src/core/diagnosis/remediation-plan.ts
  - tests/unit/diagnosis/remediation-plan.test.ts
verify:
  - type: command
    value: npm test -- --grep "remediation-plan"
  - type: manual
    value: "清单按可自动修复/需人工确认分组，每项包含问题描述、维度、修复等级、是否可自动修复、预期效果"
```

### 目标

1. 基于 `DiagnosticResult` 生成改造清单，按 "可自动修复 / 需人工确认" 分组。
2. 每项包含：问题描述、涉及维度、修复等级、是否可自动修复、预期效果、修复动作描述。
3. 所有诊断项均通过时输出"无需改造"。

### 交付物

- `remediation-plan.ts` -- 改造清单生成逻辑
- 对应单元测试文件

### 接口契约

```typescript
interface RemediationItem {
  description: string;
  dimension: DiagnosticDimension;
  fixLevel: FixLevel;
  autoFixable: boolean;
  expectedEffect: string;
  fixAction?: string;
}

interface RemediationPlan {
  autoFixableItems: RemediationItem[];
  manualItems: RemediationItem[];
}
```

### 备注

- 此模块被 Markdown 报告生成器调用，作为报告的一个章节。
- 也被自动修复引擎（T-013）调用，获取可自动修复的项列表。
- T-010 和 T-011 可并行开发。

---

## T-012 批量诊断与汇总报告

```yaml
id: T-012
story_id: ST-005
title: 批量诊断与汇总报告
owner_role: dev
status: todo
depends_on: [T-010, T-011]
read_paths:
  - src/cli/commands/diagnose.ts
  - src/core/diagnosis/diagnosis-engine.ts
  - src/core/diagnosis/report/markdown-report.ts
write_paths:
  - src/core/diagnosis/batch-diagnosis.ts
  - src/core/diagnosis/report/batch-report.ts
  - tests/unit/diagnosis/batch-diagnosis.test.ts
verify:
  - type: command
    value: npm test -- --grep "batch-diagnosis"
  - type: manual
    value: "批量扫描目录，输出汇总报告（总扫描数/合规数/不合规数/按评分排序）"
```

### 目标

1. 实现批量诊断：扫描指定目录下所有子目录，对每个子目录执行技能诊断。
2. 实现汇总报告：总扫描数、合规数、不合规数、按合规评分从低到高排序的技能清单。
3. 支持 `--filter` 参数按技能文件类型筛选。
4. 单个技能诊断失败不阻塞其他技能，展示实时进度。

### 交付物

- `batch-diagnosis.ts` -- 批量诊断调度逻辑
- `batch-report.ts` -- 汇总报告生成
- 对应单元测试文件

### 备注

- V1 采用串行执行，不支持并发配置。
- 不支持暂停与续跑。
- 进度反馈格式：`[3/10] Diagnosing skill-name...`。
- 失败项记录错误原因，标记为 "diagnosis_failed"，不参与评分排序。

---

## T-013 可标准化问题自动修复引擎

```yaml
id: T-013
story_id: ST-006
title: 可标准化问题自动修复引擎
owner_role: dev
status: todo
depends_on: [T-011]
read_paths:
  - src/core/diagnosis/types.ts
  - src/core/diagnosis/remediation-plan.ts
  - src/core/diagnosis/checkers/format-checker.ts
  - src/core/diagnosis/checkers/metadata-checker.ts
  - src/core/diagnosis/checkers/structure-checker.ts
write_paths:
  - src/core/diagnosis/auto-fix-engine.ts
  - src/core/diagnosis/fixers/rename-fixer.ts
  - src/core/diagnosis/fixers/structure-fixer.ts
  - src/core/diagnosis/fixers/encoding-fixer.ts
  - tests/unit/diagnosis/auto-fix-engine.test.ts
verify:
  - type: command
    value: npm test -- --grep "auto-fix-engine"
  - type: manual
    value: "自动修复文件重命名、目录补齐、编码转换，备份原始文件到 .backup/"
```

### 目标

1. 实现自动修复引擎：基于改造清单中的 `autoFixable` 项执行修复动作。
2. 修复前自动备份原始文件到 `.backup/` 目录。
3. 修复完成后输出修复清单：已修复项数量、修复内容摘要、备份路径。
4. 修复失败时回滚已执行的修复操作，输出失败原因。

### 交付物

- `auto-fix-engine.ts` -- 自动修复调度逻辑、备份与回滚机制
- `rename-fixer.ts` -- 文件/目录重命名修复器
- `structure-fixer.ts` -- 目录结构补齐修复器
- `encoding-fixer.ts` -- 编码转换修复器
- 对应单元测试文件

### 接口契约

```typescript
interface Fixer {
  action: string;
  fix(item: RemediationItem, skillPath: string): Promise<FixResult>;
}

interface FixResult {
  success: boolean;
  description: string;
  backupPath?: string;
}
```

### 备注

- 仅修复可标准化的项：文件重命名（kebab-case）、目录结构补齐、编码格式转换。
- 不修改技能核心业务内容。
- 备份目录：`{skillPath}/.backup/{timestamp}/`，保存修复前的完整文件快照。
- 回滚机制：任何单个修复失败时，从备份恢复所有已修改文件。
- 标记为"需人工确认"的项不执行自动修复，在输出中明确标注。
