# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|-------|--------|------------|-------|
| {{task_id}} | {{story_id}} | {{task_title}} | todo | - | dev |

## {{task_id}} {{task_title}}

```yaml
id: {{task_id}}
story_id: {{story_id}}
title: {{task_title}}
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/**
write_paths:
  - src/**
verify:
  - type: command
    value: npm test
  - type: manual
    value: 确认验收标准已满足
```

### 目标

<!-- 用 1-3 条描述这个 task 的工程结果。 -->

- 

### 交付物

<!-- 列出具体输出或可观察结果。 -->

- 

### 备注

<!-- 可选。补充实现边界、限制条件或复用提示。 -->

- `read_paths` 和 `write_paths` 使用 glob 路径模式。
- 不要在这里重复完整的验收标准。
