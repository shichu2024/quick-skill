---
id: FEAT-004
title: eval-gen — 自动化初始用例生成
type: feature
priority: P1
depends_on: [FEAT-003]
---

# 提案

## 问题

Skill 开发者在创建或改造一个 Skill 后，需要手动编写测试用例来验证 Skill 的触发准确性和执行质量。当前缺乏标准化的用例生成手段，导致：

1. 用例编写成本高，开发者需要理解 OpenAI Eval 方法论才能写出合格的用例
2. 用例覆盖不完整，容易遗漏负例控制或上下文噪声场景
3. Skill 迭代时缺少基线快照，后续同步无法判断哪些内容发生了变化

## 目标

基于 OpenAI 官方 Eval 用例构建方法论，结合 Skill 的 SKILL.md 定义，自动化生成 4 类基础测试用例（显式调用、隐式调用、上下文/带噪声调用、负例控制），形成 10-20 条初始用例集。同时在生成时自动创建 SKILL.md 快照，为后续 eval-sync 模块提供变更基准。

## 范围内

- SKILL.md 解析：提取触发边界锚点（name、description、When to use / When NOT to use）和成功标准锚点（Definition of done、What to build）
- 4 类用例自动生成：显式调用用例 2-3 条、隐式调用用例 3-4 条、上下文/带噪声调用用例 3-4 条、负例控制用例 3-4 条
- 用例文件输出：CSV 格式，包含 id、should_trigger、prompt、pass_criteria、custom、deprecated 字段
- 快照生成：输出 .skill-snapshot.json，记录 SKILL.md 完整内容与版本哈希
- 单 Skill 生成：`quick-skill eval-gen [skill-name]`
- 覆盖生成：`quick-skill eval-gen [skill-name] --override`
- 批量生成：`quick-skill eval-gen --all`
- 前置校验：目标 Skill 必须包含完整且可解析的 SKILL.md

## 范围外

- 用例内容的语义质量优化（由模型或人工迭代完成，不在本模块范围）
- 已有用例的增量同步（属于 FEAT-005 eval-sync 的职责）
- 用例的执行与评测（属于 FEAT-006 eval 的职责）
- 自定义用例的编辑交互（用户直接编辑 CSV 文件）
- 多语言用例生成或国际化支持

## 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SKILL.md 格式不统一导致解析失败 | 生成流程中断 | 定义严格的 YAML front matter 解析规范，解析失败时输出明确的格式错误提示 |
| 生成的用例质量参差不齐 | 评测基线不可靠 | 限定生成范围为"初始用例集"，明确提示用户应手动审查和补充 |
| CSV 格式的 pass_criteria 字段为字符串数组，解析时可能产生歧义 | 下游模块读取出错 | 在 CSV 中约定使用分号分隔的字符串表示数组，并在文档中明确格式约定 |
| --override 误操作导致用户自定义用例丢失 | 数据丢失 | 覆盖前自动备份已有用例到 .backup/ 目录，并在执行前要求二次确认 |

## 待确认问题

1. **用例生成是否依赖 LLM 调用？** 如果需要调用模型生成 prompt 文本，则需确认模型选型和 API 调用方式；如果是模板拼接，则需确认模板策略。当前假设采用模板 + SKILL.md 字段提取的确定性方式生成。
2. **批量生成的并发策略？** `--all` 模式下是串行还是并发？建议默认串行，避免资源争用，待性能瓶颈确认后再引入并发控制。
3. **快照中"版本哈希"的算法？** 需要确认是对 SKILL.md 文件内容取 SHA-256，还是仅对关键字段取哈希。建议全文 SHA-256，变更检测更可靠。
4. **--all 是否包含已有用例的 Skill？** 建议默认跳过已有用例的 Skill（除非加 --override），避免意外覆盖。
