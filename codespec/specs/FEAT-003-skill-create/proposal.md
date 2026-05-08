---
id: FEAT-003
title: skill-create -- 集成 Anthropic skill-creator
type: feature
priority: P1
depends_on: []
---

# 提案

## 问题

1. **从零创建 Skill 缺乏引导**：开发者需要创建符合 Anthropic 官方规范的新 Skill，但不熟悉 SKILL.md 的标准格式和必要章节，容易遗漏关键字段。
2. **已有 Skill 编辑体验差**：修改已有 Skill 时需要手动定位和编辑 SKILL.md 的各个章节，缺乏结构化的交互式编辑引导。
3. **创建与用例生成割裂**：Skill 创建完成后，测试用例的生成需要额外手动触发 eval-gen，无法在创建流程中自然衔接。
4. **规范遵从度低**：手动编写的 SKILL.md 容易偏离 Anthropic 官方规范格式，导致后续评测和部署异常。

## 目标

集成 Anthropic 官方 skill-creator 能力，提供交互式 Skill 创建与编辑体验，引导用户从零构建或迭代修改符合规范的 Skill，自动生成/更新标准 SKILL.md，并在编辑完成后联动触发 eval-sync 用例同步，降低规范遵从门槛。

## 范围内

- 交互式创建新 Skill：引导用户逐步完成分类选择、使命定义、触发边界、成功标准、执行步骤定义
- 交互式编辑已有 Skill（`--edit`）：加载已有 SKILL.md 内容，逐章节引导修改
- 指定分类创建（`--category`）：跳过分类选择步骤
- 自动生成标准 SKILL.md（YAML front matter + 6 大标准章节）
- 自动创建配套 `evals/` 空目录
- 编辑模式自动备份上一版本
- 完成后联动提示是否触发 eval-sync 用例同步
- SKILL.md 标准格式：
  - YAML front matter（name、description）
  - When to use this
  - When NOT to use this
  - What to build
  - Steps
  - Definition of done

## 范围外

- 不执行诊断（由 FEAT-001 skill-diagnose 负责）
- 不执行改造（由 FEAT-002 skill-transform 负责）
- 不独立生成测试用例（依赖 eval-sync 联动触发）
- 不执行评测运行（由 FEAT-006 eval 负责）
- 不涉及 Skill 发布（由 FEAT-008 publish 负责）
- 不支持批量创建
- 不提供 GUI 界面

## 风险

| 风险类型 | 描述 | 缓解措施 |
|----------|------|----------|
| Anthropic 规范变更 | Anthropic 官方 Skill 规范可能发生变更 | SKILL.md 模板可配置，支持更新模板而无需修改代码逻辑 |
| 交互体验中断 | 长交互流程中用户可能中途退出，导致未完成的状态残留 | 提供草稿保存机制，支持从中断点继续 |
| name 冲突 | 新创建的 Skill 名称可能与已有 Skill 冲突 | 创建前检查同名 Skill，提供冲突提示和覆盖确认 |
| eval-sync 联动失败 | 编辑完成后触发的 eval-sync 可能因依赖模块未就绪而失败 | 联动仅为提示性引导，不阻塞 Skill 创建完成 |

## 待确认问题

1. 交互式流程中每一步是否都支持"跳过"（标记为可选章节），还是某些章节（如 name、description）为必填？
2. 编辑模式下，是否支持仅修改 SKILL.md 的部分章节而不重新走完整个流程？
3. 草稿保存的存储位置和格式是什么？
4. 联动触发 eval-sync 时，如果 eval-sync 模块尚未实现，应该如何处理？
5. Steps 章节"指令-only 或 script-backed 两种模式"的选择是否在创建流程中体现，还是作为后续编辑内容？
