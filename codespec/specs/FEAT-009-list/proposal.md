---
id: FEAT-009
title: list -- Skill列表查看与管理
type: feature
priority: P3
depends_on: []
---

# 提案

## 问题

- 用户安装 quick-skill 后，缺乏直观的手段查看 CLI 内置了哪些 Skill、各 Skill 属于哪个业务分类、当前评测状态如何
- 用户执行 init 部署后，无法快速确认目标 Agent 目录下已部署了哪些 Skill
- 缺少 Skill 详情查询能力（名称、描述、分类、版本、评测状态），用户需要手动查看 SKILL.md 文件获取信息
- 随着后续 Skill 数量增长和功能扩展，缺少统一的 Skill 管理视图入口

## 目标

- 提供一条 `quick-skill list` 命令，支持查看 CLI 内部所有 Skill 列表（按分类展示）和指定 Agent 已部署的 Skill 列表
- 支持查看单个 Skill 的详情（名称、描述、分类、版本、评测状态）
- 为后续扩展（Skill 源增量更新、自定义 Agent 目录配置）预留接口

## 范围内

- `quick-skill list` 命令：查看 CLI 内部 skills/ 目录下所有 Skill，按业务分类分组展示
- `quick-skill list --agent <name>` 命令：查看指定 Agent（Claude/OpenCode/Relay）已部署目录下的 Skill 列表
- `quick-skill list <skill-name>` 命令：查看指定 Skill 的详情，包括名称、描述、分类、版本、评测状态
- Skill 列表的格式化输出（终端表格或结构化文本）
- 扩展预留：命令接口设计需考虑后续 Skill 源增量更新、自定义 Agent 目录配置的扩展空间

## 范围外

- Skill 源增量更新功能
- 自定义 Agent 目录路径配置
- Skill 的创建、修改、删除操作
- 列表结果的持久化存储或导出
- 远程 Skill 仓库的列表查询

## 风险

- 作为 P3 优先级的扩展预留模块，功能范围可能随需求演进扩大，需警惕范围蔓延
- Skill 评测状态的展示依赖 FEAT-006 eval 模块的评测结果数据，若 FEAT-006 未就绪，评测状态字段可能无法提供
- Skill 版本信息的来源尚不明确（SKILL.md 元数据？package.json？独立版本文件？）

## 待确认问题

- Skill 版本信息应从哪里获取？SKILL.md 的 YAML front matter 中是否有 version 字段？还是从 package.json 统一管理？
- Skill 评测状态是指最近一次评测的结果摘要吗？是否需要依赖 FEAT-006 的持久化存储数据？
- 列表输出格式是否有明确偏好（表格、JSON、纯文本）？是否需要支持 `--json` 参数以供程序化消费？
- "扩展预留"的颗粒度如何界定？是否需要在 v1 中就设计好插件式的命令扩展机制，还是仅在文档层面预留？
