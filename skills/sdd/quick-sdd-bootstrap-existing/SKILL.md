---
name: quick-sdd-bootstrap-existing
description: 为一个已经存在、但还没有完整 quick-sdd 规格工作区的项目初始化 `AGENT.md` 和 `codespec/`，盘点现有功能、技术栈、模块边界与架构约束，并输出可直接衔接后续 Quick SDD 流程的 baseline proposal、stories、tasks、validation 文档。当需要把存量项目接入 SDD、把现有系统反向整理成规格文档，或为后续需求开发补齐现状基线时使用。
---

# Quick SDD Bootstrap Existing

你负责把一个已经存在的项目接入 Quick SDD。

你的目标不是发明新需求，而是把现有项目的功能、架构和边界反向整理成后续可续跑的 baseline SDD 文档。

## 先读

- `references/bootstrap-existing-project.md`
- 项目根目录 `README`、包管理文件和主配置文件
- 入口文件、路由、控制器、页面、服务层、数据模型、测试目录
- 如已存在：`AGENT.md`、`codespec/README.md`、`codespec/runtime/state.json`
- `../quick-sdd/templates/`

## 安装依赖

- 这个 skill 依赖同仓安装的 `quick-sdd`
- repo-path 安装时，推荐至少安装 `quick-sdd + quick-sdd-bootstrap-existing`

## 何时使用

- 项目已有代码，但还没有 `codespec/`
- 项目已有 `codespec/`，但缺少现状 baseline 文档
- 在开始新需求前，需要先把现有系统整理成 SDD 基线

## 工作步骤

1. 判断项目是否已有 `codespec/`；若没有，优先运行 `../quick-sdd/scripts/init_codespec.py --repo-root <项目根目录>`
2. 首轮扫描技术栈、构建方式、入口点、目录边界、核心模块和外部依赖
3. 从代码和 README 中提炼当前已存在的用户能力，不把猜测写进 baseline
4. 更新 `AGENT.md` 和 `codespec/README.md`，补齐项目目标、模块地图、关键约束和 baseline feature 索引
5. 按能力域或关键用户旅程拆 feature
6. 对每个 feature 生成 `proposal.md` 和 `stories.md`
7. 若当前没有明确开发请求，`tasks.md` 和 `validation-report.md` 用 baseline 占位方式初始化
8. 将 `state.json` 调整为可续跑状态，默认交回 `pm`

## 要吸收的优秀实践

- 反向建档时区分 `observed / inferred / open_questions`
- 不要只根据目录结构机械命名 feature，要结合真实用户能力和模块职责
- 基线完成前也要做 gate check：后续 `quick-sdd` 和 `quick-sdd-pm` 必须能无缝续跑
- 不要把“未来想做的能力”写成“现有系统已经提供的能力”

## 输出要求

- `AGENT.md`
- `codespec/README.md`
- 至少 1 个 feature 目录，包含：
  - `proposal.md`
  - `stories.md`
  - `tasks.md`
  - `validation-report.md`
- `codespec/runtime/state.json` 保持为可续跑状态

## 输出格式

```yaml
status:
decision:
root_cause_type:
reroute_to:
reroute_action:
summary:
updated_artifacts: []
evidence: []
concerns: []
next_action:
```

## 禁止事项

- 不要把猜测中的功能写成已存在能力
- 不要覆盖用户已有的 `codespec/` 产物；优先补充和对齐
- 不要把架构分析写成大而空的概念图，必须落回当前仓库中的模块和边界
