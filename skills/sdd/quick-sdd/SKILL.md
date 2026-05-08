---
name: quick-sdd
description: 初始化、续跑和治理一套轻量级规格驱动开发（SDD）工作区，用于在项目中生成和维护 `AGENT.md`、`codespec/`、proposal、stories、tasks、validation artifacts，以及基于 `pm -> ra -> ta -> dev -> qa` 的多 agent 协作规约。当需要为项目搭建或继续执行轻量级 SDD 流程、运行时状态管理、任务路由和基于路径范围的角色权限控制时使用。这个 skill 只负责编排、初始化和续跑，不应跨角色直接把整条需求做完。
---

# Quick SDD

使用这个 skill 来初始化并运行一套轻量级的规格驱动开发工作区，支持 Claude 风格与 Codex 风格的多 agent 协作。它是流程入口，不是总代办执行器。

## 目标

- 当项目中不存在 `codespec/` 时，创建项目级规格工作区。
- 保持流程轻量：`pm -> ra -> ta -> dev -> qa`。
- 用共享文件协作，但不假设不同角色之间存在共享的隐藏对话上下文。
- 由 `pm` 负责路由任务并维护运行时状态。
- 把“初始化、续跑、恢复、派发、验证回流”写成明确规约，而不是依赖操作者自行理解。
- 即使用户直接提交完整需求，也优先把需求接入 SDD 并派发到下一角色，而不是由入口 skill 跨角色包办整个链路。

## 生成的工作区

初始化项目时，创建：

```text
AGENT.md
codespec/
  README.md
  specs/
    FEAT-001-example/
      proposal.md
      stories.md
      tasks.md
      validation-report.md
  runtime/
    role-policy.yaml
    tools.yaml
    state.json
```

## 独立角色 Skills

`quick-sdd` 本身负责初始化、续跑和编排。真正可发现、可独立触发的角色 skill 在本仓库中位于：

- `../quick-sdd-bootstrap-existing/SKILL.md`
- `../quick-sdd-pm/SKILL.md`
- `../quick-sdd-ra/SKILL.md`
- `../quick-sdd-ta/SKILL.md`
- `../quick-sdd-dev/SKILL.md`
- `../quick-sdd-qa/SKILL.md`

当任务已经被收敛到单一角色时，优先直接使用对应角色 skill，而不是继续把角色协议放在当前 skill 的内部资源里。
如果目标是“给一个已有项目补齐 quick-sdd 文档基线，并把当前功能和架构反向沉淀成 SDD 产物”，优先切换到 `../quick-sdd-bootstrap-existing/SKILL.md`。
如果用户直接把一个完整需求交给 `quick-sdd` 或 `quick-sdd-pm`，标准动作是“初始化/续跑 -> 选定当前阶段 -> 派发下一角色 -> 停在派发结果”，而不是一口气产出后续全部角色产物。
这些角色 skill 现在不仅承载流程分工，也各自内置需求澄清、架构拆解、工程验证、质量门禁等专业实践；共用原则沉淀在 `references/role-capability-playbook.md`。

## 角色分工

- `pm`：初始化或续跑工作区，选择当前 active feature 与 active task，调用续跑和权限展开脚本，更新 `AGENT.md`、`codespec/README.md` 和 `codespec/runtime/state.json`
- `ra`：编写 `proposal.md` 与 `stories.md`
- `ta`：编写 `tasks.md`
- `dev`：只在当前 task 授权范围内实现代码并执行 verify
- `qa`：编写 `validation-report.md`，输出验证裁决与回流建议

## 编排停机点

- `quick-sdd` 与 `pm` 的职责止于初始化、续跑、状态推进和派发。
- 一旦下一角色已经明确且不是 `pm`，当前回合就应该停在派发结果，而不是继续生成该角色的主产物。
- 如果用户明确要跳过 SDD 流程直接做实现，不应继续使用 `quick-sdd` 充当伪装的全能执行器，而应改走普通任务执行流程。

## 参考脚本与规约

如果要实现或校验 Quick SDD 的调度器、权限展开器或运行时 harness，优先读取：

- `references/dispatcher-resolution-spec.md`
- `scripts/init_codespec.py`
- `scripts/sync_validation_snapshot.py`
- `scripts/resume_orchestrator.py`
- `scripts/resolve_dispatch.py`

分工约定：

- `scripts/init_codespec.py`：初始化 `AGENT.md`、`codespec/` 与 feature 骨架
- `scripts/sync_validation_snapshot.py`：把 `validation-report.md` 中最近一次 QA 裁决标准化同步到 `state.json.latest_validation`
- `scripts/resume_orchestrator.py`：根据 `runtime/state.json` 与最近一次 QA 裁决推荐下一角色、下一动作与建议阶段
- `scripts/resolve_dispatch.py`：根据 `role-policy.yaml`、`state.json` 与 `tasks.md` 展开当前轮次的读写范围

## 运行规则

1. 把 `codespec/` 视为唯一的共享协作工作区。
2. 项目根目录 `AGENT.md` 是项目级协作入口，`codespec/` 是规格与状态入口，二者必须同时存在并互相配合。
3. 除非用户明确要求，否则不要创建额外的 handoff 目录。
4. 不要把 task 的 ACL 复制到运行时状态中。运行时状态只引用当前激活的 feature、story 和 task。
5. `stories.md` 保持产品视角，`tasks.md` 保持工程视角。
6. `validation-report.md` 同时承担验证结果和轻量 traceability。
7. 所有续跑、恢复、派发都以 `codespec/runtime/state.json` 为准。
8. ID 不保存在运行时状态中，而是通过扫描现有产物递增生成。
9. `active_feature` 保存的是 feature 目录键，例如 `FEAT-001-user-auth`，而不是裸 `FEAT-001`。
10. `validation-report.md` 是 QA 验证事实源，`state.json.latest_validation` 是由 `scripts/sync_validation_snapshot.py` 维护的标准化快照，不替代原始报告。
11. `resume_orchestrator.py` 必须先读 `state.json.latest_validation`；只有在快照不完整时，才回退解析 `validation-report.md` 当前 story 段落。
12. `resolve_dispatch.py` 只消费 `state.json.latest_validation`，不直接回退解析 `validation-report.md`。
13. 用户把完整需求直接交给 `quick-sdd` 或 `quick-sdd-pm`，不等于授权入口 skill 跨角色连续完成 `ra / ta / dev / qa` 的主工作。
14. 除非下一角色仍然是 `pm`，否则编排成功的终点就是“派发完成并停下”。

## 初始化流程

如果项目中缺少 `codespec/`：

1. 基于 `templates/agent.template.md` 创建项目根目录 `AGENT.md`；如果项目里已经有同类文件，则把 Quick SDD 规则合并进去。
2. 基于 `templates/README.template.md` 创建 `codespec/README.md`。
3. 基于 `templates/role-policy.template.yaml` 创建 `codespec/runtime/role-policy.yaml`。
4. 基于 `templates/tools.template.yaml` 创建 `codespec/runtime/tools.yaml`。
5. 基于 `templates/state.template.json` 创建 `codespec/runtime/state.json`。
6. 如果用户已经明确了 feature，再创建 `codespec/specs/<feature>/` 并填充 feature 级模板骨架；只创建当前阶段需要的最小内容，不顺手写满后续角色产物。
7. 初始化完成后，将 `active_phase` 设为 `proposal` 或 `idle`，并写入 `resume.next_role` 与 `resume.next_action`。
8. 如需快速执行上述动作，优先运行当前 skill 目录下的 `scripts/init_codespec.py --repo-root <项目根目录> [--feature-title <功能标题>]`。

## 已有 codespec 时的续跑流程

如果项目中已经存在 `codespec/`：

1. 先读取 `codespec/runtime/state.json`，将其作为唯一恢复入口。
2. 再读取 `codespec/README.md`，确认现有 feature 索引与状态说明。
3. 如果 `active_feature` 为空，则根据用户请求选择现有 feature，或创建新的 feature。
4. 如果 `active_feature` 不为空，则优先续跑该 feature，而不是重新初始化已有产物。
5. 如果 `active_dispatch.task` 不为空，则优先续跑该 task；只有在 task 已完成、被阻塞或用户明确改向时，才切换 task。
6. 如果 QA 刚更新过 `validation-report.md`，或怀疑 `latest_validation` 与报告不一致，则先运行 `scripts/sync_validation_snapshot.py --repo-root <项目根目录> --apply`，把最新裁决同步进 `state.json`。
7. 如果 `latest_validation` 对齐当前 active story 或 task，则优先把它作为最近一次 QA 裁决提示来决定下一跳。
8. 如需快速生成下一跳建议，优先运行当前 skill 目录下的 `scripts/resume_orchestrator.py --repo-root <项目根目录>`；如需直接写回运行时状态，可追加 `--apply`。
9. `resume_orchestrator.py` 先读 `state.json.latest_validation` 里的结构化裁决与回流字段；若快照不完整，再回读 `validation-report.md` 当前 story 段落。
10. 当 `resume_orchestrator.py` 已确定下一角色后，再运行 `scripts/resolve_dispatch.py --repo-root <项目根目录> --target-role <角色名> --mode <read|write>` 展开最小读写范围。
11. 如果 `active_phase` 为 `proposal / stories / planning / implementing / validating`，则只推进当前阶段所需文件，不回退重建后续已完成产物。
12. 如果 `blocked` 非空，`pm` 先处理阻塞项，再继续派发。

## 状态流转规则

Feature 状态：

- `idle -> proposal -> stories -> planning -> implementing -> validating -> done`
- 任意活动状态都可以进入 `blocked`
- `blocked` 解除后回到进入阻塞前的活动状态
- `validating -> implementing`：当验证失败，或 `pm` 决定按 `conditional_pass` 回到实现阶段补齐问题

Story 状态：

- `draft -> ready -> implemented -> validated`
- `validated -> implemented`：当 QA 复开或后续修改导致 story 失效

Task 状态：

- `todo -> in_progress -> done`
- `todo -> blocked`
- `in_progress -> blocked`
- `blocked -> todo` 或 `blocked -> in_progress`
- `done -> todo`：仅在 `pm` 因 QA 驳回而复开 task 时允许

## ID 生成规则

1. `feature_id` 使用 `FEAT-xxx`，通过扫描 `codespec/specs/` 下已有 `FEAT-` 目录递增生成。
2. `story_id` 使用 `ST-xxx`，通过扫描当前 feature 的 `stories.md` 中已有 story ID 递增生成。
3. `task_id` 使用 `T-xxx`，通过扫描当前 feature 的 `tasks.md` 中已有 task ID 递增生成。
4. 递增时始终取当前最大编号加一，不复用历史 ID。
5. 标题或 slug 可以变化，但 ID 一旦生成就保持稳定。

## Feature 流程

对每个 feature，产物按角色分工分阶段推进：

1. `pm` 负责初始化 feature 目录、维护 `codespec/README.md` 与 `codespec/runtime/state.json`，并决定当前该派发给谁。
2. `ra` 负责基于 `templates/proposal.template.md` 与 `templates/story.template.md` 产出或更新 `proposal.md`、`stories.md`。
3. `ta` 负责基于 `templates/task.template.md` 产出或更新 `tasks.md`。
4. `dev` 只在当前 task 授权范围内修改代码与必要测试，不负责代写规格文档。
5. `qa` 负责基于 `templates/validation-report.template.md` 产出或更新 `validation-report.md`。
6. `pm` 在每次交接后都要更新 `active_phase`、`active_dispatch`、`resume.next_role` 与 `resume.next_action`，并在下一角色不是 `pm` 时停止在派发结果。

## 模板使用说明

- 将 `{{feature_id}}`、`{{story_id}}` 这类占位符替换成实际值。
- 如果 YAML 注释能帮助后续生成更准确，可以保留。
- `read_paths` 和 `write_paths` 优先使用基于 glob 的路径范围。
- `verify` 使用 `type: command | tool | manual` 这一轻量结构。
- `role-policy.template.yaml` 里的动态范围与 `resolver` 使用结构化解析规则，而不是自由文本。
- `state.template.json` 里的 `_comment` 只用于说明，可以在落地运行时移除。
- `scripts/init_codespec.py` 负责初始化工作区、创建 feature 骨架并同步 `README.md` 与 `state.json`。
- `scripts/sync_validation_snapshot.py` 负责把 QA 报告中的 `status / decision / root_cause_type / reroute_to / reroute_action` 标准化同步到 `state.json.latest_validation`。
- `scripts/resume_orchestrator.py` 负责给出续跑时的下一角色、下一动作与建议阶段，并可在需要时写回 `state.json`。
- 不要自行发明 resolver 语义；按 `references/dispatcher-resolution-spec.md` 的规则实现。
- 如需快速校验当前项目里某个角色的权限展开结果，优先运行当前 skill 目录下的 `scripts/resolve_dispatch.py --repo-root <项目根目录>`。
- 统一闭环顺序为：`validation-report.md -> sync_validation_snapshot.py -> state.json.latest_validation -> resume_orchestrator.py -> resolve_dispatch.py`。

## 输出要求

- 只初始化当前阶段真正需要的文件。
- 产物保持精简、便于追加和 diff。
- 优先使用稳定 ID，例如 `FEAT-001`、`ST-001`、`T-001`。
- 入口 skill 的直接输出应以“初始化结果、状态更新、派发建议” 为主，而不是跨角色产出最终需求交付物。
