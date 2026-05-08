---
id: FEAT-007
title: init -- 项目初始化与Skill平铺部署
type: feature
priority: P1
depends_on: []
---

# 提案

## 问题

- 用户安装 quick-skill 后，缺乏一键将 Skill 部署到目标 AI Agent 技能目录的手段，需要手动复制文件并维护目录结构
- CLI 内部 Skill 源按业务分类组织（公共、需求分析、UCD 等），但各 Agent 期望 Skill 平铺放置，存在结构映射差异
- 多次执行初始化时，用户已自定义的 Skill 容易被误删或覆盖，缺少安全的增量覆盖策略
- 支持 Claude、OpenCode、Relay 三种 Agent，每种 Agent 的技能目录路径不同，用户需要自行记忆和配置

## 目标

- 提供一条 `quick-skill init` 命令，通过交互式 Agent 选择，将 CLI 内部 skills/ 下所有 Skill 自动平铺部署到目标 Agent 的技能目录
- 剥离业务分类子目录层级，将每个 Skill 的完整内部结构 100% 保留并复制到目标目录
- 仅覆盖同名 Skill，严格保留其他 Skill 不受影响，确保增量安全
- 适配全局安装（直接调用）和局部安装（npx 调用）两种使用场景

## 范围内

- `quick-skill init` 命令的完整交互流程：Agent 单选（Claude/OpenCode/Relay）、无默认值、必须手动选择
- 根据所选 Agent 自动确定目标目录：Claude -> `./claude/skills`，OpenCode -> `./opencode/skills`，Relay -> `./.relay/skills`
- 目标目录不存在时递归创建
- 从 CLI 内部 `skills/` 下扫描所有分类子目录，将其直接子文件/子目录递归平铺复制到目标目录
- 同名 Skill 的覆盖逻辑：仅删除同名 Skill（文件或目录），然后安装新版本；其他 Skill 完整保留
- 用户未选择 Agent 直接退出时的终止提示
- 异常处理：无读写权限、Skill 源为空、复制失败、同名 Skill 删除失败等场景的终止或跳过逻辑
- 全局安装和局部安装两种调用方式的兼容

## 范围外

- Skill 列表查看能力（属于 FEAT-009）
- Skill 源增量更新（仅更新变更的 Skill）
- 自定义 Agent 目录路径配置
- 支持当前工作目录以外的目标路径
- Skill 版本管理或回滚
- Skill 安装前的评测门禁（属于 FEAT-006/FEAT-008 范畴）

## 风险

- CLI 发布包中 skills/ 目录为空或缺失时，init 命令无可用 Skill，需明确终止并给出维护者指引
- Windows/macOS/Linux 路径分隔符和权限模型差异，可能导致递归复制或目录创建行为不一致
- 同名 Skill 删除失败时选择跳过当前 Skill 而非终止全部，可能导致目标目录处于部分更新状态
- 交互式单选依赖终端能力，在 CI/CD 管道或非 TTY 环境中可能无法正常工作
- 大量 Skill 文件复制时无进度反馈，用户可能误判为命令卡死

## 待确认问题

- 是否需要支持 `--agent <name>` 非交互参数，以便在 CI/CD 等非 TTY 环境中直接指定 Agent？
- 同名 Skill 删除失败后选择跳过（保留旧版本）的策略是否可接受，还是应该终止整个安装流程？
- 是否需要在覆盖同名 Skill 前自动备份旧版本？
- CLI 发布包中 skills/ 目录的定位是编译时嵌入还是运行时解析？这影响 Skill 源路径的获取方式。
