# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|------|------|--------|
| T-001 | ST-001 | SKILL.md 变更检测引擎 | done | 无 | dev |
| T-002 | ST-001 | 章节变更到用例的影响映射规则 | done | T-001 | dev |
| T-003 | ST-005 | 约束解析与分类器 | done | 无 | dev |
| T-004 | ST-003 | 用例内容哈希与冲突检测器 | done | 无 | dev |
| T-005 | ST-004 | 用例停用处理器 | done | T-001 | dev |
| T-006 | ST-002 | 增量用例同步执行引擎 | done | T-001, T-002, T-004, T-005 | dev |
| T-007 | ST-006 | 约束驱动的 SKILL.md 更新与用例调整 | done | T-003, T-006 | dev |
| T-008 | ST-007 | eval-sync 命令入口（单 Skill + --override） | done | T-006, T-007 | dev |
| T-009 | ST-008 | eval-sync --all 批量同步 | done | T-008 | dev |
| T-FIX-001 | ST-002 | 修复无变更时快照错误写入缺陷 | done | T-006 | dev |

---

## T-001 SKILL.md 变更检测引擎

```yaml
id: T-001
story_id: ST-001
title: SKILL.md 变更检测引擎
owner_role: dev
status: done
depends_on: []
read_paths:
  - src/core/change-detector.ts
  - src/types/snapshot.ts
  - src/types/change.ts
  - src/io/snapshot-manager.ts
  - src/core/skill-parser.ts
write_paths:
  - src/core/change-detector.ts
  - src/types/change.ts
  - tests/unit/core/change-detector.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/core/change-detector.test.ts
  - type: manual
    value: 验证 ST-001 AC-001-1, AC-001-8, AC-001-9
```

### 目标

对比当前 SKILL.md 与 `.skill-snapshot.json` 快照，识别章节级别的变更（新增/修改/删除），输出结构化变更列表。

### 交付物

- `src/types/change.ts` — 定义变更相关类型：`SectionChange`、`ChangeType`（枚举: added/modified/removed）、`ChangeDetectionResult`
- `src/core/change-detector.ts` — 导出 `detectChanges(currentAnchor: SkillAnchor, snapshot: SkillSnapshot): ChangeDetectionResult`
- `tests/unit/core/change-detector.test.ts` — 覆盖无变更、单章节变更、多章节变更、全部变更等场景

### 接口契约

```typescript
type ChangeType = 'added' | 'modified' | 'removed';

interface SectionChange {
  section: string;        // 'name' | 'description' | 'whenToUse' | 'whenNotToUse' | 'definitionOfDone' | 'whatToBuild'
  changeType: ChangeType;
  previousContent: string;
  currentContent: string;
}

interface ChangeDetectionResult {
  hasChanges: boolean;
  changes: SectionChange[];
}

// 依赖 FEAT-004 的接口:
// - SkillAnchor (from src/types/skill.ts)
// - SkillSnapshot (from src/types/snapshot.ts)
// - readSnapshot (from src/io/snapshot-manager.ts)
// - parseSkillMd (from src/core/skill-parser.ts)
```

### 备注

- 以章节为最小变更单位，不做段落内 diff
- 无差异时 `hasChanges=false`，`changes` 为空数组
- 快照不存在时视为全新，所有章节标记为 `added`
- 依赖 FEAT-004 的 `SkillAnchor`、`SkillSnapshot`、`parseSkillMd`、`readSnapshot`（只读引用）

---

## T-002 章节变更到用例的影响映射规则

```yaml
id: T-002
story_id: ST-001
title: 章节变更到用例的影响映射规则
owner_role: dev
status: done
depends_on: [T-001]
read_paths:
  - src/core/impact-mapper.ts
  - src/types/change.ts
  - src/types/impact.ts
write_paths:
  - src/core/impact-mapper.ts
  - src/types/impact.ts
  - tests/unit/core/impact-mapper.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/core/impact-mapper.test.ts
  - type: manual
    value: 验证 ST-001 AC-001-2 ~ AC-001-7（6 条映射规则）
```

### 目标

将章节变更映射到受影响的用例类型和处理动作（新增/修改/停用），实现 6 条核心映射规则。

### 交付物

- `src/types/impact.ts` — 定义 `ImpactAction`（枚举: add/update/deprecate）、`CaseImpact`、`ImpactMappingResult`
- `src/core/impact-mapper.ts` — 导出 `mapChangesToImpacts(changes: SectionChange[]): ImpactMappingResult`
- `tests/unit/core/impact-mapper.test.ts` — 覆盖 6 条映射规则的验证

### 接口契约

```typescript
type ImpactAction = 'add' | 'update' | 'deprecate';

type CaseType = 'explicit' | 'implicit' | 'context' | 'negative';

interface CaseImpact {
  affectedCaseType: CaseType;
  action: ImpactAction;
  reason: string;
  relatedSection: string;
}

interface ImpactMappingResult {
  impacts: CaseImpact[];
}

// 映射规则:
// name/description 变更 -> 所有显式用例 update
// whenToUse 新增 -> 新增隐式/上下文用例 add
// whenToUse 删除 -> 对应场景用例 deprecate
// whenNotToUse 新增 -> 新增负例用例 add
// definitionOfDone 变更 -> 所有正向用例 update (pass_criteria)
// whatToBuild 变更 -> 相关用例 update (pass_criteria + prompt)
```

### 备注

- 映射规则为确定性逻辑，不涉及语义推理
- 映射结果供 T-006 消费，决定具体的用例操作

---

## T-003 约束解析与分类器

```yaml
id: T-003
story_id: ST-005
title: 约束解析与分类器
owner_role: dev
status: done
depends_on: []
read_paths:
  - src/core/constraint-parser.ts
  - src/types/constraint.ts
write_paths:
  - src/core/constraint-parser.ts
  - src/types/constraint.ts
  - tests/unit/core/constraint-parser.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/core/constraint-parser.test.ts
  - type: manual
    value: 验证 ST-005 全部 AC（AC-005-1 ~ AC-005-7）
```

### 目标

实现用户约束的解析与自动分类，将约束归类到 5 种类型（正向触发、负向禁止、成功标准、执行流程、风格规范）。

### 交付物

- `src/types/constraint.ts` — 定义 `ConstraintType`（枚举）、`ConstraintCategory`、`ParsedConstraint`
- `src/core/constraint-parser.ts` — 导出 `parseConstraint(input: string): ParsedConstraint`
- `tests/unit/core/constraint-parser.test.ts` — 覆盖 5 种约束类型、多分类匹配、无法分类等场景

### 接口契约

```typescript
type ConstraintType =
  | 'positive-trigger'     // 正向触发 -> "When to use this"
  | 'negative-prohibition' // 负向禁止 -> "When NOT to use this"
  | 'success-criteria'     // 成功标准 -> "Definition of done"
  | 'execution-flow'       // 执行流程 -> "What to build" 或 "Steps"
  | 'style-norm';          // 风格规范 -> "What to build"

interface ParsedConstraint {
  original: string;
  categories: ConstraintType[];  // 一条约束可匹配多分类
  targetSections: string[];      // 对应的 SKILL.md 章节名
  isAmbiguous: boolean;          // 无法明确分类时为 true
}
```

### 备注

- 采用关键词 + 结构规则的确定性分类，不调用 LLM
- 无法分类时 `isAmbiguous=true`，由上层提示用户补充信息
- 一条约束可能匹配多个分类（AC-005-7）
- 与 T-001 完全无依赖，可并行开发

---

## T-004 用例内容哈希与冲突检测器

```yaml
id: T-004
story_id: ST-003
title: 用例内容哈希与冲突检测器
owner_role: dev
status: done
depends_on: []
read_paths:
  - src/core/conflict-detector.ts
  - src/types/conflict.ts
  - src/types/test-case.ts
write_paths:
  - src/core/conflict-detector.ts
  - src/types/conflict.ts
  - tests/unit/core/conflict-detector.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/core/conflict-detector.test.ts
  - type: manual
    value: 验证 ST-003 AC-003-1, AC-003-2（custom 保护与哈希冲突检测）
```

### 目标

实现用例内容哈希计算和冲突检测能力，识别系统生成用例被用户手动修改的情况，为增量同步提供保护机制。

### 交付物

- `src/types/conflict.ts` — 定义 `ConflictInfo`、`ConflictResolution`（枚举: keep_user/override_system/manual_merge）
- `src/core/conflict-detector.ts` — 导出 `computeContentHash(testCase: TestCase): string` 和 `detectConflicts(currentCases: TestCase[], originalHashes: Map<string, string>): ConflictInfo[]`
- `tests/unit/core/conflict-detector.test.ts` — 覆盖哈希计算、冲突检测、无冲突等场景

### 接口契约

```typescript
type ConflictResolution = 'keep_user' | 'override_system' | 'manual_merge';

interface ConflictInfo {
  caseId: string;
  currentHash: string;
  originalHash: string;
  isConflict: boolean;
}

// 哈希算法: 对 prompt + pass_criteria 拼接后取 SHA-256
// custom=true 的用例始终跳过哈希对比
```

### 备注

- 哈希存储方案: 在 `.skill-snapshot.json` 中扩展 `caseHashes` 字段（`Record<string, string>`）
- 此机制确保用户手动修改的系统用例不会被静默覆盖
- 与 T-001、T-002、T-003 完全无依赖，可并行开发

---

## T-005 用例停用处理器

```yaml
id: T-005
story_id: ST-004
title: 用例停用处理器
owner_role: dev
status: done
depends_on: [T-001]
read_paths:
  - src/core/case-deprecator.ts
  - src/types/change.ts
  - src/types/test-case.ts
write_paths:
  - src/core/case-deprecator.ts
  - tests/unit/core/case-deprecator.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/core/case-deprecator.test.ts
  - type: manual
    value: 验证 ST-004 全部 AC（AC-004-1 ~ AC-004-5）
```

### 目标

当 "When to use this" 或 "When NOT to use this" 中某场景被删除时，将对应用例标记为 `deprecated=true`，不物理删除。

### 交付物

- `src/core/case-deprecator.ts` — 导出 `deprecateCases(cases: TestCase[], impacts: CaseImpact[]): DeprecationResult`
- `tests/unit/core/case-deprecator.test.ts` — 覆盖场景删除时停用对应用例、无停用、多场景删除等

### 接口契约

```typescript
interface DeprecationResult {
  deprecatedCaseIds: string[];
  remainingCases: TestCase[];  // 包含已标记 deprecated 的完整列表
}

// 停用逻辑:
// whenToUse 场景删除 -> 对应 implicit/context 用例 deprecated=true
// whenNotToUse 场景删除 -> 对应 negative 用例 deprecated=true
// 不物理删除，保留在 CSV 中
```

### 备注

- 依赖 T-001 的 `SectionChange` 类型来确定哪些场景被删除
- 停用后同步更新快照（由 T-006 编排）

---

## T-006 增量用例同步执行引擎

```yaml
id: T-006
story_id: ST-002
title: 增量用例同步执行引擎
owner_role: dev
status: todo
depends_on: [T-001, T-002, T-004, T-005]
read_paths:
  - src/core/sync-engine.ts
  - src/core/change-detector.ts
  - src/core/impact-mapper.ts
  - src/core/conflict-detector.ts
  - src/core/case-deprecator.ts
  - src/core/explicit-implicit-generator.ts
  - src/core/context-negative-generator.ts
  - src/io/csv-reader.ts
  - src/io/csv-writer.ts
  - src/io/snapshot-manager.ts
  - src/io/backup.ts
  - src/types/**/*.ts
write_paths:
  - src/core/sync-engine.ts
  - tests/integration/sync-engine.test.ts
verify:
  - type: command
    value: npx vitest run tests/integration/sync-engine.test.ts
  - type: manual
    value: 验证 ST-002 全部 AC（AC-002-1 ~ AC-002-7）
```

### 目标

编排变更检测、影响映射、冲突检测、用例调整（新增/修改/停用）、快照更新的完整增量同步流程。

### 交付物

- `src/core/sync-engine.ts` — 导出 `syncSkillCases(skillDir: string, options: SyncOptions): SyncResult`
- `tests/integration/sync-engine.test.ts` — 集成测试：端到端验证增量同步流程

### 接口契约

```typescript
interface SyncOptions {
  skipConflicts?: boolean;           // 跳过冲突用例
  conflictResolutions?: Map<string, ConflictResolution>;  // 冲突解决策略
}

interface SyncResult {
  added: number;
  modified: number;
  deprecated: number;
  conflicts: number;
  skipped: string[];      // 跳过的 Skill 名称（批量时使用）
}

function syncSkillCases(skillDir: string, options: SyncOptions): SyncResult;
// 流程: 变更检测 -> 影响映射 -> 冲突检测 -> 用例调整 -> 备份 -> CSV 写入 -> 快照更新
// 无变更时直接返回，不修改任何文件
// custom=true 用例始终跳过
```

### 备注

- 同步前自动备份到 `./evals/.backup/`
- 冲突用例在无 `conflictResolutions` 时暂停，由上层 CLI 交互处理
- 此任务是 FEAT-005 的核心编排层，汇聚所有基础设施

---

## T-007 约束驱动的 SKILL.md 更新与用例调整

```yaml
id: T-007
story_id: ST-006
title: 约束驱动的 SKILL.md 更新与用例调整
owner_role: dev
status: todo
depends_on: [T-003, T-006]
read_paths:
  - src/core/constraint-applier.ts
  - src/core/constraint-parser.ts
  - src/core/sync-engine.ts
  - src/io/backup.ts
  - src/types/constraint.ts
write_paths:
  - src/core/constraint-applier.ts
  - tests/unit/core/constraint-applier.test.ts
verify:
  - type: command
    value: npx vitest run tests/unit/core/constraint-applier.test.ts
  - type: manual
    value: 验证 ST-006 全部 AC（AC-006-1 ~ AC-006-9）
```

### 目标

实现约束到 SKILL.md 章节的写入和对应用例的自动调整（新增/修改），确保"有约束必有测试"。

### 交付物

- `src/core/constraint-applier.ts` — 导出 `applyConstraint(skillDir: string, constraintText: string): ConstraintApplyResult`
- `tests/unit/core/constraint-applier.test.ts` — 覆盖 5 种约束类型的落地效果

### 接口契约

```typescript
interface ConstraintApplyResult {
  writtenSections: string[];          // 写入了哪些 SKILL.md 章节
  addedCaseCount: number;
  modifiedCaseCount: number;
  snapshotUpdated: boolean;
}

// 流程:
// 1. 解析约束 -> ParsedConstraint
// 2. 备份 SKILL.md
// 3. 将约束追加到对应章节末尾
// 4. 基于约束类型生成/修改用例
// 5. 更新快照
```

### 备注

- 约束追加到章节末尾，不覆盖已有内容
- SKILL.md 更新前自动备份到 `.backup/`
- 正向触发约束 -> 至少 1 条隐式调用用例
- 负向禁止约束 -> 至少 1 条负例控制用例
- 成功标准约束 -> 更新所有正向用例 pass_criteria

---

## T-008 eval-sync 命令入口（单 Skill + --override）

```yaml
id: T-008
story_id: ST-002, ST-003, ST-007
title: eval-sync 命令入口（单 Skill + --override）
owner_role: dev
status: todo
depends_on: [T-006, T-007]
read_paths:
  - src/cli/commands/eval-sync.ts
  - src/core/sync-engine.ts
  - src/core/constraint-applier.ts
  - src/io/backup.ts
  - src/cli/utils/skill-finder.ts
write_paths:
  - src/cli/commands/eval-sync.ts
  - tests/integration/eval-sync.test.ts
verify:
  - type: command
    value: npx vitest run tests/integration/eval-sync.test.ts
  - type: manual
    value: 验证 ST-007 全部 AC（AC-007-1 ~ AC-007-6）及 ST-003 冲突交互
```

### 目标

实现 `quick-skill eval-sync [skill-name]` 命令，支持增量同步、`--override` 全量覆盖、`--constraint` 约束驱动三种模式。

### 交付物

- `src/cli/commands/eval-sync.ts` — 注册 `eval-sync` 命令，编排三种模式
- `tests/integration/eval-sync.test.ts` — 集成测试：覆盖增量、覆盖、约束三种模式

### 接口契约

```typescript
function registerEvalSyncCommand(program: Command): void;
// 参数:
//   skill-name (positional)
//   --override (flag)       全量覆盖模式
//   --constraint <text>     约束驱动模式
//   --all (flag)            批量模式（T-009）
```

### 备注

- `--override` 模式：全量重新生成 + 恢复 custom 用例 + 二次确认
- `--constraint` 模式：调用 T-007 的约束落地流程
- 默认模式（无额外参数）：调用 T-006 的增量同步流程
- 冲突时通过 inquirer.js 提供 3 种选项：保留用户版本/覆盖为系统版本/手动合并

---

## T-009 eval-sync --all 批量同步

```yaml
id: T-009
story_id: ST-008
title: eval-sync --all 批量同步
owner_role: dev
status: todo
depends_on: [T-008]
read_paths:
  - src/cli/commands/eval-sync.ts
  - src/cli/utils/skill-scanner.ts
  - src/core/sync-engine.ts
write_paths:
  - src/cli/commands/eval-sync.ts
  - tests/integration/eval-sync-batch.test.ts
verify:
  - type: command
    value: npx vitest run tests/integration/eval-sync-batch.test.ts
  - type: manual
    value: 验证 ST-008 全部 AC（AC-008-1 ~ AC-008-6）
```

### 目标

实现 `quick-skill eval-sync --all` 批量同步命令，扫描所有 Skill 并为存在变更的 Skill 执行增量同步。

### 交付物

- 修改 `src/cli/commands/eval-sync.ts` — 添加 `--all` 模式逻辑
- `tests/integration/eval-sync-batch.test.ts` — 验证批量扫描、跳过无变更、汇总输出

### 接口契约

复用 FEAT-004 的 `scanAllSkills()` 和 `findSkillDir()`。

### 备注

- 串行执行，不引入并发控制
- 单个 Skill 失败不阻塞其他
- 无变更的 Skill 跳过并列出
- 退出码 0（全部成功）或 1（存在失败）

---

## 并行分析

```
T-001 ──┬── T-002 ──┐
        └── T-005 ──┼── T-006 ──┬── T-007 ──┬── T-008 ── T-009
                     │           │            │
T-004 ───────────────┘           │            │
                                │            │
T-003 ──────────────────────────┘────────────┘
```

**可并行组**:
- 第一层: T-001、T-003、T-004（完全无依赖，可三人并行）
- 第二层: T-002、T-005（均只依赖 T-001，可并行）
- 第三层: T-006（汇聚 T-001/002/004/005 的输出）
- 第四层: T-007（依赖 T-003 + T-006）
- 第五层: T-008（汇聚 T-006 + T-007）
- 第六层: T-009（依赖 T-008）

## 跨 Feature 依赖声明

本 Feature 依赖 FEAT-004 的以下接口（只读引用）:

| 模块 | 路径 | 用途 |
|------|------|------|
| SkillAnchor 类型 | `src/types/skill.ts` | 变更检测输入 |
| TestCase 类型 | `src/types/test-case.ts` | 用例操作 |
| SkillSnapshot 类型 | `src/types/snapshot.ts` | 快照读取 |
| parseSkillMd | `src/core/skill-parser.ts` | 解析当前 SKILL.md |
| readSnapshot | `src/io/snapshot-manager.ts` | 读取快照 |
| generateSnapshot | `src/io/snapshot-manager.ts` | 更新快照 |
| readCasesFromCsv | `src/io/csv-reader.ts` | 读取当前用例 |
| writeCasesToCsv | `src/io/csv-writer.ts` | 写入调整后用例 |
| generateImplicitCases | `src/core/explicit-implicit-generator.ts` | 新增用例 |
| generateNegativeCases | `src/core/context-negative-generator.ts` | 新增负例 |
| backupFile | `src/io/backup.ts` | 备份保护 |
| findSkillDir | `src/cli/utils/skill-finder.ts` | Skill 查找 |
| scanAllSkills | `src/cli/utils/skill-scanner.ts` | 批量扫描 |

## 共享接口契约汇总

| 模块 | 文件 | 消费方 |
|------|------|--------|
| 变更类型 | `src/types/change.ts` | T-001 输出, T-002/T-005/T-006 消费 |
| 影响映射类型 | `src/types/impact.ts` | T-002 输出, T-005/T-006 消费 |
| 约束类型 | `src/types/constraint.ts` | T-003 输出, T-007 消费 |
| 冲突类型 | `src/types/conflict.ts` | T-004 输出, T-006 消费 |
| 同步引擎 | `src/core/sync-engine.ts` | T-006 输出, T-007/T-008/T-009 消费, FEAT-006 复用 |
| 约束应用器 | `src/core/constraint-applier.ts` | T-007 输出, T-008 消费 |
