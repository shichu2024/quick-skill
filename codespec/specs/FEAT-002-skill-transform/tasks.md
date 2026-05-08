# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|------|------|--------|
| T-001 | - | CLI 命令注册与改造流水线框架 | todo | - | dev |
| T-002 | ST-001 | 结构标准化改造引擎 | todo | T-001 | dev |
| T-003 | ST-001 | 文件内容提取与分析器 | todo | T-001 | dev |
| T-004 | ST-002 | SKILL.md 自动生成引擎 | todo | T-002, T-003 | dev |
| T-005 | ST-002 | SKILL.md 交互式确认流程 | todo | T-004 | dev |
| T-006 | ST-003 | 测试用例自动补齐集成 | todo | T-004 | dev |
| T-007 | ST-004 | 合规性验证与评测流水线 | todo | T-004, T-006 | dev |
| T-008 | ST-005 | 生命周期管理与体系纳入 | todo | T-007 | dev |
| T-009 | ST-006 | 改造回滚引擎 | todo | T-001 | dev |
| T-010 | ST-007 | 批量改造调度与进度可视化 | todo | T-007, T-008 | dev |
| T-011 | ST-008 | 特殊形态技能兜底方案 | todo | T-002, T-004 | dev |

---

## T-001 CLI 命令注册与改造流水线框架

```yaml
id: T-001
story_id: "-"
title: CLI 命令注册与改造流水线框架
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/cli/**
  - src/core/**
  - src/types/**
write_paths:
  - src/cli/commands/transform.ts
  - src/core/transform/pipeline.ts
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
verify:
  - type: command
    value: npm run build
  - type: command
    value: npm test -- --grep "transform pipeline"
  - type: manual
    value: "quick-skill transform --help 输出正确的命令描述和参数列表"
```

### 目标

1. 建立 `transform` CLI 命令入口，注册 `--rollback`、`--batch`、`--concurrency` 参数。
2. 实现改造流水线抽象层：定义 5 阶段 pipeline 接口、阶段间上下文传递机制、流水线调度器。
3. 每个阶段的执行结果和中间产物通过 `PipelineContext` 在阶段间传递。

### 交付物

- `transform.ts` -- CLI 命令定义与参数解析
- `types.ts` -- `TransformStage` 枚举、`StageResult`、`TransformContext` 类型定义
- `pipeline.ts` -- 流水线调度器，按序执行已注册的阶段
- `pipeline-context.ts` -- 上下文管理，承载阶段间传递的数据

### 接口契约

```typescript
type TransformStage = 'structure' | 'skill-md' | 'test-cases' | 'validate' | 'lifecycle';

interface StageResult {
  stage: TransformStage;
  success: boolean;
  message: string;
  artifacts?: string[];
  warnings?: string[];
}

interface PipelineContext {
  skillPath: string;
  skillName: string;
  backupPath: string;
  stageResults: Map<TransformStage, StageResult>;
  metadata: Record<string, unknown>;
}

interface PipelineStage {
  name: TransformStage;
  execute(context: PipelineContext): Promise<StageResult>;
}
```

### 备注

- 此 task 不实现具体阶段逻辑，仅定义接口和调度框架。
- `--rollback`、`--batch`、`--concurrency` 参数注册但不实现逻辑，留给后续 task。
- 改造前自动备份为阶段 0（在 pipeline 执行前自动完成），不属于 5 阶段之一。
- 备份路径：`{skillPath}/.backup/transform-{timestamp}/`。

---

## T-002 结构标准化改造引擎

```yaml
id: T-002
story_id: ST-001
title: 结构标准化改造引擎
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
write_paths:
  - src/core/transform/stages/structure-stage.ts
  - src/core/transform/structure-analyzer.ts
  - src/core/transform/file-migrator.ts
  - tests/unit/transform/stages/structure-stage.test.ts
verify:
  - type: command
    value: npm test -- --grep "structure-stage"
  - type: manual
    value: "自动创建标准化目录结构并迁移核心文件，已标准化的技能跳过迁移"
```

### 目标

1. 实现结构标准化改造阶段：目录归一化、核心文件提取与迁移、冗余文件清理。
2. 自动创建标准化目录结构 `[业务分类]/[skill-name]/`。
3. 已处于标准化目录结构的技能跳过迁移步骤。

### 交付物

- `structure-stage.ts` -- 实现 `PipelineStage` 接口的结构标准化阶段
- `structure-analyzer.ts` -- 分析存量技能的目录结构特征
- `file-migrator.ts` -- 执行文件迁移、目录创建、冗余清理
- 对应单元测试文件

### 备注

- 冗余文件识别规则：临时文件（`*.tmp`、`*.bak`）、备份文件（`.backup/`）、日志文件（`*.log`）。
- 迁移操作：将核心技能文件移动到标准化目录内，非核心文件保持原位。
- 已标准化检测：判断目录是否已符合 `[category]/[skill-name]/` 两级结构。
- 不修改技能核心业务逻辑。

---

## T-003 文件内容提取与分析器

```yaml
id: T-003
story_id: ST-001
title: 文件内容提取与分析器
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/transform/types.ts
write_paths:
  - src/core/transform/content-extractor.ts
  - src/core/transform/content-analyzer.ts
  - tests/unit/transform/content-extractor.test.ts
verify:
  - type: command
    value: npm test -- --grep "content-extractor"
  - type: manual
    value: "从存量技能文件中提取核心逻辑、执行步骤、能力描述等结构化内容"
```

### 目标

1. 实现技能文件内容解析和提取：从各类格式的技能文件中提取核心业务逻辑、执行步骤、核心能力描述。
2. 输出结构化的提取结果，供 SKILL.md 生成引擎使用。

### 交付物

- `content-extractor.ts` -- 从文件内容中提取结构化信息的提取器
- `content-analyzer.ts` -- 分析提取结果，识别技能类型和特征
- 对应单元测试文件

### 接口契约

```typescript
interface ExtractedContent {
  name?: string;
  description?: string;
  whenToUse?: string[];
  whenNotToUse?: string[];
  coreLogic?: string;
  steps?: string[];
  definitionOfDone?: string[];
  rawContent: string;
  format: 'markdown' | 'yaml' | 'text' | 'unknown';
}
```

### 备注

- 支持的文件格式：Markdown（优先）、YAML front matter、纯文本。
- 提取策略：先检测文件格式，再按格式选择对应的解析器。
- 无法提取的字段标记为 `undefined`，由后续阶段处理。
- T-002 和 T-003 可并行开发。

---

## T-004 SKILL.md 自动生成引擎

```yaml
id: T-004
story_id: ST-002
title: SKILL.md 自动生成引擎
owner_role: dev
status: todo
depends_on: [T-002, T-003]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
  - src/core/transform/content-extractor.ts
  - src/core/transform/structure-analyzer.ts
write_paths:
  - src/core/transform/stages/skill-md-stage.ts
  - src/core/transform/skill-md-generator.ts
  - src/core/transform/templates/skill-md-template.ts
  - tests/unit/transform/stages/skill-md-stage.test.ts
verify:
  - type: command
    value: npm test -- --grep "skill-md-stage"
  - type: manual
    value: "生成的 SKILL.md 包含完整 YAML front matter + 6 大章节"
```

### 目标

1. 实现 SKILL.md 自动生成阶段：基于提取的内容生成完整的标准化 SKILL.md。
2. 生成包含 YAML front matter（name、description）和 6 大章节的标准文件。
3. 自动转换 name 为 kebab-case 格式。

### 交付物

- `skill-md-stage.ts` -- 实现 `PipelineStage` 接口的 SKILL.md 生成阶段
- `skill-md-generator.ts` -- SKILL.md 内容组装逻辑
- `skill-md-template.ts` -- SKILL.md 模板定义
- 对应单元测试文件

### 备注

- 6 大章节：When to use this、When NOT to use this、What to build、Steps、Definition of done。
- 提取内容缺失时，使用占位模板文字标注 `[待补充]`。
- name 自动转 kebab-case，description 基于提取内容生成摘要。
- 覆盖写入前自动备份上一版本（如果存在）。

---

## T-005 SKILL.md 交互式确认流程

```yaml
id: T-005
story_id: ST-002
title: SKILL.md 交互式确认流程
owner_role: dev
status: todo
depends_on: [T-004]
read_paths:
  - src/core/transform/stages/skill-md-stage.ts
  - src/core/transform/skill-md-generator.ts
write_paths:
  - src/core/transform/interactive-confirm.ts
  - tests/unit/transform/interactive-confirm.test.ts
verify:
  - type: command
    value: npm test -- --grep "interactive-confirm"
  - type: manual
    value: "生成后启动交互式确认，用户可逐章节修改/补充/调整"
```

### 目标

1. 实现 SKILL.md 生成后的交互式确认流程。
2. 用户可逐章节查看、修改、补充、调整内容。
3. 用户确认后写入最终 SKILL.md 文件。

### 交付物

- `interactive-confirm.ts` -- 交互式确认流程逻辑
- 对应单元测试文件

### 备注

- 使用 inquirer.js 实现交互式确认。
- 每个章节独立展示当前生成内容，用户可选择"保留"、"编辑"、"跳过"。
- 编辑时提供文本编辑器或直接输入新内容。
- 此阶段不影响流水线上下文中的 `StageResult`，仅修改最终写入的文件内容。

---

## T-006 测试用例自动补齐集成

```yaml
id: T-006
story_id: ST-003
title: 测试用例自动补齐集成
owner_role: dev
status: todo
depends_on: [T-004]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
write_paths:
  - src/core/transform/stages/test-case-stage.ts
  - src/core/transform/eval-gen-adapter.ts
  - tests/unit/transform/stages/test-case-stage.test.ts
verify:
  - type: command
    value: npm test -- --grep "test-case-stage"
  - type: manual
    value: "自动调用 eval-gen 生成用例，已有自定义用例不覆盖"
```

### 目标

1. 实现测试用例自动补齐阶段：基于已补齐的 SKILL.md 调用 eval-gen 生成测试用例。
2. 识别并导入存量技能中已存在的零散测试用例，标记为 `custom=true`。
3. eval-gen 不可用时降级跳过，不阻塞后续阶段。

### 交付物

- `test-case-stage.ts` -- 实现 `PipelineStage` 接口的用例补齐阶段
- `eval-gen-adapter.ts` -- eval-gen 模块调用适配器
- 对应单元测试文件

### 接口契约

```typescript
interface EvalGenAdapter {
  isAvailable(): boolean;
  generateCases(skillMdPath: string, outputPath: string): Promise<string[]>;
  generateSnapshot(skillMdPath: string): Promise<string>;
}
```

### 备注

- 用例输出路径：`{skillPath}/evals/{skillName}.prompts.csv`。
- 快照文件：`{skillPath}/.skill-snapshot.json`。
- eval-gen 不可用时：`StageResult.success = true`，`warnings` 包含降级提示。
- T-005 和 T-006 可并行开发（T-005 是交互层，T-006 是自动化层）。

---

## T-007 合规性验证与评测流水线

```yaml
id: T-007
story_id: ST-004
title: 合规性验证与评测流水线
owner_role: dev
status: todo
depends_on: [T-004, T-006]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
write_paths:
  - src/core/transform/stages/validate-stage.ts
  - src/core/transform/eval-adapter.ts
  - src/core/transform/diagnose-adapter.ts
  - src/core/transform/retry-handler.ts
  - tests/unit/transform/stages/validate-stage.test.ts
verify:
  - type: command
    value: npm test -- --grep "validate-stage"
  - type: manual
    value: "改造后自动执行二次诊断 + 全量评测，不通过时自动重试最多 3 次"
```

### 目标

1. 实现合规性验证与评测阶段：改造完成后自动执行二次诊断和全量评测。
2. 二次诊断验证所有"必须修复"项已完成。
3. 评测不通过时自动回溯调整并重试，最多 3 次。
4. eval 模块不可用时降级跳过。

### 交付物

- `validate-stage.ts` -- 实现 `PipelineStage` 接口的验证阶段
- `eval-adapter.ts` -- eval 模块调用适配器
- `diagnose-adapter.ts` -- skill-diagnose 模块调用适配器
- `retry-handler.ts` -- 重试逻辑处理
- 对应单元测试文件

### 接口契约

```typescript
interface DiagnoseAdapter {
  isAvailable(): boolean;
  diagnose(skillPath: string): Promise<DiagnosticResult>;
}

interface EvalAdapter {
  isAvailable(): boolean;
  runEvaluation(skillPath: string): Promise<EvalResult>;
}
```

### 备注

- 验证流程：二次诊断 -> 检查准入标准 -> 执行用例测试 -> 全量评测。
- 准入标准：所有"必须修复"项全部通过（来自 FEAT-001 的诊断结果）。
- 重试策略：评测不通过 -> 回溯 SKILL.md 对应内容 -> 重新生成用例 -> 再次评测。
- 最大重试次数：3 次。
- eval 模块不可用时标记为"待评测验证"状态，不阻塞后续阶段。

---

## T-008 生命周期管理与体系纳入

```yaml
id: T-008
story_id: ST-005
title: 生命周期管理与体系纳入
owner_role: dev
status: todo
depends_on: [T-007]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
write_paths:
  - src/core/transform/stages/lifecycle-stage.ts
  - src/core/transform/version-manager.ts
  - src/core/transform/eval-sync-config.ts
  - tests/unit/transform/stages/lifecycle-stage.test.ts
verify:
  - type: command
    value: npm test -- --grep "lifecycle-stage"
  - type: manual
    value: "改造后自动生成版本号、同步到 skills/ 目录、配置 eval-sync 联动"
```

### 目标

1. 实现生命周期管理阶段：版本锁定、体系纳入、eval-sync 联动配置。
2. 为改造后的技能生成正式版本号，记录版本变更日志。
3. 自动将技能同步到 `./skills/` 分类目录下。
4. 配置 eval-sync 联动规则。

### 交付物

- `lifecycle-stage.ts` -- 实现 `PipelineStage` 接口的生命周期管理阶段
- `version-manager.ts` -- 版本号管理与变更日志
- `eval-sync-config.ts` -- eval-sync 联动配置生成
- 对应单元测试文件

### 备注

- 版本号规则：改造后技能从 `1.0.0` 开始。
- 变更日志记录：改造前状态 -> 改造后状态，包含时间戳和改造阶段摘要。
- eval-sync 联动配置：在技能目录下生成 `.eval-sync.json` 配置文件。
- 多 Agent 验证：检查技能目录结构在 Claude / OpenCode / Relay 三种 Agent 目录结构中的兼容性。

---

## T-009 改造回滚引擎

```yaml
id: T-009
story_id: ST-006
title: 改造回滚引擎
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/pipeline-context.ts
write_paths:
  - src/core/transform/rollback-engine.ts
  - tests/unit/transform/rollback-engine.test.ts
verify:
  - type: command
    value: npm test -- --grep "rollback-engine"
  - type: manual
    value: "通过 --rollback 恢复到改造前状态，删除改造产生的所有新文件"
```

### 目标

1. 实现 `--rollback` 回滚功能：从 `.backup/` 目录恢复原始文件和目录结构。
2. 删除改造过程中生成的所有新文件（SKILL.md、evals/ 目录、.skill-snapshot.json 等）。
3. 验证备份完整性，备份缺失时输出错误并终止。

### 交付物

- `rollback-engine.ts` -- 回滚逻辑：备份验证、文件恢复、清理
- 对应单元测试文件

### 备注

- 回滚流程：验证备份存在 -> 验证备份完整性 -> 删除改造产生的文件 -> 从备份恢复原始文件。
- 备份完整性验证：检查备份目录中是否包含完整的文件列表。
- 回滚完成后输出确认信息：技能名称、回滚前版本、回滚后版本、备份路径。
- 不删除 `.backup/` 目录本身。
- 仅支持完整回滚，不支持选择性回滚。
- T-009 与 T-002~T-008 可并行开发。

---

## T-010 批量改造调度与进度可视化

```yaml
id: T-010
story_id: ST-007
title: 批量改造调度与进度可视化
owner_role: dev
status: todo
depends_on: [T-007, T-008]
read_paths:
  - src/cli/commands/transform.ts
  - src/core/transform/pipeline.ts
write_paths:
  - src/core/transform/batch-transform.ts
  - src/core/transform/progress-tracker.ts
  - src/core/transform/batch-report.ts
  - tests/unit/transform/batch-transform.test.ts
verify:
  - type: command
    value: npm test -- --grep "batch-transform"
  - type: manual
    value: "批量改造多技能，实时显示进度，失败不阻塞，完成后输出汇总报告"
```

### 目标

1. 实现批量改造：扫描目录下所有技能，按诊断评分从低到高排序后依次执行改造。
2. 实时进度展示：当前技能/总数、当前阶段。
3. 单技能失败不阻塞其他技能。
4. 支持续跑：跳过已成功改造的技能。
5. 支持 `--concurrency` 参数控制并发数。

### 交付物

- `batch-transform.ts` -- 批量改造调度逻辑
- `progress-tracker.ts` -- 进度跟踪与状态持久化
- `batch-report.ts` -- 汇总报告生成
- 对应单元测试文件

### 接口契约

```typescript
interface BatchProgress {
  totalSkills: number;
  completedSkills: number;
  failedSkills: number;
  currentSkill: string;
  currentStage: TransformStage;
}

interface BatchResult {
  totalSkills: number;
  successCount: number;
  failCount: number;
  results: Array<{
    skillName: string;
    beforeScore: number;
    afterScore: number;
    status: 'success' | 'failed';
    error?: string;
  }>;
}
```

### 备注

- 续跑机制：通过 `.transform-progress.json` 文件记录已完成和未完成的技能。
- 进度展示格式：`[3/10] Transforming skill-name [skill-md stage]...`。
- 并发控制：默认串行（`concurrency=1`），最大 `concurrency=5`。
- 汇总报告输出到 Markdown 文件。

---

## T-011 特殊形态技能兜底方案

```yaml
id: T-011
story_id: ST-008
title: 特殊形态技能兜底方案
owner_role: dev
status: todo
depends_on: [T-002, T-004]
read_paths:
  - src/core/transform/types.ts
  - src/core/transform/content-analyzer.ts
  - src/core/transform/stages/structure-stage.ts
  - src/core/transform/stages/skill-md-stage.ts
write_paths:
  - src/core/transform/fallback/agent-bound-fallback.ts
  - src/core/transform/fallback/no-boundary-fallback.ts
  - src/core/transform/fallback/complex-script-fallback.ts
  - src/core/transform/fallback/legacy-fallback.ts
  - src/core/transform/fallback/special-format-fallback.ts
  - src/core/transform/fallback/fallback-registry.ts
  - tests/unit/transform/fallback/fallback-registry.test.ts
verify:
  - type: command
    value: npm test -- --grep "fallback"
  - type: manual
    value: "对 5 种特殊形态技能执行对应的兜底方案，改造报告中标注兜底类型"
```

### 目标

1. 实现 5 种特殊形态技能的兜底兼容方案。
2. 每种兜底方案在改造报告中标注兜底类型和处理方式。
3. 兜底方案不保证通过所有标准准入验证。

### 交付物

- `fallback-registry.ts` -- 兜底方案注册与选择
- `agent-bound-fallback.ts` -- 强绑定单一 Agent 技能兜底
- `no-boundary-fallback.ts` -- 无明确边界通用技能兜底
- `complex-script-fallback.ts` -- 带复杂配套脚本技能兜底
- `legacy-fallback.ts` -- 历史遗留无维护技能兜底
- `special-format-fallback.ts` -- 格式特殊技能兜底
- 对应单元测试文件

### 备注

- 兜底方案不自动判断技能类型，需要用户指定或确认。
- 兜底方案在 Pipeline 执行前介入，修改 Pipeline 的阶段行为。
- 各兜底方案的核心策略：
  - 强绑定 Agent：保留核心逻辑，标注适配 Agent 类型。
  - 无边界：生成最小集元数据，标注"通用技能"。
  - 复杂脚本：保留脚本目录，标注执行要求。
  - 历史遗留：标记"归档状态"，不进入发布流程。
  - 格式特殊：支持自定义目录结构映射，仅补齐元数据。
