# CodeSpec

## 概览

- 项目：quick-skill — AI Skill 全生命周期管理 CLI 工具
- 当前激活的功能：无 (idle)
- 最后更新时间：2026-05-09

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
| FEAT-001 | skill-diagnose 存量技能合规性诊断 | planning | P1 | specs/FEAT-001-skill-diagnose/ |
| FEAT-002 | skill-transform 存量技能标准化改造 | planning | P1 | specs/FEAT-002-skill-transform/ |
| FEAT-003 | skill-create 集成Anthropic skill-creator | done | P1 | specs/FEAT-003-skill-create/ |
| FEAT-004 | eval-gen 自动化初始用例生成 | done | P1 | specs/FEAT-004-eval-gen/ |
| FEAT-005 | eval-sync 技能迭代与用例自动同步 | done | P1 | specs/FEAT-005-eval-sync/ |
| FEAT-006 | eval 标准化Skill评测引擎 | done | P1 | specs/FEAT-006-eval/ |
| FEAT-007 | init 项目初始化与Skill平铺部署 | planning | P1 | specs/FEAT-007-init/ |
| FEAT-008 | publish Skill源打包与npm发布 | planning | P2 | specs/FEAT-008-publish/ |
| FEAT-009 | list Skill列表查看与管理 | planning | P3 | specs/FEAT-009-list/ |

## 模块依赖关系

```
skill-diagnose (FEAT-001)
  └── skill-transform (FEAT-002) 依赖 FEAT-001 的诊断能力

skill-create (FEAT-003) 独立模块
  └── eval-gen (FEAT-004) 需要 SKILL.md 作为输入
       └── eval-sync (FEAT-005) 依赖 FEAT-004 的快照机制

eval (FEAT-006) 依赖 FEAT-004/005 的用例集

init (FEAT-007) 独立模块，依赖完整的 skills/ 目录
publish (FEAT-008) 依赖 FEAT-006 的评测门禁
list (FEAT-009) 独立模块
```

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

- `idle`：当前没有激活的 feature 或 task

## 状态流转

- `idle -> proposal` 表示开始一个新 feature
- `proposal -> stories -> planning -> implementing -> validating -> done`
- 任意活动状态都可以进入 `blocked`
- `blocked` 解除后回到阻塞前状态
- `validating -> implementing` 表示验证失败或按需返工

## ID 规则

- `Feature` 使用 `FEAT-001` 这类稳定编号
- `Story` 使用 `ST-001` 这类稳定编号
- `Task` 使用 `T-001` 这类稳定编号
- 新编号通过扫描现有产物递增生成，不复用旧编号
