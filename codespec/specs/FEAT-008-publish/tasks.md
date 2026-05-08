# 任务清单 -- FEAT-008 publish Skill源打包与npm发布

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|--------|------|--------|
| T-001 | ST-003 | SemVer版本号校验与冲突检查模块 | todo | - | dev |
| T-002 | ST-004 | 发布包文件边界控制与完整性校验 | todo | - | dev |
| T-003 | ST-001 | 发布内容组装与npm publish执行器 | todo | [T-001, T-002] | dev |
| T-004 | ST-002 | 发布前评测门禁集成 | todo | [T-003] | dev |
| T-005 | ST-001 | publish命令注册与完整发布流程串联 | todo | [T-003, T-004] | dev |

---

## T-001 SemVer版本号校验与冲突检查模块

```yaml
id: T-001
story_id: ST-003
title: SemVer版本号校验与冲突检查模块
owner_role: dev
status: todo
depends_on: []
read_paths:
  - package.json
write_paths:
  - src/services/version-validator.ts
verify:
  - type: command
    value: npm test -- --grep "version validator"
  - type: manual
    value: 有效SemVer格式通过校验；无效格式输出具体错误提示和期望格式；已存在同版本号时输出版本冲突提示
```

### 目标

实现语义化版本号格式校验和 npm 仓库版本冲突检查，作为发布流程的前置校验环节。

### 交付物

1. `src/services/version-validator.ts` -- 版本校验器
   - 导出 `validateSemVer(version: string): ValidationResult` 函数
     - 校验格式是否符合 MAJOR.MINOR.PATCH 规范
     - 使用正则表达式 `/^\d+\.\d+\.\d+$/` 校验
     - 返回 `{ valid: boolean; error?: string }`
     - 无效时 error 信息包含当前版本号和期望格式示例
   - 导出 `checkVersionConflict(packageName: string, version: string): Promise<ConflictResult>` 函数
     - 执行 `npm view <packageName>@<version> version` 检查仓库是否已存在同版本
     - 使用 `child_process.execSync` 调用 npm 命令
     - 网络不通或 npm 不可用时返回 `{ conflict: false; warning: string }`（降级处理）
     - 返回 `{ conflict: boolean; existingVersion?: string; warning?: string }`
   - 导出 `runVersionCheck(pkgJsonPath: string): Promise<VersionCheckResult>` 函数
     - 读取 package.json 提取 name 和 version
     - 依次执行格式校验和冲突检查
     - 汇总返回结果

### 接口契约

```typescript
// src/services/version-validator.ts
interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface ConflictResult {
  conflict: boolean;
  existingVersion?: string;
  warning?: string;
}

interface VersionCheckResult {
  packageName: string;
  version: string;
  formatValid: boolean;
  formatError?: string;
  conflictExists: boolean;
  conflictVersion?: string;
  networkWarning?: string;
  canPublish: boolean;
}

function validateSemVer(version: string): ValidationResult;
function checkVersionConflict(packageName: string, version: string): Promise<ConflictResult>;
function runVersionCheck(pkgJsonPath: string): Promise<VersionCheckResult>;
```

### 备注

- 不引入外部 SemVer 库，使用正则校验即可满足 MAJOR.MINOR.PATCH 格式
- npm view 命令依赖网络和 npm CLI，需处理超时和离线场景
- 此任务独立于文件边界控制，可并行开发
- 覆盖 ST-003 的 AC-1 到 AC-4

---

## T-002 发布包文件边界控制与完整性校验

```yaml
id: T-002
story_id: ST-004
title: 发布包文件边界控制与完整性校验
owner_role: dev
status: todo
depends_on: []
read_paths:
  - package.json
write_paths:
  - src/services/package-assembler.ts
verify:
  - type: command
    value: npm test -- --grep "package assembler"
  - type: manual
    value: 组装的发布包包含skills/、bin入口、package.json；不包含node_modules/、.git/、测试临时文件；缺少关键文件时报错
```

### 目标

定义发布包的文件包含/排除规则，实现发布内容的边界控制和完整性校验。

### 交付物

1. `src/services/package-assembler.ts` -- 包组装器
   - 导出 `INCLUDE_PATTERNS: string[]` 常量 -- 必须包含的文件模式
     - `'skills/**/*'` -- 完整 Skill 源（含所有分类子目录、SKILL.md、evals/）
     - `'dist/**/*'` 或 `'src/**/*'` -- CLI 可执行入口（根据构建配置）
     - `'package.json'` -- 包配置文件
     - `'README.md'` -- 说明文件
   - 导出 `EXCLUDE_PATTERNS: string[]` 常量 -- 必须排除的文件模式
     - `'node_modules/**'`
     - `'.git/**'`
     - `'*.test.*'`
     - `'.eslintrc*'`
     - `'tsconfig.*'`
     - `'codespec/**'` -- 规格文档不应进入发布包
     - `'.env*'`
   - 导出 `validatePackageIntegrity(projectRoot: string): IntegrityResult` 函数
     - 检查 skills/ 目录存在且非空
     - 检查 bin 入口文件存在
     - 检查 package.json 包含 bin 字段
     - 返回 `{ valid: boolean; missing: string[] }`
   - 导出 `assemblePublishFiles(projectRoot: string): FileManifest` 函数
     - 根据 INCLUDE_PATTERNS 扫描项目目录
     - 排除 EXCLUDE_PATTERNS 匹配的文件
     - 返回包含文件相对路径和绝对路径的清单

### 接口契约

```typescript
// src/services/package-assembler.ts
interface IntegrityResult {
  valid: boolean;
  missing: string[];
}

interface FileEntry {
  relativePath: string;
  absolutePath: string;
}

interface FileManifest {
  files: FileEntry[];
  totalSize: number;
}

function validatePackageIntegrity(projectRoot: string): IntegrityResult;
function assemblePublishFiles(projectRoot: string): FileManifest;
```

### 备注

- 此任务与 T-001 无依赖关系，可并行开发
- 完整性校验必须在发布前执行，作为不可跳过的安全网
- EXCLUDE_PATTERNS 需考虑 .npmignore 或 package.json files 字段的配合
- 覆盖 ST-004 的 AC-1 到 AC-4

---

## T-003 发布内容组装与npm publish执行器

```yaml
id: T-003
story_id: ST-001
title: 发布内容组装与npm publish执行器
owner_role: dev
status: todo
depends_on: [T-001, T-002]
read_paths:
  - src/services/version-validator.ts
  - src/services/package-assembler.ts
  - package.json
write_paths:
  - src/services/npm-publisher.ts
verify:
  - type: command
    value: npm test -- --grep "npm publisher"
  - type: manual
    value: dry-run模式下输出即将发布的包内容和版本号；实际发布模式执行npm publish并输出结果
```

### 目标

实现 npm publish 的执行层，包含内容组装、版本校验和发布执行的完整流程。

### 交付物

1. `src/services/npm-publisher.ts` -- npm 发布执行器
   - 导出 `publishToNpm(options: PublishOptions): Promise<PublishResult>` 函数
     - 先调用 `validatePackageIntegrity` 校验完整性
     - 再调用 `runVersionCheck` 校验版本号
     - 整校验均通过后，执行 `npm publish` 命令
     - 支持 `--dry-run` 模式：仅输出将要发布的内容清单，不实际执行
     - 支持 `--registry <url>` 参数：指定私有 registry URL
     - 返回发布结果
   - 导出 `PublishOptions` 接口：
     - `projectRoot: string`
     - `dryRun: boolean`
     - `registry?: string`
   - 导出 `PublishResult` 接口：
     - `success: boolean`
     - `packageName: string`
     - `version: string`
     - `publishedFiles: number`
     - `error?: string`
   - 使用 `child_process.execSync` 执行 `npm publish [--registry url] [--dry-run]`

### 接口契约

```typescript
// src/services/npm-publisher.ts
interface PublishOptions {
  projectRoot: string;
  dryRun: boolean;
  registry?: string;
}

interface PublishResult {
  success: boolean;
  packageName: string;
  version: string;
  publishedFiles: number;
  error?: string;
}

function publishToNpm(options: PublishOptions): Promise<PublishResult>;
```

### 备注

- 此任务依赖 T-001（版本校验）和 T-002（文件边界），是两者的编排层
- npm publish 命令本身处理认证（.npmrc token），本模块不管理认证
- 发布失败时返回错误信息但不自动回滚
- 覆盖 ST-001 的 AC-1 到 AC-4

---

## T-004 发布前评测门禁集成

```yaml
id: T-004
story_id: ST-002
title: 发布前评测门禁集成
owner_role: dev
status: todo
depends_on: [T-003]
read_paths:
  - src/services/npm-publisher.ts
write_paths:
  - src/services/eval-gate.ts
verify:
  - type: command
    value: npm test -- --grep "eval gate"
  - type: manual
    value: 门禁启用且评测通过时发布继续；评测失败时发布终止并输出摘要；--skip-eval跳过门禁时输出警告日志
```

### 目标

在发布流程中集成评测门禁，确保只有通过全量评测的 Skill 才能发布到 npm 仓库。

### 交付物

1. `src/services/eval-gate.ts` -- 评测门禁
   - 导出 `runEvalGate(options: EvalGateOptions): Promise<EvalGateResult>` 函数
     - 当 `skipEval` 为 false 时：
       - 执行 `quick-skill eval --all`（通过 `child_process.execSync` 调用）
       - 解析评测结果（退出码和输出）
       - 全部通过：返回 `{ passed: true }`
       - 存在失败：返回 `{ passed: false; summary: string; reportPath?: string }`
     - 当 `skipEval` 为 true 时：
       - 输出警告日志："评测门禁已跳过 --skip-eval，此操作已记录"
       - 返回 `{ passed: true; skipped: true }`
   - 导出 `EvalGateOptions` 接口：
     - `skipEval: boolean`
     - `projectRoot: string`
   - 导出 `EvalGateResult` 接口：
     - `passed: boolean`
     - `skipped?: boolean`
     - `summary?: string`
     - `reportPath?: string`

### 接口契约

```typescript
// src/services/eval-gate.ts
interface EvalGateOptions {
  skipEval: boolean;
  projectRoot: string;
}

interface EvalGateResult {
  passed: boolean;
  skipped?: boolean;
  summary?: string;
  reportPath?: string;
}

function runEvalGate(options: EvalGateOptions): Promise<EvalGateResult>;
```

### 备注

- 此任务依赖 FEAT-006 eval 模块提供 `quick-skill eval --all` 命令
- 若 FEAT-006 未就绪，评测门禁应降级为警告而非阻塞（通过 skipEval 默认值或检测命令是否可用）
- --skip-eval 的使用应在输出中明确记录，便于审计
- 覆盖 ST-002 的 AC-1 到 AC-4

---

## T-005 publish命令注册与完整发布流程串联

```yaml
id: T-005
story_id: ST-001
title: publish命令注册与完整发布流程串联
owner_role: dev
status: todo
depends_on: [T-003, T-004]
read_paths:
  - src/services/npm-publisher.ts
  - src/services/eval-gate.ts
  - src/services/version-validator.ts
  - src/services/package-assembler.ts
write_paths:
  - src/commands/publish.ts
  - src/cli.ts
verify:
  - type: command
    value: npm test -- --grep "publish command"
  - type: manual
    value: 执行 quick-skill publish 完成完整发布流程（dry-run）；评测门禁 -> 版本校验 -> 文件边界 -> npm publish 顺序正确执行
```

### 目标

注册 `quick-skill publish` 命令，串联评测门禁、版本校验、文件边界控制和发布执行的完整流程。

### 交付物

1. `src/commands/publish.ts` -- publish 命令处理器
   - 注册到 commander 程序
   - 支持命令行参数：
     - `--dry-run`：仅输出将要发布的内容，不实际执行
     - `--registry <url>`：指定私有 npm registry URL
     - `--skip-eval`：跳过评测门禁（需明确记录）
   - 执行流程（按顺序）：
     1. 调用 `runEvalGate` -- 评测门禁（可通过 --skip-eval 跳过）
     2. 调用 `runVersionCheck` -- 版本号校验
     3. 调用 `validatePackageIntegrity` -- 文件完整性校验
     4. 调用 `publishToNpm` -- 执行发布
   - 任意步骤失败则终止后续步骤并输出错误信息
   - 全部成功后输出发布摘要：包名、版本号、发布文件数

2. `src/cli.ts` -- 扩展 CLI 入口（如已存在则扩展）
   - 注册 `publish` 子命令

### 接口契约

```typescript
// src/commands/publish.ts
interface PublishCommandOptions {
  dryRun: boolean;
  registry?: string;
  skipEval: boolean;
}

function runPublish(options: PublishCommandOptions): Promise<void>;
```

### 备注

- 此任务是所有子模块的编排层，必须最后实现
- 流程顺序不可调换：评测门禁 -> 版本校验 -> 完整性校验 -> 发布
- 此任务修改 cli.ts，如与 FEAT-007 开发并行需注意冲突
- 覆盖 ST-001 的 AC-1 到 AC-4

---

## 接口契约汇总

### 跨模块共享类型

```typescript
// src/types/publish.ts (建议集中管理)
interface PublishOptions {
  projectRoot: string;
  dryRun: boolean;
  registry?: string;
}

interface PublishResult {
  success: boolean;
  packageName: string;
  version: string;
  publishedFiles: number;
  error?: string;
}

interface EvalGateOptions {
  skipEval: boolean;
  projectRoot: string;
}

interface EvalGateResult {
  passed: boolean;
  skipped?: boolean;
  summary?: string;
  reportPath?: string;
}

interface PublishCommandOptions {
  dryRun: boolean;
  registry?: string;
  skipEval: boolean;
}
```

### 模块间调用关系

```
cli.ts
  -> commands/publish.ts::runPublish()
       -> services/eval-gate.ts::runEvalGate()
       -> services/version-validator.ts::runVersionCheck()
       -> services/package-assembler.ts::validatePackageIntegrity()
       -> services/npm-publisher.ts::publishToNpm()
            -> services/version-validator.ts::runVersionCheck()
            -> services/package-assembler.ts::validatePackageIntegrity() / assemblePublishFiles()
```

## 并行性分析

```
T-001 (独立，无依赖)     T-002 (独立，无依赖)
  |                        |
  +--------+---------------+
           |
           v
         T-003 (依赖 T-001 + T-002)
           |
           v
         T-004 (依赖 T-003)
           |
           v
         T-005 (依赖 T-003 + T-004)

[T-001 和 T-002 可并行，写路径不重叠]
```

## 写路径冲突检查

| 任务 | 写路径 | 冲突 |
|------|--------|------|
| T-001 | src/services/version-validator.ts | 无 |
| T-002 | src/services/package-assembler.ts | 无 |
| T-003 | src/services/npm-publisher.ts | 无 |
| T-004 | src/services/eval-gate.ts | 无 |
| T-005 | src/commands/publish.ts, src/cli.ts | 与 FEAT-007 共享 cli.ts |

T-001 和 T-002 写路径完全不重叠，可并行。T-005 的 cli.ts 修改需与 FEAT-007 的 cli.ts 修改协调（同一文件，需合并）。

## 外部依赖说明

| 依赖项 | 来源 | 影响 |
|--------|------|------|
| FEAT-006 eval 模块 | FEAT-006 提供 `quick-skill eval --all` | T-004 评测门禁依赖此命令；若未就绪，门禁降级为警告 |
| npm CLI | 运行时环境 | T-001 版本冲突检查和 T-003 发布执行依赖 npm 命令可用 |
| .npmrc 配置 | 用户环境 | 私有仓库认证依赖 .npmrc 中的 token 配置 |
