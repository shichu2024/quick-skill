# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|------|------|--------|
| T-001 | ST-001 | SKILL.md 解析器 | done | 无 | dev |
| T-002 | ST-002 | 显式与隐式调用用例生成器 | done | T-001 | dev |
| T-003 | ST-002 | 上下文/噪声与负例用例生成器 | done | T-001 | dev |
| T-004 | ST-003 | CSV 读写器 | done | 无 | dev |
| T-005 | ST-003 | 快照管理器 | done | 无 | dev |
| T-006 | ST-004 | eval-gen 单 Skill 命令入口 | done | T-001, T-002, T-003, T-004, T-005 | dev |
| T-007 | ST-005 | 覆盖模式与备份保护 | done | T-006 | dev |
| T-008 | ST-006 | eval-gen --all 批量生成 | done | T-006 | dev |

---

## T-001 SKILL.md 解析器

```yaml
id: T-001
story_id: ST-001
title: SKILL.md 解析器
owner_role: dev
status: done
depends_on: []
```

### 目标

实现 SKILL.md 文件的解析引擎，从 YAML front matter 和 Markdown 章节中提取结构化锚点数据，供下游用例生成器消费。

### 交付物

- `src/types/skill.ts` — 定义 `SkillAnchor` 类型接口，包含 `name`、`description`、`whenToUse`、`whenNotToUse`、`definitionOfDone`、`whatToBuild` 字段
- `src/core/skill-parser.ts` — 导出 `parseSkillMd(filePath: string): SkillAnchor` 函数，实现 YAML front matter 解析和 5 个 Markdown 章节的提取
- `tests/unit/core/skill-parser.test.ts` — 覆盖正常解析、缺少必填章节、缺少可选章节、空文件等场景

### 接口契约

```typescript
interface SkillAnchor {
  name: string;
  description: string;
  whenToUse: string;
  whenNotToUse: string;
  definitionOfDone: string;
  whatToBuild: string;
}

function parseSkillMd(filePath: string): SkillAnchor;
// 缺少必填字段时抛出 SkillParseError（含缺失字段列表）
```

### 备注

- 必填字段：name、description、whenToUse、whenNotToUse
- 可选字段：definitionOfDone、whatToBuild（缺失时返回空字符串）
- 解析失败时抛出自定义 `SkillParseError`，包含缺失项列表，便于上层格式化输出
- T-002 和 T-003 并行依赖此模块，接口需先于实现稳定

---

## T-002 显式与隐式调用用例生成器

```yaml
id: T-002
story_id: ST-002
title: 显式与隐式调用用例生成器
owner_role: dev
status: done
depends_on: [T-001]
```

### 目标

基于 `SkillAnchor` 生成显式调用用例（2-3 条）和隐式调用用例（3-4 条），均标记 `should_trigger=true`。

### 交付物

- `src/types/test-case.ts` — 定义 `TestCase` 类型：`id`、`should_trigger`、`prompt`、`pass_criteria`、`custom`、`deprecated`
- `src/core/explicit-implicit-generator.ts` — 导出 `generateExplicitCases(anchor: SkillAnchor): TestCase[]` 和 `generateImplicitCases(anchor: SkillAnchor): TestCase[]`
- `tests/unit/core/explicit-implicit-generator.test.ts` — 验证用例数量、字段完整性、prompt 内容特征

### 接口契约

```typescript
interface TestCase {
  id: string;            // 格式: {skill-name}-{type}-{序号}
  should_trigger: boolean;
  prompt: string;
  pass_criteria: string;  // 分号分隔的判定标准
  custom: boolean;        // 初始生成一律 false
  deprecated: boolean;    // 初始生成一律 false
}
```

### 备注

- 显式调用用例 prompt 包含 `$+技能名` 格式
- 隐式调用用例 prompt 使用自然语言描述场景，不提及技能名
- pass_criteria 来源于 `definitionOfDone`，无此字段时使用默认判定标准
- id 生成规则需与 T-003 协调一致，确保全局唯一

---

## T-003 上下文/噪声与负例用例生成器

```yaml
id: T-003
story_id: ST-002
title: 上下文/噪声与负例用例生成器
owner_role: dev
status: done
depends_on: [T-001]
```

### 目标

基于 `SkillAnchor` 生成上下文/噪声调用用例（3-4 条，`should_trigger=true`）和负例控制用例（3-4 条，`should_trigger=false`）。

### 交付物

- `src/core/context-negative-generator.ts` — 导出 `generateContextCases(anchor: SkillAnchor): TestCase[]` 和 `generateNegativeCases(anchor: SkillAnchor): TestCase[]`
- `tests/unit/core/context-negative-generator.test.ts` — 验证数量、字段完整性、prompt 特征（上下文噪声、负例关键词重叠）

### 接口契约

与 T-002 共享 `TestCase` 类型定义（定义于 `src/types/test-case.ts`，T-002 已创建）。

### 备注

- 上下文用例在核心需求基础上附加业务上下文或无关细节
- 负例用例基于 `whenNotToUse` 生成关键词重叠但需求不符的场景
- 负例用例的 pass_criteria 包含 "Skill 不应被触发" 判定标准
- 与 T-002 可并行开发，但需协调 id 命名规则避免冲突

---

## T-004 CSV 读写器

```yaml
id: T-004
story_id: ST-003
title: CSV 读写器
owner_role: dev
status: done
depends_on: []
```

### 目标

实现 TestCase CSV 文件的读写能力，处理逗号、换行、双引号转义，为 T-006 提供持久化基础设施。

### 交付物

- `src/io/csv-reader.ts` — 导出 `readCasesFromCsv(filePath: string): TestCase[]`
- `src/io/csv-writer.ts` — 导出 `writeCasesToCsv(filePath: string, cases: TestCase[]): void`
- `tests/unit/io/csv-reader.test.ts` — 覆盖正常读取、含转义字符、空文件、格式错误等场景
- `tests/unit/io/csv-writer.test.ts` — 覆盖正常写入、含特殊字符字段、目录不存在自动创建等场景

### 接口契约

```typescript
function readCasesFromCsv(filePath: string): TestCase[];
// 文件不存在时抛出 FileNotFoundError
// 格式错误时跳过问题行并收集警告

function writeCasesToCsv(filePath: string, cases: TestCase[]): void;
// 目标目录不存在时自动递归创建
// 表头: id,should_trigger,prompt,pass_criteria,custom,deprecated
```

### 备注

- CSV 表头固定为: `id,should_trigger,prompt,pass_criteria,custom,deprecated`
- prompt 和 pass_criteria 可能包含逗号和换行，必须正确转义
- 此模块被 FEAT-005 和 FEAT-006 复用，接口需稳定
- 与 T-001、T-002、T-003 完全无依赖，可并行开发

---

## T-005 快照管理器

```yaml
id: T-005
story_id: ST-003
title: 快照管理器
owner_role: dev
status: done
depends_on: []
```

### 目标

实现 `.skill-snapshot.json` 的生成与读取能力，记录 SKILL.md 完整文本和 SHA-256 版本哈希。

### 交付物

- `src/types/snapshot.ts` — 定义 `SkillSnapshot` 类型：`content`、`hash`、`timestamp`
- `src/io/snapshot-manager.ts` — 导出 `generateSnapshot(skillMdPath: string, outputDir: string): SkillSnapshot` 和 `readSnapshot(snapshotPath: string): SkillSnapshot | null`
- `tests/unit/io/snapshot-manager.test.ts` — 覆盖生成、读取、哈希校验、文件不存在等场景

### 接口契约

```typescript
interface SkillSnapshot {
  content: string;    // SKILL.md 完整文本
  hash: string;       // SHA-256 全文哈希（十六进制）
  timestamp: string;  // ISO 8601 时间戳
}

function generateSnapshot(skillMdPath: string, outputDir: string): SkillSnapshot;
// 输出到 {outputDir}/.skill-snapshot.json

function readSnapshot(snapshotPath: string): SkillSnapshot | null;
// 文件不存在返回 null
```

### 备注

- 哈希算法为全文 SHA-256（十六进制）
- 此模块被 FEAT-005 的变更检测直接依赖，接口需稳定
- 与 T-001、T-002、T-003、T-004 完全无依赖，可并行开发

---

## T-006 eval-gen 单 Skill 命令入口

```yaml
id: T-006
story_id: ST-004
title: eval-gen 单 Skill 命令入口
owner_role: dev
status: done
depends_on: [T-001, T-002, T-003, T-004, T-005]
```

### 目标

实现 `quick-skill eval-gen [skill-name]` 命令，串联解析、生成、输出、快照的完整流程。

### 交付物

- `src/cli/utils/skill-finder.ts` — 导出 `findSkillDir(skillName: string): string | null`，在 `./skills/` 所有子目录中查找匹配的 Skill
- `src/cli/commands/eval-gen.ts` — 注册 `eval-gen` 命令，编排完整流程
- `tests/integration/eval-gen.test.ts` — 集成测试：端到端验证用例文件和快照生成

### 接口契约

```typescript
// Skill 查找工具
function findSkillDir(skillName: string): string | null;
// 在 ./skills/ 下所有业务分类子目录中精确匹配
// 找到返回目录绝对路径，未找到返回 null

// 命令注册（commander.js 风格）
function registerEvalGenCommand(program: Command): void;
// 参数: skill-name (positional), --override (flag)
```

### 备注

- 命令注册使用 commander.js
- 已有用例文件且未指定 `--override` 时，跳过并提示
- 执行成功返回退出码 0，失败返回非 0
- 此任务完成后，FEAT-004 的核心功能可端到端运行

---

## T-007 覆盖模式与备份保护

```yaml
id: T-007
story_id: ST-005
title: 覆盖模式与备份保护
owner_role: dev
status: done
depends_on: [T-006]
```

### 目标

实现 `--override` 覆盖模式，包括自动备份、二次确认交互、备份文件时间戳命名。

### 交付物

- `src/io/backup.ts` — 导出 `backupFile(filePath: string, backupDir: string): string`，返回备份文件路径
- 修改 `src/cli/commands/eval-gen.ts` — 添加 `--override` 分支逻辑和确认交互
- `tests/unit/io/backup.test.ts` — 验证备份文件创建、时间戳命名、custom 用例保留

### 接口契约

```typescript
function backupFile(filePath: string, backupDir: string): string;
// 将 filePath 备份到 backupDir，文件名附加时间戳
// 返回备份文件的完整路径
// backupDir 不存在时自动创建
```

### 备注

- 备份目录为 `./evals/.backup/`
- 备份文件名格式: `{原文件名}.{YYYYMMDD-HHmmss}.bak`
- 覆盖前通过 inquirer.js 弹出 y/N 确认
- 用户拒绝时不修改任何文件

---

## T-008 eval-gen --all 批量生成

```yaml
id: T-008
story_id: ST-006
title: eval-gen --all 批量生成
owner_role: dev
status: done
depends_on: [T-006]
```

### 目标

实现 `quick-skill eval-gen --all` 批量生成命令，扫描所有 Skill 并为尚未生成用例的 Skill 执行完整流程。

### 交付物

- 修改 `src/cli/commands/eval-gen.ts` — 添加 `--all` 模式逻辑
- 新增 `src/cli/utils/skill-scanner.ts` — 导出 `scanAllSkills(): SkillScanResult[]`
- `tests/integration/eval-gen-batch.test.ts` — 验证批量扫描、跳过已有、汇总输出

### 接口契约

```typescript
interface SkillScanResult {
  name: string;
  category: string;
  dirPath: string;
  hasExistingCases: boolean;
}

function scanAllSkills(): SkillScanResult[];
// 扫描 ./skills/ 下所有子目录
```

### 备注

- 串行执行，不引入并发控制
- 跳过已有用例且未指定 `--override` 的 Skill
- 单个 Skill 失败不阻塞其他
- 退出码 0（全部成功）或 1（存在失败）

---

## 并行分析

```
T-001 ───┬── T-002 ──┐
          │           ├── T-006 ── T-007
          └── T-003 ──┘       └── T-008

T-004 ────────────────┘
T-005 ────────────────┘
```

**可并行组**:
- 第一层: T-001、T-004、T-005（完全无依赖，可三人并行）
- 第二层: T-002、T-003（均只依赖 T-001，可并行）
- 第三层: T-006（汇聚点，需等 T-001~T-005 全部完成）
- 第四层: T-007、T-008（均只依赖 T-006，可并行）

## 共享接口契约汇总

| 模块 | 文件 | 消费方 |
|------|------|--------|
| SkillAnchor 类型 | `src/types/skill.ts` | T-001 输出, T-002/T-003 消费 |
| TestCase 类型 | `src/types/test-case.ts` | T-002 输出, T-003/T-004/T-006 消费 |
| SkillSnapshot 类型 | `src/types/snapshot.ts` | T-005 输出, T-006 消费 |
| CSV 读写 | `src/io/csv-*.ts` | T-004 输出, T-006/T-007 消费, FEAT-005/006 复用 |
| 快照管理 | `src/io/snapshot-manager.ts` | T-005 输出, T-006 消费, FEAT-005 复用 |
| SKILL.md 解析 | `src/core/skill-parser.ts` | T-001 输出, T-002/T-003/T-006 消费, FEAT-005 复用 |
