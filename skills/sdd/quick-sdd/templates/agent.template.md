# 项目 Agent 约定

## 使命

使用轻量级规格驱动开发，把一个 feature 从 `proposal` 推进到 `validation`，同时保持最小化产物开销和清晰的责任边界。

## 角色

- `pm`
  - 路由请求
  - 决定当前激活的 feature 和 task
  - 更新 `AGENT.md`、`codespec/README.md` 与 `codespec/runtime/state.json`
- `ra`
  - 编写或完善 `proposal.md`
  - 编写或完善 `stories.md`
- `ta`
  - 将已确认的 story 转成可执行 task
  - 定义 task 依赖与 task 访问范围
- `dev`
  - 只实现当前激活的 task
  - 严格停留在 `write_paths` 范围内
  - 产出 QA 需要的验证证据
- `qa`
  - 验证 acceptance criteria
  - 更新 `validation-report.md`

## Skill 映射

项目内如需显式调用独立角色 skill，使用：

- `$quick-sdd-pm`
- `$quick-sdd-ra`
- `$quick-sdd-ta`
- `$quick-sdd-dev`
- `$quick-sdd-qa`

在当前仓库布局中，它们对应的技能目录位于：

- `skills/quick-sdd-pm/`
- `skills/quick-sdd-ra/`
- `skills/quick-sdd-ta/`
- `skills/quick-sdd-dev/`
- `skills/quick-sdd-qa/`

## 接入方式

1. 初始化 Quick SDD 时，在项目根目录生成 `AGENT.md`。
2. 如果项目已有 `AGENT.md`、`AGENTS.md` 或类似文件，则把本模板中的 Quick SDD 规则合并进去，而不是重复创建平行规范。
3. `AGENT.md` 是项目级协作入口，`codespec/` 是项目级规格工作区，二者必须同时存在并互相引用。
4. 角色协议不再维护在主 skill 的 `agents/*.md` 中；真正可发现的角色定义应以独立 skill 目录下的 `SKILL.md` 为准。

## 路由规则

1. `pm` 是唯一的路由角色。
2. `pm` 在 `runtime/state.json` 中一次最多激活一个 feature。
3. 除非用户明确允许安全并行，否则 `dev` 一次只接收一个 task。
4. 只有在 `depends_on` 已满足且 `write_paths` 不重叠时，才允许并行 task。
5. `pm` 每次派发后都必须同步更新 `runtime/state.json` 中的 `active_phase` 与 `resume`。

## 权限规则

1. 将 `codespec/` 视为共享协调工作区。
2. 不要假设不同角色之间存在共享的隐藏上下文。
3. 角色级权限由 `codespec/runtime/role-policy.yaml` 定义。
4. task 级权限由 `codespec/specs/<feature>/tasks.md` 定义。
5. 实际生效的 task 范围是角色权限与 task 权限的交集。
6. `dev` 未经 `pm` 同意不得扩大 task 范围。

## 共通状态

- `DONE`：当前轮次完成，可以进入下一角色或下一阶段
- `DONE_WITH_CONCERNS`：已完成，但存在明确风险或待跟进行动
- `NEEDS_CONTEXT`：缺少继续执行所需的关键信息
- `BLOCKED`：存在依赖、权限、冲突或外部阻塞

## 共通输入输出

派发输入包至少包含：

```yaml
feature_id:
feature_path:
phase:
goal:
story_id:
task_id:
read_scope: []
write_scope: []
required_artifacts: []
completion_criteria: []
```

角色回收结果至少包含：

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

说明：

- `status` 表示当前轮次执行状态
- `decision` 表示业务或验证结论；对 QA 来说应使用 `pass | conditional_pass | fail`
- `root_cause_type` 表示失败或有条件通过时的根因分类；推荐使用 `implementation | task_boundary | dependency | requirement_gap | evidence_gap | risk_acceptance`
- `reroute_to` 表示建议回流给哪个角色；推荐使用 `dev | ta | ra | pm`
- `reroute_action` 表示建议下一跳执行的最小动作

## 产物规则

1. `proposal.md` 定义范围和风险，不定义实现方案。
2. `stories.md` 定义用户价值与验收，不写路径或命令。
3. `tasks.md` 定义执行、ACL、依赖与验证方式。
4. `validation-report.md` 保存验证结果和轻量 traceability。
5. `runtime/state.json` 只保存实时路由状态。

## 交付规则

1. 产物保持便于追加和 diff。
2. 优先使用稳定 ID：`FEAT-001`、`ST-001`、`T-001`。
3. 状态值保持在约定枚举内。
4. 实际证据记录在 `validation-report.md` 中，不重复写回 task ACL。
