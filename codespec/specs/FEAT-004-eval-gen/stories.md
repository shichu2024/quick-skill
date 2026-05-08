# 用户故事

## 索引

| ID | 标题 | 优先级 | 状态 | 依赖 |
|----|------|--------|------|------|
| ST-001 | SKILL.md 解析与锚点提取 | P1 | proposal | 无 |
| ST-002 | 四类基础用例自动生成 | P1 | proposal | ST-001 |
| ST-003 | 用例文件输出与快照生成 | P1 | proposal | ST-002 |
| ST-004 | 单 Skill 用例生成命令 | P1 | proposal | ST-003 |
| ST-005 | 覆盖模式与备份保护 | P1 | proposal | ST-004 |
| ST-006 | 批量生成所有 Skill 用例 | P2 | proposal | ST-004 |

---

## ST-001 SKILL.md 解析与锚点提取

作为 Skill 开发者，我希望 eval-gen 能自动解析 SKILL.md 并提取触发边界和成功标准信息，以便后续用例生成有准确的依据。

**验收标准**

- AC-001-1：能正确解析包含 YAML front matter（name、description）的 SKILL.md，提取 name 和 description 字段值
- AC-001-2：能识别并提取 "When to use this" 章节内容，作为正向触发锚点
- AC-001-3：能识别并提取 "When NOT to use this" 章节内容，作为负向控制锚点
- AC-001-4：能识别并提取 "Definition of done" 章节内容，作为通过标准锚点
- AC-001-5：能识别并提取 "What to build" 章节内容，作为产出规范锚点
- AC-001-6：当 SKILL.md 缺少必填章节（name、description、When to use this、When NOT to use this）时，输出明确的缺失项提示并终止生成
- AC-001-7：解析结果以结构化对象形式输出，可供后续用例生成步骤消费

**范围外**

- 不处理非标准格式的 SKILL.md（如缺少 YAML front matter 的纯文本文件）
- 不对提取内容做语义理解或推理

---

## ST-002 四类基础用例自动生成

作为 Skill 开发者，我希望 eval-gen 基于提取的锚点信息自动生成覆盖 4 类场景的测试用例，以便快速获得一个可用的初始用例集。

**验收标准**

- AC-002-1：生成显式调用用例 2-3 条，prompt 中包含 `$+技能名` 格式的直接调用，should_trigger=true
- AC-002-2：生成隐式调用用例 3-4 条，prompt 使用自然语言描述适用场景且不提及技能名，should_trigger=true
- AC-002-3：生成上下文/带噪声调用用例 3-4 条，prompt 在核心需求基础上附加业务上下文或无关细节，should_trigger=true
- AC-002-4：生成负例控制用例 3-4 条，prompt 基于 "When NOT to use this" 生成关键词重叠但需求不符的场景，should_trigger=false
- AC-002-5：每条用例包含完整的 id、should_trigger、prompt、pass_criteria、custom=false、deprecated=false 字段
- AC-002-6：总用例数量在 10-20 条之间
- AC-002-7：pass_criteria 内容来源于 SKILL.md 的 "Definition of done"，格式为分号分隔的字符串
- AC-002-8：负例用例的 pass_criteria 包含 "Skill 不应被触发" 相关的判定标准

**范围外**

- 不根据用例执行结果优化用例内容
- 不生成超出 4 类范式的自定义用例

---

## ST-003 用例文件输出与快照生成

作为 Skill 开发者，我希望生成的用例以标准格式持久化到 Skill 的 evals 目录，并自动生成 SKILL.md 快照，以便后续 eval-sync 和 eval 模块可以直接消费。

**验收标准**

- AC-003-1：用例文件输出到 `./skills/[业务分类]/[skill-name]/evals/[skill-name].prompts.csv`
- AC-003-2：CSV 文件首行为表头：id, should_trigger, prompt, pass_criteria, custom, deprecated
- AC-003-3：CSV 中包含逗号或换行的字段使用双引号转义，确保 CSV 格式合法
- AC-003-4：自动生成 `./skills/[业务分类]/[skill-name]/evals/.skill-snapshot.json`
- AC-003-5：快照文件包含 SKILL.md 完整文本内容和基于全文的版本哈希
- AC-003-6：若目标 evals 目录不存在，自动递归创建
- AC-003-7：生成完成后，在终端输出用例数量、文件路径等汇总信息

**范围外**

- 不输出 JSON 或其他格式的用例文件
- 不对已有快照文件做版本对比

---

## ST-004 单 Skill 用例生成命令

作为 Skill 开发者，我希望通过 `quick-skill eval-gen [skill-name]` 命令为指定 Skill 生成初始用例，以便在 Skill 创建后快速获得测试覆盖。

**验收标准**

- AC-004-1：执行 `quick-skill eval-gen [skill-name]` 后，自动在 ./skills/ 的所有业务分类子目录中查找匹配的 Skill 目录
- AC-004-2：找到目标 Skill 后，自动执行解析、生成、输出、快照的完整流程
- AC-004-3：若目标 Skill 不存在，输出明确的错误提示并退出
- AC-004-4：若目标 Skill 已有用例文件且未指定 --override，跳过该 Skill 并提示用户使用 --override 覆盖
- AC-004-5：命令执行成功后返回退出码 0，失败返回非 0 退出码

**范围外**

- 不支持模糊匹配或正则匹配 Skill 名称
- 不在生成后自动触发评测

---

## ST-005 覆盖模式与备份保护

作为 Skill 开发者，我希望在需要重新生成用例时可以通过 --override 参数覆盖已有用例，同时系统自动备份旧文件以防误操作。

**验收标准**

- AC-005-1：执行 `quick-skill eval-gen [skill-name] --override` 时，重新执行完整的解析和生成流程
- AC-005-2：覆盖前自动将已有用例文件备份到 `./evals/.backup/` 目录，备份文件名包含时间戳
- AC-005-3：覆盖前在终端提示即将覆盖的文件数量，要求用户输入确认（y/N）
- AC-005-4：用户拒绝确认时，终止覆盖流程，不修改任何文件
- AC-005-5：覆盖后同时更新 .skill-snapshot.json 为最新 SKILL.md 内容
- AC-005-6：覆盖模式下，已有的 custom=true 用例不在备份中被丢弃（备份包含完整原始文件）

**范围外**

- 不提供覆盖后的自动回滚命令（用户可从 .backup/ 手动恢复）

---

## ST-006 批量生成所有 Skill 用例

作为 Skill 维护者，我希望通过 `quick-skill eval-gen --all` 命令一次性为所有尚未生成用例的 Skill 生成初始用例集，以便批量完成用例初始化。

**验收标准**

- AC-006-1：执行 `quick-skill eval-gen --all` 后，自动扫描 ./skills/ 下所有业务分类子目录中的 Skill
- AC-006-2：为每个尚未生成用例的 Skill 执行完整的解析、生成、输出、快照流程
- AC-006-3：跳过已有用例文件且未指定 --override 的 Skill，并在终端明确列出跳过的 Skill 名称
- AC-006-4：执行完成后输出汇总信息：已生成数量、跳过数量、失败数量及失败原因
- AC-006-5：单个 Skill 生成失败不阻塞其他 Skill 的生成流程
- AC-006-6：全部生成完成后返回退出码 0（全部成功）或 1（存在失败）

**范围外**

- 不支持批量生成时的并发控制参数
- 不支持按业务分类筛选批量生成范围
