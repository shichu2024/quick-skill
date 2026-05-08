# 用户故事

## 索引

| ID | 标题 | 优先级 | 状态 | 依赖 |
|----|-------|----------|--------|------|
| ST-001 | 选择目标 Agent 并初始化项目 | P1 | ready | - |
| ST-002 | 将全部 Skill 平铺部署到目标 Agent 目录 | P1 | ready | ST-001 |
| ST-003 | 安全覆盖同名 Skill 并保留其他 Skill | P1 | ready | ST-002 |
| ST-004 | 异常场景下的安全终止与用户提示 | P1 | ready | ST-001 |
| ST-005 | 兼容全局安装与局部安装两种调用方式 | P1 | ready | - |

## ST-001 选择目标 Agent 并初始化项目

```yaml
id: ST-001
title: 选择目标 Agent 并初始化项目
priority: P1
status: ready
depends_on: []
```

### 故事

作为 quick-skill 用户，我希望在执行 `quick-skill init` 时通过交互式单选框选择目标 AI Agent（Claude/OpenCode/Relay），以便命令根据我的选择自动确定技能部署目录。

### 验收标准

- `AC-1`: Given 用户执行 `quick-skill init`，When 命令进入交互阶段，Then 终端显示包含 Claude、OpenCode、Relay 三个选项的单选框，无默认选中项
- `AC-2`: Given 用户选择 Claude，When 命令继续执行，Then 目标目录确认为当前工作目录下的 `./claude/skills`
- `AC-3`: Given 用户选择 OpenCode，When 命令继续执行，Then 目标目录确认为当前工作目录下的 `./opencode/skills`
- `AC-4`: Given 用户选择 Relay，When 命令继续执行，Then 目标目录确认为当前工作目录下的 `./.relay/skills`
- `AC-5`: Given 目标目录不存在，When 命令确认目标路径后，Then 自动递归创建所有父目录和目标目录
- `AC-6`: Given 用户未选择 Agent 直接退出交互，When 交互被中断，Then 命令终止执行并输出"未选择目标Agent，初始化已取消"提示

### 范围外

- 非交互模式（命令行参数直接指定 Agent）
- 自定义目标目录路径
- Agent 选项的扩展注册机制

---

## ST-002 将全部 Skill 平铺部署到目标 Agent 目录

```yaml
id: ST-002
title: 将全部 Skill 平铺部署到目标 Agent 目录
priority: P1
status: ready
depends_on: [ST-001]
```

### 故事

作为 quick-skill 用户，我希望 init 命令将 CLI 内部 skills/ 下所有业务分类子目录中的 Skill 全部平铺复制到目标 Agent 的技能目录，以便目标 Agent 能直接发现和使用这些 Skill。

### 验收标准

- `AC-1`: Given CLI 内部 skills/ 下存在多个分类子目录（如公共、需求分析、UCD），When 执行 Skill 安装，Then 所有分类子目录下的直接子目录（即各 Skill 目录）均被识别并纳入安装范围
- `AC-2`: Given 一个 Skill 目录包含 SKILL.md、evals/ 子目录及其他文件，When 该 Skill 被复制到目标目录，Then Skill 内部的完整目录层级和所有文件 100% 保留，不做任何修改
- `AC-3`: Given 安装完成后，When 检查目标 Agent 目录，Then 所有 Skill 目录直接位于 Agent 技能目录下（无业务分类子目录层级）
- `AC-4`: Given CLI 内部 skills/ 目录为空或不存在，When 命令启动安装流程，Then 终止执行并输出"CLI内部Skill源为空"的错误提示

### 范围外

- 增量更新（仅复制变更的 Skill）
- 安装过程中的进度展示
- Skill 安装前的合规性检查或评测

---

## ST-003 安全覆盖同名 Skill 并保留其他 Skill

```yaml
id: ST-003
title: 安全覆盖同名 Skill 并保留其他 Skill
priority: P1
status: ready
depends_on: [ST-002]
```

### 故事

作为 quick-skill 用户，我希望重复执行 init 命令时，仅自动覆盖同名 Skill，其他我手动添加或自定义的 Skill 完整保留不受影响，以便我可以安全地在同一项目中反复初始化而不丢失自定义内容。

### 验收标准

- `AC-1`: Given 目标 Agent 目录下已存在与待安装 Skill 同名的文件或目录，When 执行该 Skill 的安装，Then 先删除同名 Skill（文件或目录），再将新版本完整复制到目标目录
- `AC-2`: Given 目标 Agent 目录下存在与待安装 Skill 不同名的其他 Skill，When 执行全部 Skill 安装，Then 这些非同名 Skill 完整保留，文件内容和目录结构不受任何影响
- `AC-3`: Given 待安装 Skill 在目标目录下不存在同名项，When 执行该 Skill 的安装，Then 直接复制到目标目录，无需执行删除操作
- `AC-4`: Given 同名 Skill 删除操作失败，When 命令检测到删除失败，Then 跳过当前 Skill 的安装，输出删除失败的提示，继续安装其余 Skill，已安装的其他 Skill 不受影响

### 范围外

- 覆盖前的自动备份机制
- 覆盖前的用户确认交互
- Skill 版本对比或变更日志

---

## ST-004 异常场景下的安全终止与用户提示

```yaml
id: ST-004
title: 异常场景下的安全终止与用户提示
priority: P1
status: ready
depends_on: [ST-001]
```

### 故事

作为 quick-skill 用户，我希望在 init 命令执行过程中遇到异常（权限不足、Skill 源为空、复制失败等）时，命令能够安全终止并给出明确的错误提示，以便我能快速定位问题并采取对应措施。

### 验收标准

- `AC-1`: Given 当前工作目录无读写权限，When 命令尝试创建或写入目标目录，Then 终止执行并输出包含权限问题的错误提示
- `AC-2`: Given Skill 文件复制过程中发生 IO 错误，When 复制操作失败，Then 终止执行并输出包含具体错误原因的失败提示
- `AC-3`: Given 用户通过 Ctrl+C 或其他方式中断交互，When 交互被中断，Then 命令终止执行，不残留不完整的安装结果
- `AC-4`: Given 命令正常完成所有 Skill 安装，When 安装流程结束，Then 输出成功提示，明确告知安装的目标目录路径和已安装的 Skill 数量

### 范围外

- 异常场景的自动恢复或重试机制
- 部分失败时的回滚能力
- 异常日志的持久化记录

---

## ST-005 兼容全局安装与局部安装两种调用方式

```yaml
id: ST-005
title: 兼容全局安装与局部安装两种调用方式
priority: P1
status: ready
depends_on: []
```

### 故事

作为 quick-skill 用户，我希望无论通过全局安装（`npm i quick-skill -g` 后直接调用 `quick-skill init`）还是局部安装（`npm i quick-skill -D` 后通过 `npx quick-skill init` 调用），init 命令均能正常工作并正确定位 CLI 内部的 Skill 源目录。

### 验收标准

- `AC-1`: Given quick-skill 已全局安装，When 用户在任意工作目录执行 `quick-skill init`，Then 命令正常启动交互流程，能正确读取 CLI 内部 skills/ 目录的 Skill 源
- `AC-2`: Given quick-skill 已局部安装为项目依赖，When 用户在项目目录执行 `npx quick-skill init`，Then 命令正常启动交互流程，能正确读取 CLI 内部 skills/ 目录的 Skill 源
- `AC-3`: Given 两种安装方式，When 命令执行 Skill 部署，Then 部署行为和结果完全一致（目标目录规则、平铺规则、覆盖规则均相同）

### 范围外

- 其他包管理器（pnpm、yarn）的特定兼容处理
- CI/CD 环境中的非交互调用
- 多版本共存的版本选择机制
