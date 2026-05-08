# 调度器解析规范

这份规范定义 Quick SDD 调度器如何把 `codespec/runtime/role-policy.yaml` 中的 `literal` 和 `resolver` 展开成当前轮次真正可执行的读写范围，并说明如何消费 `state.json.latest_validation` 这个最近一次 QA 裁决快照。

目标不是“给出一个大致方向”，而是让任何实现者都能根据本文写出一致的 resolver 解释器。

## 1. 适用范围

当调度器要为某个角色生成当前轮次的权限视图时，必须读取：

- `codespec/runtime/role-policy.yaml`
- `codespec/runtime/state.json`
- `codespec/specs/<active_feature>/tasks.md`（如果存在 task 级 resolver）

本文主要解决“如何展开当前轮次的范围”，并补充“如何读取最近一次 QA 快照作为续跑提示”，但不负责：

- 修改 `tasks.md`
- 决定是否切换阶段
- 决定是否接受 `conditional_pass`
- 替代 PM 做业务路由

## 2. 输入

调度器执行 resolver 时，最少需要：

```yaml
target_role:
mode: read | write
repo_root:
role_policy_path:
state_path:
```

其中：

- `target_role`：当前要为哪个角色解析权限，例如 `dev` 或 `qa`
- `mode`：本次是解析读权限还是写权限
- `repo_root`：项目根目录
- `role_policy_path`：通常是 `codespec/runtime/role-policy.yaml`
- `state_path`：通常是 `codespec/runtime/state.json`

## 3. 预检查

正式解析前，按顺序执行：

1. 读取并解析 `role-policy.yaml`
2. 读取并解析 `state.json`
3. 检查 `target_role` 是否存在于 `roles`
4. 检查 `mode` 是否为 `read` 或 `write`
5. 如果目标角色依赖 feature 级 resolver，检查 `active_feature` 是否非空
6. 如果目标角色依赖 task 级 resolver，检查 `active_dispatch.task` 是否非空

如果任一预检查失败：

- 不返回部分成功的范围
- 直接返回 `BLOCKED`
- 原因写成可定位的错误码或说明，例如：
  - `missing_active_feature`
  - `missing_active_task`
  - `invalid_role`
  - `invalid_mode`
  - `invalid_role_policy`
  - `invalid_state`

## 4. 基础上下文构建

先从 `state.json` 构建当前上下文：

```yaml
active_feature:
active_phase:
active_role:
active_story:
active_task:
validation_story:
validation_task:
validation_status:
validation_decision:
validation_summary:
validation_report_ref:
validation_updated_at:
```

字段来源：

- `active_feature` <- `state.active_feature`
- `active_phase` <- `state.active_phase`
- `active_role` <- `state.active_dispatch.role`
- `active_story` <- `state.active_dispatch.story`
- `active_task` <- `state.active_dispatch.task`
- `validation_story` <- `state.latest_validation.story`
- `validation_task` <- `state.latest_validation.task`
- `validation_status` <- `state.latest_validation.status`
- `validation_decision` <- `state.latest_validation.decision`
- `validation_summary` <- `state.latest_validation.summary`
- `validation_report_ref` <- `state.latest_validation.report_ref`
- `validation_updated_at` <- `state.latest_validation.updated_at`

这些值先作为变量表，用于：

- 解析 `scope_resolution`
- 替换 `literal` 中的 `${...}`
- 判断是否可以把最近一次 QA 裁决当作续跑提示

## 5. tasks.md 解析规则

当 resolver 依赖 task 信息时，调度器必须解析：

`codespec/specs/<active_feature>/tasks.md`

### 5.1 任务块识别

一个 task 的权威元数据块，定义为：

1. 以 `## T-xxx ...` 开头的二级标题
2. 紧跟其后的第一个 fenced code block
3. code block 的 info string 必须是 `yaml`

示意：

````md
## T-001 Create login API

```yaml
id: T-001
story_id: ST-001
read_paths:
  - src/auth/**
write_paths:
  - src/auth/**
```
````

只有这个 YAML 块是调度器读取 task ACL 的权威来源。

### 5.2 必要字段

每个 task YAML 至少必须包含：

- `id`
- `story_id`
- `read_paths`
- `write_paths`

如果 resolver 依赖某个 task，但该 task 缺字段：

- 返回 `BLOCKED`
- 原因例如 `task_field_missing:write_paths`

### 5.3 索引方式

解析后，调度器至少建立两个索引：

- `tasks_by_id[id] -> task`
- `tasks_by_story[story_id] -> task[]`

如果存在重复 `id`：

- 返回 `BLOCKED`
- 原因例如 `duplicate_task_id:T-001`

## 6. scope_resolution 的结构化语义

`scope_resolution` 中每个键都代表一个可复用的解析器定义。

### 6.1 `state_field`

从 `state.json` 中读取标量字段。

示例：

```yaml
active_feature:
  kind: state_field
  path: active_feature
```

规则：

- `path` 使用点路径，例如 `active_dispatch.task`
- 结果必须是标量字符串
- 空字符串视为“无值”

### 6.2 `task_field`

从当前 active task 对应的 task YAML 中读取字段。

示例：

```yaml
task_write_paths:
  kind: task_field
  feature_ref: active_feature
  task_ref: active_task
  field: write_paths
```

规则：

1. 先解析 `feature_ref`
2. 再解析 `task_ref`
3. 打开 `codespec/specs/<feature>/tasks.md`
4. 找到对应 `task_id`
5. 返回该 task 的指定字段

约束：

- `field` 必须存在
- 对 ACL 类字段，结果必须是字符串列表
- 空列表允许返回，但调度器应把它视为“当前无此类权限”

### 6.3 `story_task_union`

聚合当前 story 下所有 task 的某个字段，并取去重并集。

示例：

```yaml
story_task_write_paths:
  kind: story_task_union
  feature_ref: active_feature
  story_ref: active_story
  field: write_paths
```

规则：

1. 先解析 `feature_ref`
2. 再解析 `story_ref`
3. 打开 `codespec/specs/<feature>/tasks.md`
4. 找到所有 `story_id == <story_ref>` 的 task
5. 收集这些 task 的 `field`
6. 扁平化、去重、稳定排序后返回

如果 `active_story` 为空：

- 先检查 `active_task`
- 如果 `active_task` 存在，则从该 task 的 `story_id` 回填 `active_story`
- 如果仍然拿不到 story，则返回 `BLOCKED`

## 7. fallback 规则

某些 `scope_resolution` 项可以定义 `fallback`。

当前只允许：

- 主解析失败或结果为空时，再执行 `fallback`

示例：

```yaml
active_story:
  kind: state_field
  path: active_dispatch.story
  fallback:
    kind: task_field
    feature_ref: active_feature
    task_ref: active_task
    field: story_id
```

含义：

- 优先使用 `state.json` 里的 `active_dispatch.story`
- 如果为空，再去当前 active task 里读 `story_id`

## 8. literal 展开规则

`literal:` 表示固定路径模式，但允许插值。

示例：

```yaml
- literal: codespec/specs/${active_feature}/tasks.md
```

展开规则：

1. 先找到 `${...}` 中的变量名
2. 变量名只能引用已经解析出的上下文字段或 `scope_resolution` 标量结果
3. 执行字符串替换
4. 如果变量不存在或为空，则返回 `BLOCKED`

说明：

- `literal` 的结果始终是单个字符串
- 允许使用 glob
- 推荐统一使用相对仓库根目录的正斜杠路径

## 9. 权限展开算法

给定 `target_role` 和 `mode`，调度器按以下顺序展开：

1. 读取 `roles[target_role][mode]`
2. 从上到下处理每一条规则
3. 遇到 `literal`：
   - 执行变量插值
   - 将结果加入输出集合
4. 遇到 `resolver`：
   - 在 `scope_resolution` 中找到同名定义
   - 按其 `kind` 执行解析
   - 如果结果是列表，则逐项加入输出集合
   - 如果结果是标量字符串，则加入输出集合
5. 对最终集合做：
   - 去重
   - 去空值
   - 统一为相对仓库根目录路径
   - 稳定排序
6. 返回最终结果

建议输出结构：

```yaml
role:
mode:
feature_id:
story_id:
task_id:
resolved_paths: []
```

## 10. latest_validation 快照消费规则

`latest_validation` 是一个去规范化快照，目的是让 PM 在续跑时不用先完整扫读 `validation-report.md`，也能知道最近一次 QA 的轮次状态和裁决。

它的定位是：

- `提示视图`
- `续跑加速器`
- `路由参考`

它不是：

- 验证事实源
- 最终审计记录
- 可以脱离 `validation-report.md` 单独长期维护的报告

### 10.1 快照有效条件

调度器或 PM 只有在以下条件全部满足时，才应把 `latest_validation` 当作有效提示：

1. `latest_validation.decision` 非空
2. `active_feature` 非空
3. `latest_validation.story` 为空，或等于 `active_dispatch.story`
4. `latest_validation.task` 为空，或等于 `active_dispatch.task`

如果上述任一条件不满足：

- 不要报错
- 直接把 `latest_validation` 视为“存在但不参与当前续跑决策”

### 10.2 PM 续跑优先级

当 PM 执行 `continue` 或 `repair` 时，建议按以下顺序决策：

1. 先读取 `active_feature / active_phase / active_dispatch`
2. 再检查 `latest_validation` 是否满足有效条件
3. 如果快照无效，则按正常阶段流转推进
4. 如果快照有效，则优先按 `latest_validation.decision` 决定下一跳

### 10.3 决策默认动作

当快照有效时：

- `decision == fail`
  - 默认 `resume.mode = repair`
  - 默认下一角色是 `dev`
  - 默认下一动作是“修复当前 story 或 task 的验证失败项”
  - 如果 PM 从 `validation-report.md` 中发现失败根因是 task 边界、依赖或路径范围错误，可改派给 `ta`

- `decision == conditional_pass`
  - 默认 `resume.mode = validate`
  - 默认下一角色是 `pm`
  - 默认下一动作是“审阅剩余风险并决定接受还是回流修复”
  - 在 PM 做出接受风险前，不应自动把 feature 置为 `done`

- `decision == pass`
  - 默认下一角色是 `pm`
  - 默认下一动作是“推进到下一 story、下一 task，或结束当前 feature”
  - 如果当前 `active_phase == validating` 且没有剩余未验证项，可继续推进到 `done`

### 10.4 与 validation-report 的关系

当 `latest_validation` 有效时：

- 允许 PM 用它做快速路由
- 不允许 PM 仅凭它完成最终验收归档

在以下场景，PM 应回读 `validation-report.md` 再做最终动作：

- 准备将 feature 标记为 `done`
- 准备接受 `conditional_pass`
- 准备把失败从 `dev` 改派给 `ta` 或 `ra`

### 10.5 建议输出

如果调度器同时输出权限与续跑提示，可扩展成：

```yaml
role:
mode:
feature_id:
story_id:
task_id:
resolved_paths: []
latest_validation_hint:
  usable:
  status:
  decision:
  summary:
  preferred_next_role:
  preferred_resume_mode:
```

## 11. 角色最小展开结果

### 10.1 dev 读权限

至少应展开出：

- `codespec/README.md`
- `codespec/specs/<active_feature>/stories.md`
- `codespec/specs/<active_feature>/tasks.md`
- 当前 active task 的 `read_paths`

### 10.2 dev 写权限

至少应展开出：

- 当前 active task 的 `write_paths`

### 10.3 qa 读权限

至少应展开出：

- `codespec/README.md`
- `codespec/specs/<active_feature>/proposal.md`
- `codespec/specs/<active_feature>/stories.md`
- `codespec/specs/<active_feature>/tasks.md`
- 当前 story 下所有 task 的 `write_paths` 并集

### 10.4 qa 写权限

至少应展开出：

- `codespec/specs/<active_feature>/validation-report.md`

## 12. 失败策略

只要出现以下情况之一，调度器就应返回 `BLOCKED` 而不是猜测：

- `active_feature` 缺失但 resolver 依赖 feature
- `active_task` 缺失但 resolver 依赖 task
- `tasks.md` 缺失或不可解析
- 目标 task 不存在
- task 字段类型不正确，例如 `read_paths` 不是列表
- `literal` 中变量无法替换
- `scope_resolution` 引用了不存在的 resolver

错误输出建议：

```yaml
status: BLOCKED
reason: missing_active_task
details: active_dispatch.task is empty while resolving task_write_paths
```

## 13. 正规化规则

为保证跨平台一致性，建议：

1. 在规格文件中统一使用相对仓库根目录的正斜杠路径
2. 调度器内部保留逻辑路径，不要在解析阶段急于改成绝对路径
3. 真正执行文件系统权限检查时，再由运行时适配成平台路径
4. 去重时按逻辑路径去重，而不是按平台绝对路径去重

## 14. 最小示例

假设：

```json
{
  "active_feature": "FEAT-001-user-auth",
  "active_phase": "implementing",
  "active_dispatch": {
    "role": "dev",
    "story": "ST-001",
    "task": "T-002"
  }
}
```

并且 `T-002` 的 YAML 为：

```yaml
id: T-002
story_id: ST-001
read_paths:
  - src/auth/**
  - tests/auth/**
write_paths:
  - src/auth/**
```

那么 `dev.read` 结果应为：

```yaml
resolved_paths:
  - codespec/README.md
  - codespec/specs/FEAT-001-user-auth/stories.md
  - codespec/specs/FEAT-001-user-auth/tasks.md
  - src/auth/**
  - tests/auth/**
```

`dev.write` 结果应为：

```yaml
resolved_paths:
  - src/auth/**
```

如果此时 `state.json.latest_validation` 为：

```json
{
  "story": "ST-001",
  "task": "T-002",
  "status": "DONE",
  "decision": "fail",
  "summary": "登录失败时没有返回预期错误信息",
  "report_ref": "codespec/specs/FEAT-001-user-auth/validation-report.md#st-001",
  "updated_at": "2026-04-15T10:30:00Z"
}
```

则调度器给 PM 的推荐续跑提示应类似：

```yaml
latest_validation_hint:
  usable: true
  status: DONE
  decision: fail
  summary: 登录失败时没有返回预期错误信息
  preferred_next_role: dev
  preferred_resume_mode: repair
```

## 15. 实现建议

- 先实现 Markdown task 块解析，再实现 resolver
- 先支持 `state_field / task_field / story_task_union`
- 不要在 v0.1 引入任意表达式求值
- 不要让 resolver 执行命令、读网络或推导未声明路径
- 所有动态范围都必须来源于 `state.json` 或 `tasks.md`

## 16. 参考脚本

Quick SDD 当前提供 3 个与调度闭环直接相关的参考脚本：

- `scripts/sync_validation_snapshot.py`
- `scripts/resume_orchestrator.py`
- `scripts/resolve_dispatch.py`

### 16.1 `sync_validation_snapshot.py`

用途：

- 读取 `codespec/runtime/state.json`
- 自动定位当前 feature 的 `validation-report.md`
- 从目标 story 段落提取 `status / decision / root_cause_type / reroute_to / reroute_action`
- 标准化生成 `state.json.latest_validation`
- 可选地将最新快照写回 `state.json`

推荐调用方式：

```bash
python <skill-dir>/scripts/sync_validation_snapshot.py --repo-root <repo-root> --apply
python <skill-dir>/scripts/sync_validation_snapshot.py --repo-root <repo-root> --story-id ST-001 --apply
```

输出约定：

- 成功时返回 JSON，`status: DONE`
- 失败时返回 JSON，`status: BLOCKED`
- `snapshot` 是准备写入 `state.json.latest_validation` 的标准化结果

使用边界：

- 它只负责把 QA 报告同步成运行态快照
- 它不决定下一角色、不改写 `active_phase`、不改写 `active_dispatch`
- `validation-report.md` 仍然是 QA 事实源，快照只是为 PM 续跑提速

### 16.2 `resume_orchestrator.py`

用途：

- 读取 `codespec/runtime/state.json`
- 读取当前 feature 的 `stories.md / tasks.md`
- 先消费 `state.json.latest_validation`
- 仅在快照不完整时，回退解析 `validation-report.md` 当前 story 段落
- 输出下一角色、下一动作与建议阶段
- 可选地把推荐结果写回 `state.json`

推荐调用方式：

```bash
python <skill-dir>/scripts/resume_orchestrator.py --repo-root <repo-root>
python <skill-dir>/scripts/resume_orchestrator.py --repo-root <repo-root> --apply
```

输出约定：

- 成功时返回 JSON，`status: DONE`
- `latest_validation_hint` 表示本轮续跑时实际采用的 QA 提示
- `latest_validation_hint.source` 只允许是：
  - `state_snapshot`
  - `validation_report_fallback`
  - `state_snapshot+validation_report_fallback`
- 失败时返回 JSON，`status: BLOCKED`

使用边界：

- 它负责业务路由建议，不负责权限展开
- 它可以在快照不完整时回退读取 QA 报告，但不能替代 QA 事实源
- 当 PM 需要接受 `conditional_pass`、结束 feature 或人工改派角色时，仍应回读验证报告正文

### 16.3 `resolve_dispatch.py`

用途：

- 读取 `codespec/runtime/role-policy.yaml`
- 读取 `codespec/runtime/state.json`
- 按当前 `active_feature` 解析 `codespec/specs/<feature>/tasks.md`
- 输出目标角色当前轮次的 `resolved_paths`
- 输出基于 `state.json.latest_validation` 构造的 `latest_validation_hint`

推荐调用方式：

```bash
python <skill-dir>/scripts/resolve_dispatch.py --repo-root <repo-root> --target-role dev --mode read
python <skill-dir>/scripts/resolve_dispatch.py --repo-root <repo-root> --target-role qa --mode read
python <skill-dir>/scripts/resolve_dispatch.py --repo-root <repo-root> --target-role dev --mode write
```

输出约定：

- 成功时返回 JSON，`status: DONE`
- 失败时返回 JSON，`status: BLOCKED`
- `reason / details` 用于定位缺失状态、缺失 task、无效 resolver 或插值失败

使用边界：

- 它是 `dispatcher-resolution-spec` 的最小参考实现，不替代 PM 的最终业务路由判断
- 它只消费 `state.json.latest_validation`，不直接回退解析 `validation-report.md`
- 如果快照缺失或过期，应优先先运行 `sync_validation_snapshot.py`

## 17. 三个脚本的边界

- `sync_validation_snapshot.py`
  - 负责把 QA 报告落成标准化快照
  - 负责减少 `validation-report.md` 与 `state.json.latest_validation` 的漂移
- `resume_orchestrator.py`
  - 负责基于当前阶段、task 状态和 `latest_validation_hint` 推荐下一角色
  - 负责给出 `next_action`
  - 可选地将推荐结果写回 `state.json`
- `resolve_dispatch.py`
  - 负责权限展开
  - 负责 `resolver` 解释
  - 负责产出 `resolved_paths`

## 18. 统一调用顺序

推荐把运行时闭环固定成：

1. QA 更新 `validation-report.md`
2. PM 运行 `sync_validation_snapshot.py --apply`
3. PM 运行 `resume_orchestrator.py` 判断下一跳
4. 如需落盘续跑建议，再执行 `resume_orchestrator.py --apply`
5. PM 运行 `resolve_dispatch.py` 为下一角色展开最小读写范围
6. 派发目标角色，执行本轮工作

一句话版本：

`validation-report.md -> sync_validation_snapshot.py -> state.json.latest_validation -> resume_orchestrator.py -> resolve_dispatch.py`
