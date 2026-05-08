# 用户故事

## 索引

| ID | 标题 | 优先级 | 状态 | 依赖 |
|----|-------|----------|--------|------|
| ST-001 | 查看 CLI 内部所有 Skill 列表（按分类展示） | P3 | ready | - |
| ST-002 | 查看指定 Agent 已部署的 Skill 列表 | P3 | ready | ST-001 |
| ST-003 | 查看单个 Skill 的详细信息 | P3 | ready | - |

## ST-001 查看 CLI 内部所有 Skill 列表（按分类展示）

```yaml
id: ST-001
title: 查看 CLI 内部所有 Skill 列表（按分类展示）
priority: P3
status: ready
depends_on: []
```

### 故事

作为 quick-skill 用户，我希望通过 `quick-skill list` 命令查看 CLI 内部 skills/ 目录下所有可用的 Skill，并按业务分类分组展示，以便我了解当前 CLI 包含哪些 Skill 及其组织结构。

### 验收标准

- `AC-1`: Given 用户执行 `quick-skill list`，When 命令扫描 CLI 内部 skills/ 目录，Then 列出所有分类子目录及其下属的 Skill 目录名称
- `AC-2`: Given skills/ 下存在"公共"、"需求分析"、"UCD"等多个分类子目录，When 列表输出，Then 按分类分组展示，每个分组下展示该分类包含的 Skill 名称列表
- `AC-3`: Given 某个分类子目录下没有 Skill 目录，When 列表输出，Then 该分类在列表中标注为空或跳过不展示
- `AC-4`: Given skills/ 目录为空或不存在，When 执行 `quick-skill list`，Then 输出提示信息告知无可用 Skill

### 范围外

- 列表结果的持久化存储或导出
- 远程 Skill 仓库的列表查询
- Skill 源增量更新

---

## ST-002 查看指定 Agent 已部署的 Skill 列表

```yaml
id: ST-002
title: 查看指定 Agent 已部署的 Skill 列表
priority: P3
status: ready
depends_on: [ST-001]
```

### 故事

作为 quick-skill 用户，我希望通过 `quick-skill list --agent <name>` 查看指定 Agent（Claude/OpenCode/Relay）技能目录下已部署的 Skill 列表，以便我确认 init 命令的部署结果或了解当前 Agent 的技能配置。

### 验收标准

- `AC-1`: Given 用户执行 `quick-skill list --agent Claude`，When 命令扫描 `./claude/skills` 目录，Then 列出该目录下所有已部署的 Skill 名称
- `AC-2`: Given 用户执行 `quick-skill list --agent OpenCode`，When 命令扫描 `./opencode/skills` 目录，Then 列出该目录下所有已部署的 Skill 名称
- `AC-3`: Given 用户执行 `quick-skill list --agent Relay`，When 命令扫描 `./.relay/skills` 目录，Then 列出该目录下所有已部署的 Skill 名称
- `AC-4`: Given 指定 Agent 的技能目录不存在或为空，When 执行命令，Then 输出提示信息告知该 Agent 目录下无已部署的 Skill
- `AC-5`: Given 用户指定了不支持的 Agent 名称，When 执行命令，Then 输出错误提示并列出支持的 Agent 名称（Claude、OpenCode、Relay）

### 范围外

- 自定义 Agent 目录路径
- Agent 目录下 Skill 的详细内容对比（与 CLI 内部 Skill 源的差异）
- Skill 部署时间或版本信息

---

## ST-003 查看单个 Skill 的详细信息

```yaml
id: ST-003
title: 查看单个 Skill 的详细信息
priority: P3
status: ready
depends_on: []
```

### 故事

作为 quick-skill 用户，我希望通过 `quick-skill list <skill-name>` 查看指定 Skill 的详细信息（名称、描述、分类、版本、评测状态），以便我快速了解该 Skill 的定位和能力边界。

### 验收标准

- `AC-1`: Given 用户执行 `quick-skill list <skill-name>` 且该 Skill 存在于 CLI 内部 skills/ 目录，When 命令解析该 Skill 的 SKILL.md，Then 输出该 Skill 的名称、描述、所属分类
- `AC-2`: Given Skill 的 SKILL.md 包含完整的元数据和边界定义，When 查看详情，Then 输出包含"When to use this"和"When NOT to use this"的关键信息摘要
- `AC-3`: Given 指定名称的 Skill 在 CLI 内部 skills/ 所有分类子目录中均不存在，When 执行命令，Then 输出 Skill 不存在的提示
- `AC-4`: Given 同一 Skill 名称在多个分类子目录中存在，When 执行命令，Then 列出所有匹配项及其各自所属的分类

### 范围外

- Skill 评测状态的实时查询（依赖 FEAT-006 的评测结果数据）
- Skill 版本信息的展示（依赖版本信息来源的确定）
- Skill 内容的编辑或修改
