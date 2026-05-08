# 任务清单 -- FEAT-009 list Skill列表查看与管理

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|--------|------|--------|
| T-001 | ST-001 | CLI内部Skill扫描与分类展示服务 | todo | - | dev |
| T-002 | ST-002 | Agent目录Skill扫描服务 | todo | - | dev |
| T-003 | ST-003 | SKILL.md解析器与Skill详情展示 | todo | - | dev |
| T-004 | ST-001, ST-002, ST-003 | list命令注册与输出格式化 | todo | [T-001, T-002, T-003] | dev |

---

## T-001 CLI内部Skill扫描与分类展示服务

```yaml
id: T-001
story_id: ST-001
title: CLI内部Skill扫描与分类展示服务
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/constants/agents.ts
  - src/utils/paths.ts
write_paths:
  - src/services/skill-lister.ts
verify:
  - type: command
    value: npm test -- --grep "skill lister"
  - type: manual
    value: 执行扫描后按分类分组展示所有Skill名称；空分类标注为空或跳过；skills/为空时输出提示
```

### 目标

实现 CLI 内部 skills/ 目录的扫描能力，按业务分类分组收集所有 Skill，为 list 命令提供数据源。

### 交付物

1. `src/services/skill-lister.ts` -- Skill 列表服务
   - 导出 `listInternalSkills(): CategoryList` 函数
     - 调用 `getSkillSourcePath()`（来自 FEAT-007 T-001）获取 skills/ 源路径
     - 读取 skills/ 下所有分类子目录
     - 对每个分类子目录，收集其直接子目录作为该分类下的 Skill 列表
     - 返回 `CategoryList`：`CategoryGroup[]`
   - 导出 `CategoryGroup` 接口：
     - `category: string` -- 分类名称
     - `skills: SkillSummary[]` -- 该分类下的 Skill 列表
   - 导出 `SkillSummary` 接口：
     - `name: string` -- Skill 目录名称
     - `path: string` -- Skill 完整路径
   - skills/ 不存在时返回空数组并标记错误
   - 分类子目录下无 Skill 时，该分类 skills 为空数组

### 接口契约

```typescript
// src/services/skill-lister.ts
interface SkillSummary {
  name: string;
  path: string;
}

interface CategoryGroup {
  category: string;
  skills: SkillSummary[];
}

type CategoryList = CategoryGroup[];

function listInternalSkills(): CategoryList;
```

### 备注

- 此任务可复用 FEAT-007 T-003 中 `scanSkills` 的扫描逻辑，但返回结构不同（按分类分组 vs. 平铺列表）
- 若 FEAT-007 T-001 的 `getSkillSourcePath` 未就绪，可临时使用硬编码路径用于开发测试
- 此任务与 T-002、T-003 无依赖关系，可并行开发
- 覆盖 ST-001 的 AC-1 到 AC-4

---

## T-002 Agent目录Skill扫描服务

```yaml
id: T-002
story_id: ST-002
title: Agent目录Skill扫描服务
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/constants/agents.ts
  - src/utils/paths.ts
write_paths:
  - src/services/agent-skill-lister.ts
verify:
  - type: command
    value: npm test -- --grep "agent skill lister"
  - type: manual
    value: 指定Claude/OpenCode/Relay后正确列出对应目录下的Skill；目录不存在或为空时输出提示；不支持的Agent名称时输出错误
```

### 目标

实现指定 Agent 目标目录的 Skill 扫描能力，列出已部署的 Skill 列表。

### 交付物

1. `src/services/agent-skill-lister.ts` -- Agent Skill 列表服务
   - 导出 `listAgentSkills(agent: AgentName): AgentSkillListResult` 函数
     - 调用 `resolveAgentSkillDir(agent)`（来自 FEAT-007 T-001）获取目标目录
     - 扫描目标目录下的所有直接子目录作为已部署的 Skill
     - 返回 `AgentSkillListResult`：
       - `agent: AgentName`
       - `targetDir: string`
       - `skills: string[]` -- Skill 名称列表
       - `empty: boolean` -- 目录为空或不存在
   - 导出 `validateAgentName(name: string): AgentName | null` 函数
     - 检查名称是否为支持的 Agent（claude/opencode/relay，不区分大小写）
     - 有效时返回对应的 `AgentName`
     - 无效时返回 null
   - 目录不存在时返回 `{ agent, targetDir, skills: [], empty: true }`，不抛异常

### 接口契约

```typescript
// src/services/agent-skill-lister.ts
interface AgentSkillListResult {
  agent: AgentName;
  targetDir: string;
  skills: string[];
  empty: boolean;
}

function listAgentSkills(agent: AgentName): AgentSkillListResult;
function validateAgentName(name: string): AgentName | null;
```

### 备注

- 此任务依赖 FEAT-007 T-001 的 Agent 映射和路径解析工具
- 若 FEAT-007 T-001 未就绪，可临时内联 Agent 映射常量用于开发测试
- 此任务与 T-001、T-003 无依赖关系，可并行开发
- 覆盖 ST-002 的 AC-1 到 AC-5

---

## T-003 SKILL.md解析器与Skill详情展示

```yaml
id: T-003
story_id: ST-003
title: SKILL.md解析器与Skill详情展示
owner_role: dev
status: todo
depends_on: []
read_paths:
  - skills/**/SKILL.md
write_paths:
  - src/services/skill-detail-parser.ts
verify:
  - type: command
    value: npm test -- --grep "skill detail parser"
  - type: manual
    value: 解析SKILL.md输出名称、描述、分类、When to use/When NOT to use信息；Skill不存在时输出提示；同名Skill在多分类中存在时列出所有匹配项
```

### 目标

实现 SKILL.md 文件的解析能力，提取 Skill 的元数据和关键信息摘要。

### 交付物

1. `src/services/skill-detail-parser.ts` -- Skill 详情解析器
   - 导出 `parseSkillDetail(skillName: string): SkillDetailResult` 函数
     - 在 skills/ 所有分类子目录中搜索名为 `skillName` 的子目录
     - 找到后读取并解析其 `SKILL.md` 文件
     - 提取以下信息：
       - `name: string` -- Skill 名称
       - `description: string` -- 摘要描述（取 SKILL.md 开头段落）
       - `category: string` -- 所属分类
       - `whenToUse: string` -- "When to use" 段落内容
       - `whenNotToUse: string` -- "When NOT to use" 段落内容
     - 同名 Skill 存在于多个分类时，返回所有匹配项
   - 导出 `parseSkillMd(filePath: string): SkillMetaData` 函数
     - 解析单个 SKILL.md 文件
     - 提取 YAML front matter（如有）中的元数据
     - 提取 markdown 正文中的关键段落
   - 导出 `findSkillByName(skillName: string): SkillLocation[]` 函数
     - 在 skills/ 所有分类中搜索指定名称的 Skill
     - 返回所有匹配项的位置信息

### 接口契约

```typescript
// src/services/skill-detail-parser.ts
interface SkillMetaData {
  name: string;
  description: string;
  whenToUse: string;
  whenNotToUse: string;
  rawContent: string;
}

interface SkillLocation {
  name: string;
  category: string;
  skillDir: string;
  skillMdPath: string;
}

interface SkillDetailEntry {
  location: SkillLocation;
  meta: SkillMetaData;
}

interface SkillDetailResult {
  found: boolean;
  entries: SkillDetailEntry[];
}
```

### 备注

- 此任务可考虑复用 FEAT-001（skill-diagnose）或 FEAT-002（skill-transform）中已有的 SKILL.md 解析逻辑
- 若无已有解析器，此任务需实现基础的 markdown 段落提取（不引入 markdown 解析库，使用正则匹配即可）
- 此任务与 T-001、T-002 无依赖关系，可并行开发
- 覆盖 ST-003 的 AC-1 到 AC-4

---

## T-004 list命令注册与输出格式化

```yaml
id: T-004
story_id: ST-001, ST-002, ST-003
title: list命令注册与输出格式化
owner_role: dev
status: todo
depends_on: [T-001, T-002, T-003]
read_paths:
  - src/services/skill-lister.ts
  - src/services/agent-skill-lister.ts
  - src/services/skill-detail-parser.ts
write_paths:
  - src/commands/list.ts
  - src/utils/list-formatter.ts
  - src/cli.ts
verify:
  - type: command
    value: npm test -- --grep "list command"
  - type: manual
    value: quick-skill list按分类展示内部Skill列表；quick-skill list --agent Claude展示已部署Skill；quick-skill list <skill-name>展示Skill详情
```

### 目标

注册 `quick-skill list` 命令，整合扫描和解析服务，提供格式化的终端输出。

### 交付物

1. `src/utils/list-formatter.ts` -- 列表格式化工具
   - 导出 `formatCategoryList(list: CategoryList): string` 函数
     - 按分类分组格式化输出
     - 每个分类标题后列出 Skill 名称
     - 空分类标注 "(empty)" 或跳过
   - 导出 `formatAgentSkillList(result: AgentSkillListResult): string` 函数
     - 格式化 Agent 部署的 Skill 列表
     - 包含 Agent 名称、目标目录路径和 Skill 列表
     - 空目录时输出友好提示
   - 导出 `formatSkillDetail(result: SkillDetailResult): string` 函数
     - 格式化 Skill 详情输出
     - 包含名称、描述、分类、When to use、When NOT to use
     - 多分类匹配时分别展示
     - 未找到时输出提示

2. `src/commands/list.ts` -- list 命令处理器
   - 注册到 commander 程序
   - 支持命令形式：
     - `quick-skill list` -- 列出 CLI 内部所有 Skill（按分类展示）
     - `quick-skill list --agent <name>` -- 列出指定 Agent 已部署的 Skill
     - `quick-skill list <skill-name>` -- 查看指定 Skill 详情
   - `--agent` 参数值通过 `validateAgentName` 校验
   - 不支持的 Agent 名称时输出错误提示并列出支持的 Agent 名称
   - 调用对应的服务函数获取数据
   - 调用格式化工具输出结果

3. `src/cli.ts` -- 扩展 CLI 入口（如已存在则扩展）
   - 注册 `list` 子命令
   - 支持位置参数 `<skill-name>` 和选项 `--agent <name>`

### 接口契约

```typescript
// src/commands/list.ts
interface ListCommandOptions {
  agent?: string;
}

function runList(skillName?: string, options?: ListCommandOptions): Promise<void>;

// src/utils/list-formatter.ts
function formatCategoryList(list: CategoryList): string;
function formatAgentSkillList(result: AgentSkillListResult): string;
function formatSkillDetail(result: SkillDetailResult): string;
```

### 备注

- 此任务是 T-001、T-002、T-003 的编排层，必须在三者完成后实现
- 输出格式应简洁清晰，适合终端阅读
- 此任务修改 cli.ts，如与 FEAT-007/FEAT-008 并行开发需注意合并
- 覆盖 ST-001 的 AC-1 到 AC-4、ST-002 的 AC-1 到 AC-5、ST-003 的 AC-1 到 AC-4

---

## 接口契约汇总

### 跨模块共享类型

```typescript
// src/types/list.ts (建议集中管理)
interface SkillSummary {
  name: string;
  path: string;
}

interface CategoryGroup {
  category: string;
  skills: SkillSummary[];
}

type CategoryList = CategoryGroup[];

interface AgentSkillListResult {
  agent: AgentName;
  targetDir: string;
  skills: string[];
  empty: boolean;
}

interface SkillMetaData {
  name: string;
  description: string;
  whenToUse: string;
  whenNotToUse: string;
  rawContent: string;
}

interface SkillLocation {
  name: string;
  category: string;
  skillDir: string;
  skillMdPath: string;
}

interface SkillDetailEntry {
  location: SkillLocation;
  meta: SkillMetaData;
}

interface SkillDetailResult {
  found: boolean;
  entries: SkillDetailEntry[];
}
```

### 模块间调用关系

```
cli.ts
  -> commands/list.ts::runList()
       |  (no args, no --agent)
       -> services/skill-lister.ts::listInternalSkills()
       -> utils/list-formatter.ts::formatCategoryList()
       |
       |  (--agent <name>)
       -> services/agent-skill-lister.ts::validateAgentName()
       -> services/agent-skill-lister.ts::listAgentSkills()
       -> utils/list-formatter.ts::formatAgentSkillList()
       |
       |  (<skill-name>)
       -> services/skill-detail-parser.ts::parseSkillDetail()
       -> utils/list-formatter.ts::formatSkillDetail()
```

## 并行性分析

```
T-001 (独立)     T-002 (独立)     T-003 (独立)
  |                 |                 |
  +--------+--------+--------+--------+
           |
           v
         T-004 (依赖 T-001 + T-002 + T-003)

[T-001、T-002、T-003 三者可完全并行，写路径不重叠]
```

## 写路径冲突检查

| 任务 | 写路径 | 冲突 |
|------|--------|------|
| T-001 | src/services/skill-lister.ts | 无 |
| T-002 | src/services/agent-skill-lister.ts | 无 |
| T-003 | src/services/skill-detail-parser.ts | 无 |
| T-004 | src/commands/list.ts, src/utils/list-formatter.ts, src/cli.ts | 与 FEAT-007/FEAT-008 共享 cli.ts |

T-001、T-002、T-003 写路径完全不重叠，可并行。T-004 的 cli.ts 修改需与 FEAT-007/FEAT-008 协调合并。

## 扩展预留设计

以下接口和结构为后续扩展预留，v1 实现中不需要完成但需保持可扩展性：

1. **Skill 源增量更新** -- `listInternalSkills` 的返回结构 `SkillSummary` 已预留 `path` 字段，可用于增量比对
2. **自定义 Agent 目录配置** -- `validateAgentName` 和 `listAgentSkills` 接受 `AgentName` 参数，后续可扩展为从配置文件读取自定义映射
3. **列表结果导出** -- `list-formatter.ts` 中的格式化函数返回 string，后续可添加 `--json` 参数直接输出结构化数据
4. **Skill 评测状态** -- `SkillMetaData` 结构可后续扩展 `evalStatus` 字段，从 FEAT-006 的评测结果中获取

## 外部依赖说明

| 依赖项 | 来源 | 影响 |
|--------|------|------|
| FEAT-007 T-001 | `getSkillSourcePath`、`resolveAgentSkillDir`、Agent 映射常量 | T-001 和 T-002 依赖路径定位和 Agent 映射；若未就绪需临时内联 |
| SKILL.md 格式约定 | Skill 编写规范 | T-003 解析器依赖 SKILL.md 的段落结构约定 |
