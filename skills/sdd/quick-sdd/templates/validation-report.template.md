# 验证报告

## 功能总结

- 功能 ID：{{feature_id}}
- 当前轮次状态（status）：`DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED`
- 总体裁决（decision）：`pass | conditional_pass | fail`
- 总体建议回流角色（reroute_to）：`pm | dev | ta | ra`
- 总体摘要（summary）：
  - 无
- 已验证故事：
  - {{story_id}}
- 未解决问题：
  - 无

## {{story_id}}

- 当前轮次状态（status）：`DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED`
- 验证裁决（decision）：`pass | conditional_pass | fail`
- 根因分类（root_cause_type）：`implementation | task_boundary | dependency | requirement_gap | evidence_gap | risk_acceptance | none`
- 建议回流角色（reroute_to）：`dev | ta | ra | pm`
- 建议回流动作（reroute_action）：
  - 无
- 摘要（summary）：
  - 无
- 已检查验收标准：
  - `AC-1`
  - `AC-2`
- 证据：
  - 命令：
    - `npm test`
  - 工具：
    - `e2e-start`
  - 变更文件：
    - `src/...`
- 缺陷：
  - 无
- 剩余风险：
  - 无

## 追踪摘要

| 故事 | 验收标准 | 任务 | 验证裁决（decision） | 根因分类 | 建议回流角色 |
|------|------------|-------|--------------------|----------|----------------|
| {{story_id}} | AC-1, AC-2 | {{task_id}} | pass | none | pm |
