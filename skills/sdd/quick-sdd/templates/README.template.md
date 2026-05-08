# CodeSpec

## 概览

<!-- 简要说明项目是什么，以及为什么需要在这里使用 CodeSpec。 -->

- 项目：
- 负责人：
- 当前激活的功能：
- 最后更新时间：

## 术语

- `Feature`：一个自包含的产品能力，存放在 `codespec/specs/<feature>/` 下
- `Story`：带有明确验收标准的用户价值切片
- `Task`：用于路由、归属和执行的工程单元
- `Validation`：对一个或多个 story 的验证结果
- `Traceability`：story、验收标准、task 与验证结果之间的映射关系
- `ACL`：角色或 task 允许读取与写入的路径范围

## 流程

- `pm -> ra -> ta -> dev -> qa`
- 共享存储，隔离角色上下文
- `pm` 负责路由与运行时状态
- 项目根目录 `AGENT.md` 负责协作约束，`codespec/` 负责规格与状态

## Feature 索引

| ID | 标题 | 状态 | 优先级 | 路径 |
|----|------|------|--------|------|
| {{feature_id}} | {{feature_title}} | proposal | P1 | specs/{{feature_dir}}/ |

## 状态说明

### Feature 状态

- `proposal`：正在定义问题和范围
- `stories`：正在定义用户价值切片和验收标准
- `planning`：正在准备 task 和执行边界
- `implementing`：一个或多个 task 正在执行
- `validating`：QA 正在验证结果
- `done`：feature 已验收完成
- `blocked`：feature 受依赖或决策阻塞

### 运行时状态

- `idle`：当前没有激活的 feature 或 task，等待初始化、恢复或下一次派发

## 状态流转

- `idle -> proposal` 表示开始一个新 feature
- `idle -> implementing / validating` 表示恢复已有流程
- `proposal -> stories -> planning -> implementing -> validating -> done`
- 任意活动状态都可以进入 `blocked`
- `blocked` 解除后回到阻塞前状态
- `validating -> implementing` 表示验证失败或按需返工

## ID 规则

- `Feature` 使用 `FEAT-001` 这类稳定编号
- `Story` 使用 `ST-001` 这类稳定编号
- `Task` 使用 `T-001` 这类稳定编号
- 新编号通过扫描现有产物递增生成，不复用旧编号
