# 任务清单 -- FEAT-007 init 项目初始化与Skill平铺部署

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|--------|------|--------|
| T-001 | ST-005 | Agent目录映射与Skill源路径定位模块 | done | - | dev |
| T-002 | ST-001 | init命令注册与交互式Agent选择流程 | done | [T-001] | dev |
| T-003 | ST-002 | Skill源扫描与平铺复制引擎 | done | [T-001] | dev |
| T-004 | ST-003 | 同名Skill安全覆盖逻辑 | done | [T-003] | dev |
| T-005 | ST-004 | 异常处理与安全终止层 | done | [T-002, T-003] | dev |
| T-006 | ST-004 | 成功/失败汇总输出与退出码 | done | [T-005] | dev |
| T-005 | ST-004 | 异常处理与安全终止层 | todo | [T-002, T-003] | dev |
| T-006 | ST-004 | 成功/失败汇总输出与退出码 | todo | [T-005] | dev |

---

## T-001 Agent目录映射与Skill源路径定位模块

```yaml
id: T-001
story_id: ST-005
title: Agent目录映射与Skill源路径定位模块
owner_role: dev
status: done
depends_on: []
read_paths:
  - src/**
  - package.json
write_paths:
  - src/constants/agents.ts
  - src/utils/paths.ts
verify:
  - type: command
    value: npm test -- --grep "agent directory mapping"
  - type: command
    value: npm test -- --grep "skill source path resolution"
  - type: manual
    value: 全局安装场景下 skillSourcePath 返回正确的 skills/ 路径；局部安装场景（npx）同样返回正确路径
```

### 目标

建立 Agent 名称到目标目录的映射表，以及 CLI 内部 skills/ 源路径的定位逻辑，适配全局安装和局部安装两种场景。

### 交付物

1. `src/constants/agents.ts` -- Agent 映射配置
   - 导出 `AgentName` 类型（`'claude' | 'opencode' | 'relay'`）
   - 导出 `AGENT_DIRECTORY_MAP: Record<AgentName, string>` 常量：
     - claude -> `./claude/skills`
     - opencode -> `./opencode/skills`
     - relay -> `./.relay/skills`
   - 导出 `SUPPORTED_AGENTS: AgentName[]` 数组
   - 导出 `getAgentTargetDir(agent: AgentName): string` 纯函数

2. `src/utils/paths.ts` -- 路径定位工具
   - 导出 `getSkillSourcePath(): string` 函数
     - 使用 `import.meta.url` 或 `__dirname` 定位当前 CLI 安装根目录
     - 拼接 `skills/` 子目录并返回绝对路径
     - 必须兼容全局安装（`/usr/local/lib/node_modules/quick-skill/skills/`）和局部安装（`./node_modules/quick-skill/skills/`）
   - 导出 `resolveAgentSkillDir(agent: AgentName): string` 函数
     - 调用 `getAgentTargetDir` 获取相对路径
     - 转换为绝对路径（基于 `process.cwd()`）

### 接口契约

```typescript
// src/constants/agents.ts
type AgentName = 'claude' | 'opencode' | 'relay';
const AGENT_DIRECTORY_MAP: Record<AgentName, string>;
const SUPPORTED_AGENTS: AgentName[];
function getAgentTargetDir(agent: AgentName): string;

// src/utils/paths.ts
function getSkillSourcePath(): string;
function resolveAgentSkillDir(agent: AgentName): string;
```

### 备注

- 此任务是所有后续任务的基础，无外部依赖
- 路径定位必须使用 `path.resolve()` 确保跨平台兼容（Windows/macOS/Linux）
- 不引入任何外部依赖

---

## T-002 init命令注册与交互式Agent选择流程

```yaml
id: T-002
story_id: ST-001
title: init命令注册与交互式Agent选择流程
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/constants/agents.ts
  - src/utils/paths.ts
write_paths:
  - src/commands/init.ts
  - src/cli.ts
verify:
  - type: command
    value: npm test -- --grep "init command"
  - type: manual
    value: 执行 quick-skill init 显示三选项单选框，无默认选中项；选择 Agent 后正确输出目标目录路径；未选择退出时输出取消提示
```

### 目标

注册 `quick-skill init` 命令，实现交互式 Agent 单选框选择流程，确定目标部署目录。

### 交付物

1. `src/cli.ts` -- CLI 入口（如已存在则扩展）
   - 注册 `init` 子命令到 commander 程序
   - 委托到 `src/commands/init.ts` 执行

2. `src/commands/init.ts` -- init 命令处理器
   - 使用 inquirer.js 实现 `list` 类型单选框
     - 选项：Claude、OpenCode、Relay
     - 无默认选中项
     - 选项值为 `AgentName` 类型
   - 用户选择后，调用 `getAgentTargetDir` 和 `resolveAgentSkillDir` 确认目标路径
   - 目标目录不存在时，使用 `fs.mkdirSync(dir, { recursive: true })` 递归创建
   - 用户未选择直接退出（Ctrl+C 或 ESC）时，输出 "未选择目标Agent，初始化已取消" 并以退出码 0 正常退出
   - 返回选定的 `AgentName` 和目标目录绝对路径供后续流程使用

### 接口契约

```typescript
// src/commands/init.ts
interface InitResult {
  agent: AgentName;
  targetDir: string;
}

function runInit(): Promise<InitResult | null>;
// 返回 null 表示用户取消
```

### 备注

- 交互式依赖 inquirer.js，需在 package.json 中添加依赖
- 此任务仅负责命令注册和交互选择，不负责实际的 Skill 复制
- 递归创建目录成功后应输出确认信息
- 覆盖 ST-001 的 AC-1 到 AC-6

---

## T-003 Skill源扫描与平铺复制引擎

```yaml
id: T-003
story_id: ST-002
title: Skill源扫描与平铺复制引擎
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/constants/agents.ts
  - src/utils/paths.ts
  - skills/**/*
write_paths:
  - src/services/skill-scanner.ts
  - src/services/skill-deployer.ts
verify:
  - type: command
    value: npm test -- --grep "skill scanner"
  - type: command
    value: npm test -- --grep "skill deployer"
  - type: manual
    value: 在测试目录下执行部署，验证所有分类子目录下的 Skill 被平铺复制到目标目录，内部结构完整保留，无分类子目录层级
```

### 目标

实现从 CLI 内部 skills/ 目录扫描所有 Skill 并平铺复制到目标 Agent 目录的核心逻辑。

### 交付物

1. `src/services/skill-scanner.ts` -- Skill 源扫描器
   - 导出 `scanSkills(sourcePath: string): SkillEntry[]` 函数
     - 读取 `sourcePath` 下的所有分类子目录（公共、需求分析、UCD 等）
     - 遍历每个分类子目录，收集其直接子目录作为 Skill 目录
     - 返回 `SkillEntry[]`，每项包含：
       - `name: string` -- Skill 目录名称
       - `sourcePath: string` -- Skill 完整源路径（绝对路径）
       - `category: string` -- 所属分类名称
   - 源路径为空或不存在时抛出明确错误（`SkillSourceEmptyError`）
   - 源路径存在但无分类子目录时同样抛出 `SkillSourceEmptyError`

2. `src/services/skill-deployer.ts` -- Skill 部署器
   - 导出 `deploySkills(entries: SkillEntry[], targetDir: string): DeployResult` 函数
     - 逐个将 SkillEntry 复制到 targetDir
     - 使用 `fs.cp(src, dest, { recursive: true })` 递归复制，保留完整内部结构（SKILL.md、evals/、资源文件等）
     - 目标路径为 `{targetDir}/{skillName}`
     - 返回 `DeployResult`：`{ deployed: string[], skipped: string[], errors: DeployError[] }`
   - 纯粹的复制逻辑，不处理同名覆盖（由 T-004 负责）

### 接口契约

```typescript
// src/services/skill-scanner.ts
interface SkillEntry {
  name: string;
  sourcePath: string;
  category: string;
}
class SkillSourceEmptyError extends Error {}
function scanSkills(sourcePath: string): SkillEntry[];

// src/services/skill-deployer.ts
interface DeployError {
  skillName: string;
  reason: string;
  originalError?: Error;
}
interface DeployResult {
  deployed: string[];
  skipped: string[];
  errors: DeployError[];
}
function deploySkills(entries: SkillEntry[], targetDir: string): Promise<DeployResult>;
```

### 备注

- 扫描器仅扫描直接子目录作为 Skill，不支持嵌套 Skill 目录
- 复制操作必须保持文件权限和符号链接
- 此任务不处理同名 Skill 的覆盖逻辑，deploySkills 遇到同名目录时的行为未定义（由 T-004 包装调用）
- 覆盖 ST-002 的 AC-1 到 AC-4

---

## T-004 同名Skill安全覆盖逻辑

```yaml
id: T-004
story_id: ST-003
title: 同名Skill安全覆盖逻辑
owner_role: dev
status: todo
depends_on: [T-003]
read_paths:
  - src/services/skill-scanner.ts
  - src/services/skill-deployer.ts
write_paths:
  - src/services/skill-overwriter.ts
verify:
  - type: command
    value: npm test -- --grep "skill overwriter"
  - type: manual
    value: 目标目录已存在同名 Skill 时，先删除旧版本再复制新版本；非同名 Skill 完整保留；删除失败时跳过当前 Skill 并输出提示
```

### 目标

实现同名 Skill 的安全覆盖策略：仅删除同名 Skill，保留其他 Skill 不受影响。

### 交付物

1. `src/services/skill-overwriter.ts` -- 同名覆盖处理器
   - 导出 `overwriteSkill(skillName: string, targetDir: string): OverwriteResult` 函数
     - 检查 `{targetDir}/{skillName}` 是否存在
     - 存在时：先调用 `fs.rm(targetPath, { recursive: true, force: true })` 删除
     - 不存在时：跳过删除步骤
     - 删除失败时：返回 `{ skipped: true, reason: string }`，不抛出异常
     - 返回 `OverwriteResult`：`{ overwritten: boolean; skipped: boolean; reason?: string }`
   - 导出 `deployWithOverwrite(entries: SkillEntry[], targetDir: string): Promise<DeployResult>` 函数
     - 对每个 SkillEntry 先调用 `overwriteSkill` 清理同名项
     - 跳过的 Skill 不进行后续复制
     - 未跳过的 Skill 调用 `deploySkills`（来自 T-003）完成复制
     - 返回汇总结果

### 接口契约

```typescript
// src/services/skill-overwriter.ts
interface OverwriteResult {
  overwritten: boolean;
  skipped: boolean;
  reason?: string;
}
function overwriteSkill(skillName: string, targetDir: string): Promise<OverwriteResult>;
function deployWithOverwrite(entries: SkillEntry[], targetDir: string): Promise<DeployResult>;
```

### 备注

- 此任务是对 T-003 deploySkills 的上层封装，添加同名处理逻辑
- 关键安全约束：仅操作与待安装 Skill 同名的文件/目录，其他文件/目录完全不受影响
- 删除失败时选择跳过而非终止，可能导致目标目录处于部分更新状态（已知风险，proposal 中已记录）
- 覆盖 ST-003 的 AC-1 到 AC-4

---

## T-005 异常处理与安全终止层

```yaml
id: T-005
story_id: ST-004
title: 异常处理与安全终止层
owner_role: dev
status: todo
depends_on: [T-002, T-003]
read_paths:
  - src/commands/init.ts
  - src/services/skill-scanner.ts
  - src/services/skill-deployer.ts
  - src/services/skill-overwriter.ts
write_paths:
  - src/commands/init.ts
  - src/utils/errors.ts
verify:
  - type: command
    value: npm test -- --grep "error handling"
  - type: manual
    value: 权限不足时终止并输出提示；Skill源为空时终止并输出提示；复制IO错误时终止并输出提示；Ctrl+C中断时干净退出
```

### 目标

在 init 命令主流程中集成统一的异常处理层，确保所有异常场景下的安全终止和明确提示。

### 交付物

1. `src/utils/errors.ts` -- 统一错误类型定义
   - `InitError` 基类（含 `code` 和 `userMessage` 属性）
   - `PermissionError` -- 权限不足
   - `SkillSourceEmptyError` -- Skill 源为空
   - `DeployIoError` -- 复制失败
   - `UserCancelledError` -- 用户取消
   - 每种错误类型携带面向用户的提示信息

2. `src/commands/init.ts` -- 扩展 init 命令主流程
   - 在 `runInit` 函数中集成 try/catch 异常处理
   - 捕获 `PermissionError`：输出权限问题提示，退出码 1
   - 捕获 `SkillSourceEmptyError`：输出 "CLI内部Skill源为空" 提示，退出码 1
   - 捕获 `DeployIoError`：输出具体错误原因提示，退出码 1
   - 捕获 `UserCancelledError`：输出取消提示，退出码 0
   - 注册 `process.on('SIGINT')` 处理 Ctrl+C：干净退出，不残留不完整安装
   - 未捕获异常：输出通用错误提示，退出码 1

### 接口契约

```typescript
// src/utils/errors.ts
class InitError extends Error {
  code: string;
  userMessage: string;
}
class PermissionError extends InitError {}
class SkillSourceEmptyError extends InitError {}
class DeployIoError extends InitError {}
class UserCancelledError extends InitError {}
```

### 备注

- 此任务修改 T-002 的 `init.ts` 文件，需注意与 T-002 的写路径冲突，建议 T-002 完成后再执行
- 异常处理层不负责重试或回滚
- 覆盖 ST-004 的 AC-1 到 AC-4

---

## T-006 成功/失败汇总输出与退出码

```yaml
id: T-006
story_id: ST-004
title: 成功/失败汇总输出与退出码
owner_role: dev
status: todo
depends_on: [T-005]
read_paths:
  - src/commands/init.ts
  - src/services/skill-overwriter.ts
write_paths:
  - src/commands/init.ts
  - src/utils/reporter.ts
verify:
  - type: command
    value: npm test -- --grep "init reporter"
  - type: manual
    value: 正常安装完成后输出成功提示、目标目录路径和已安装Skill数量；存在跳过时输出跳过列表；退出码正确
```

### 目标

在 init 命令完成时输出清晰的汇总报告，包含成功数、跳过数、失败数和目标目录路径。

### 交付物

1. `src/utils/reporter.ts` -- 结果报告器
   - 导出 `formatDeployReport(result: DeployResult, targetDir: string): string` 函数
     - 格式化成功提示，包含目标目录绝对路径和已安装 Skill 数量
     - 如有跳过的 Skill，列出名称和跳过原因
     - 如有错误的 Skill，列出名称和错误原因
   - 导出 `printDeployReport(result: DeployResult, targetDir: string): void` 函数
     - 调用 formatDeployReport 并 console.log 输出

2. `src/commands/init.ts` -- 集成报告输出
   - 在 deployWithOverwrite 返回结果后调用 `printDeployReport`
   - 根据结果设置退出码：
     - 全部成功：退出码 0
     - 部分成功：退出码 0（跳过项已在报告中说明）
     - 全部失败：退出码 1

### 接口契约

```typescript
// src/utils/reporter.ts
function formatDeployReport(result: DeployResult, targetDir: string): string;
function printDeployReport(result: DeployResult, targetDir: string): void;
```

### 备注

- 此任务依赖 T-005 完成后的 init.ts 主流程结构
- 报告格式应简洁清晰，适合终端输出
- 覆盖 ST-004 的 AC-4

---

## 接口契约汇总

### 跨模块共享类型

```typescript
// src/types/init.ts (建议集中管理)
interface SkillEntry {
  name: string;
  sourcePath: string;
  category: string;
}

interface DeployError {
  skillName: string;
  reason: string;
  originalError?: Error;
}

interface DeployResult {
  deployed: string[];
  skipped: string[];
  errors: DeployError[];
}

interface OverwriteResult {
  overwritten: boolean;
  skipped: boolean;
  reason?: string;
}

interface InitResult {
  agent: AgentName;
  targetDir: string;
}
```

### 模块间调用关系

```
cli.ts
  -> commands/init.ts::runInit()
       -> constants/agents.ts::getAgentTargetDir()
       -> utils/paths.ts::getSkillSourcePath() / resolveAgentSkillDir()
       -> services/skill-scanner.ts::scanSkills()
       -> services/skill-overwriter.ts::deployWithOverwrite()
            -> services/skill-overwriter.ts::overwriteSkill()
            -> services/skill-deployer.ts::deploySkills()
       -> utils/reporter.ts::printDeployReport()
       -> utils/errors.ts (异常捕获)
```

## 并行性分析

```
T-001 (独立，无依赖)
  |
  +---> T-002 (依赖 T-001)
  |       |
  |       +---> T-005 (依赖 T-002 + T-003)
  |               |
  |               +---> T-006 (依赖 T-005)
  |
  +---> T-003 (依赖 T-001)
  |       |
  |       +---> T-004 (依赖 T-003)
  |               |
  |               +---> T-005 (依赖 T-002 + T-003)
  |
  [T-002 和 T-003 可并行，写路径不重叠]
```

## 写路径冲突检查

| 任务 | 写路径 | 冲突 |
|------|--------|------|
| T-001 | src/constants/agents.ts, src/utils/paths.ts | 无 |
| T-002 | src/commands/init.ts, src/cli.ts | 无 |
| T-003 | src/services/skill-scanner.ts, src/services/skill-deployer.ts | 无 |
| T-004 | src/services/skill-overwriter.ts | 无 |
| T-005 | src/commands/init.ts (修改), src/utils/errors.ts | 与 T-002 共享 init.ts |
| T-006 | src/commands/init.ts (修改), src/utils/reporter.ts | 与 T-005 共享 init.ts |

T-002 和 T-003 写路径不重叠，可并行。T-005 和 T-006 修改 init.ts，必须串行执行。
