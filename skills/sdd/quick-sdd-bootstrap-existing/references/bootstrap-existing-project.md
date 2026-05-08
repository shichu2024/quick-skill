# 存量项目接入 Quick SDD 参考

## 1. 目标

把一个已经存在的项目反向整理成 Quick SDD 可继续演进的 baseline。

这份 baseline 需要回答三类问题：

- 项目现在在做什么
- 系统现在已经提供了哪些核心能力
- 后续如果要继续用 Quick SDD 演进，应该从哪里接上

## 2. 首轮扫描建议

优先阅读这些信息源：

- 根目录 `README`、`docs/`、`CHANGELOG`、部署说明
- 包管理与运行配置：`package.json`、`pyproject.toml`、`pom.xml`、`go.mod`、`Cargo.toml`
- 入口与路由：`main`、`app`、`server`、`routes`、`pages`、`controllers`
- 核心业务目录：`src/`、`services/`、`domain/`、`modules/`
- 数据与集成：`models/`、`schema`、`migrations`、`api clients`
- 测试与验收线索：`tests/`、`e2e/`、CI 配置

首轮目标不是穷尽一切细节，而是快速获得：

- 技术栈
- 部署/运行方式
- 核心模块边界
- 关键用户能力
- 已知约束和集成点

## 3. feature 拆分建议

### 小项目

如果项目能力还比较集中，先产出 1 个 baseline feature 即可，例如：

- `FEAT-001-current-system-baseline`

### 中大型项目

优先按下面两种边界拆分：

- 按核心用户旅程
- 按领域模块或 bounded context

首轮建议只覆盖 3-7 个核心 feature，不要求一次把所有边角能力都写完。

## 4. 文档落盘策略

### `codespec/README.md`

至少补充：

- 项目用途
- 技术栈
- 主要模块地图
- 当前已建立的 baseline feature 索引
- 哪些区域仍未纳入 baseline

### `proposal.md`

对于存量项目，`proposal.md` 要描述“当前能力基线”：

- 当前要解决的问题域
- 当前系统已经提供的目标能力
- In Scope 是“现有能力和边界”
- Out of Scope 是“当前系统尚未覆盖的能力”
- Risks 是“继续演进这个现有能力时会遇到的架构/数据/耦合风险”

### `stories.md`

把当前已经存在的能力整理成 story：

- 用当前真实行为写故事
- 验收标准来自已有代码、UI、接口和测试证据
- 不要把未来愿景写成现有故事

### `tasks.md`

如果当前只是做 baseline 建档，没有立即开发请求，可以采用占位式初始化：

- 保留 `# Tasks`
- 保留 `## Index`
- 明确写出“当前为 baseline 初始化，暂未创建开发任务”

如果项目已经明确接下来要改某个能力，再补真实 task。

### `validation-report.md`

如果当前只是接入 baseline，可以保留初始化状态，但要让 QA 后续可续写：

- 写明当前为 baseline 初始化
- feature summary 可以标注为 `NEEDS_CONTEXT` 或尚未执行完整验收
- 不要伪造 `pass`

## 5. state.json 建议

完成 baseline 建档后，推荐：

- `active_phase`: `idle` 或 `stories`
- `resume.next_role`: `pm`
- `resume.next_action`: 指向下一步应继续梳理、拆 task 或接收新需求

目标是让后续 Quick SDD 可以无缝接管，而不是把项目停在不明确状态。

## 6. 产出质量检查

至少确认：

- baseline feature 名称能看出业务能力，而不是纯技术目录名
- stories 反映真实现状，不夹带未来需求
- README 中已经能看出系统主要模块和边界
- state.json 不处于悬空状态
- 后续 `quick-sdd` / `quick-sdd-pm` 可以继续续跑
