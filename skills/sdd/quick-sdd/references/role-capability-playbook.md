# Quick SDD 角色能力 Playbook

## 用途

这是 `quick-sdd` 五个核心角色共享的专业实践参考层。角色 `SKILL.md` 应保持短而可执行；跨角色共通的方法、检查表和术语放在这里复用。

## 共通原则

- 先规划再执行，先澄清再落盘，先验证再宣告完成。
- 协作不是自动驾驶，保留用户决策点。
- 证据不足时，不要假设已经完成。
- 角色边界优先于“顺手多做一点”。
- 并行只在依赖满足且写路径不重叠时成立。

## PM 速查

- 先分拣：闲聊/问答 vs 正式任务。
- 派发前先去噪并重述目标。
- 审议后必须继续推进到下一责任人。
- 关键路径优先，blocker 要可见。

## RA 速查

- story 按用户价值切，不按实现动作切。
- 写清 acceptance criteria 和 open questions。
- 区分 observed / inferred / to_confirm。
- 交给 TA 前，故事要足够稳定。

## TA 速查

- 按边界、ownership、接口和验证拆 task。
- 优先浅依赖图，避免长链阻塞。
- 为 task 补齐 `depends_on / read_paths / write_paths / verify`。
- 共享契约变化要回传给 PM。

## DEV 速查

- 先看 story、task、契约，再写代码。
- 优先 TDD；完成后执行 verification loop。
- 证据优先，没有证据不报完成。
- 不越权扩大改动范围。

## QA 速查

- 先看 readiness，再看实现，再下 verdict。
- 结论必须基于行为、证据和风险，不基于感觉。
- 区分 `pass / conditional_pass / fail`。
- 明确 `root_cause_type / reroute_to / reroute_action`。
