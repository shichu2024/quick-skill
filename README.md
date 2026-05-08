# Quick Skill - AI Skill 全生命周期管理 CLI 工具

## 项目简介

Quick Skill 是一个用于管理 AI Agent Skills 的命令行工具，提供 Skill 的创建、初始化、部署、评测等全生命周期管理能力。当前已实现核心功能：

- ✅ **init**: 项目初始化与 Skill 平铺部署
- ✅ **create**: 交互式 Skill 创建引导

## 功能列表

| 命令 | 状态 | 描述 |
|------|------|------|
| `quick-skill init` | ✅ 完成 | 初始化项目并将 Skills 部署到目标 Agent |
| `quick-skill create` | ✅ 核心完成 | 交互式创建符合规范的 Skill |
| `quick-skill diagnose` | 🚧 开发中 | Skill 合规性诊断 |
| `quick-skill transform` | 🚧 开发中 | Skill 标准化改造 |
| `quick-skill eval-gen` | 🚧 开发中 | 自动化测试用例生成 |
| `quick-skill eval` | 🚧 开发中 | Skill 评测引擎 |
| `quick-skill publish` | 🚧 开发中 | Skill 发布到 npm |

## 安装

### 全局安装

```bash
npm install -g quick-skill
```

### 局部安装

```bash
npm install --save-dev quick-skill
```

## 快速开始

### 1. 初始化项目

将 Quick Skill 内置的 Skills 部署到你的 AI Agent：

```bash
# 全局安装后直接调用
quick-skill init

# 局部安装后通过 npx 调用
npx quick-skill init
```

**交互流程**：

1. 选择目标 AI Agent（Claude / OpenCode / Relay）
2. 自动创建目标目录并平铺部署所有 Skills
3. 同名 Skill 自动覆盖，其他 Skill 保持不变

**目标目录**：

| Agent | 目标目录 |
|-------|---------|
| Claude | `./claude/skills` |
| OpenCode | `./opencode/skills` |
| Relay | `./.relay/skills` |

**示例输出**：

```
=== Skill 创建向导 (创建模式) ===

选择目标 AI Agent:
  Claude
  OpenCode
  Relay

✓ 已选择 Agent: claude
✓ 目标目录: D:\your-project\claude\skills

正在扫描 Skill 源...
✓ 发现 3 个 Skill

正在部署 Skill...

=== 部署汇总 ===
目标目录: D:\your-project\claude\skills

✓ 成功部署: 3 个 Skill
  - skill-a
  - skill-b
  - skill-c

✓ 初始化完成！
```

### 2. 创建新 Skill

交互式创建符合 Anthropic 规范的 Skill：

```bash
# 交互式创建
quick-skill create

# 指定分类创建
quick-skill create --category public
```

**创建流程**：

1. **业务分类选择**（支持选择已有分类或创建新分类）
2. **Skill 使命定义**（输入 name 和 description）
3. **触发边界定义**（When to use / When NOT to use）
4. **成功标准定义**（What to build / Definition of done）
5. **执行步骤定义**（可选）
6. **自动生成 SKILL.md 文件**

**生成文件结构**：

```
skills/
  {category}/
    {skill-name}/
      SKILL.md
      evals/
```

**SKILL.md 标准格式**：

```markdown
---
name: my-skill
description: A skill description
---

# When to use this
Use when...

# When NOT to use this
Do not use when...

# What to build
Build artifacts...

# Steps
1. Step one
2. Step two

# Definition of done
Complete when...
```

## 命令详细说明

### `quick-skill init`

**功能**：将 Quick Skill 内置的所有 Skills 平铺部署到目标 Agent 的技能目录。

**参数**：无（纯交互式）

**特性**：
- ✅ 支持 3 种 Agent（Claude / OpenCode / Relay）
- ✅ 自动递归创建目标目录
- ✅ 平铺部署（去除业务分类层级）
- ✅ 同名 Skill 安全覆盖
- ✅ 非 Skill 完整保留
- ✅ 全局安装和局部安装兼容

**使用场景**：
- 初始化新项目的 Skills 目录
- 更新已有项目的 Skills 到最新版本
- 切换不同的 Agent 目标

### `quick-skill create`

**功能**：交互式创建符合 Anthropic 规范的 Skill。

**参数**：
- `--category <name>`: 指定业务分类，跳过分类选择步骤
- `--edit`: 编辑模式（已支持框架，完整功能开发中）

**特性**：
- ✅ 交互式引导（5 步标准流程）
- ✅ kebab-case 格式自动转换
- ✅ 同名 Skill 重复检测
- ✅ 多行编辑器输入
- ✅ 标准 SKILL.md 自动生成
- ✅ evals/ 目录自动创建
- ✅ 可跳过执行步骤定义

**使用场景**：
- 创建新的 Skill
- 快速生成 Skill 框架
- 批量创建 Skills（通过 `--category` 参数）

## 项目结构

```
quick-skill/
  ├── src/
  │   ├── cli.ts                  # CLI 入口
  │   ├── commands/
  │   │   ├── init.ts             # init 命令实现
  │   │   └── create.ts           # create 命令实现
  │   ├── constants/
  │   │   └ agents.ts             # Agent 映射配置
  │   ├── core/
  │   │   ├── create/             # Skill 创建核心逻辑
  │   │   │   ├── types.ts        # 类型定义
  │   │   │   ├── step-registry.ts # 步骤注册表
  │   │   │   ├── step-runner.ts  # 步骤调度器
  │   │   │   ├── steps/          # 各个引导步骤
  │   │   │   ├── skill-md-writer.ts # 文件生成器
  │   │   │   └ templates/        # SKILL.md 模板
  │   ├── services/
  │   │   ├── skill-scanner.ts    # Skill 源扫描器
  │   │   ├── skill-deployer.ts   # Skill 部署器
  │   │   ├── skill-overwriter.ts # 同名覆盖处理器
  │   ├── utils/
  │   │   ├── paths.ts            # 路径工具
  │   │   ├── errors.ts           # 错误类型定义
  │   │   ├── reporter.ts         # 结果报告器
  │   ├── skills/                 # 内置 Skills 源目录
  │   │   ├── public/
  │   │   ├── 需求分析/
  │   │   ├── ...
  │   └ tests/                    # 测试目录
  │   └ dist/                     # 编译输出
  │   ├── package.json
  │   ├── tsconfig.json
  │   └ vitest.config.ts
  │   └ README.md
  │   └ codespec/                 # SDD 规格工作区
  │   │   ├── specs/              # Feature 规格
  │   │   ├── runtime/            # 运行时状态
  │   └ AGENT.md                  # 项目协作入口
```

## 开发进度

### 已完成功能

| Feature | 完成度 | 测试覆盖 |
|---------|--------|---------|
| FEAT-007 init | 100% | 50 tests ✅ |
| FEAT-003 create | 80% (核心完成) | 71 tests ✅ |

**FEAT-007 init 功能清单**：
- ✅ Agent 目录映射
- ✅ Skill 源路径定位（全局/局部安装兼容）
- ✅ init 命令注册与交互流程
- ✅ Skill 源扫描与平铺复制
- ✅ 同名 Skill 安全覆盖
- ✅ 异常处理与安全终止
- ✅ 成功/失败汇总输出

**FEAT-003 create 功能清单**：
- ✅ CLI 命令注册与交互框架
- ✅ 业务分类选择引导
- ✅ Skill 使命定义引导
- ✅ 触发边界与成功标准引导
- ✅ 执行步骤引导（可选）
- ✅ SKILL.md 标准文件生成
- 🚧 交互式编辑模式（框架已支持）
- 🚧 eval-sync 联动触发
- 🚧 草稿保存与中断恢复

### 开发中的功能

| Feature | 预计完成 | 描述 |
|---------|---------|------|
| FEAT-001 diagnose | Phase 2 | Skill 合规性诊断 |
| FEAT-002 transform | Phase 2 | Skill 标准化改造 |
| FEAT-004 eval-gen | Phase 2 | 自动化测试用例生成 |
| FEAT-005 eval-sync | Phase 2 | Skill 与用例自动同步 |
| FEAT-006 eval | Phase 2 | 标准化评测引擎 |
| FEAT-008 publish | Phase 3 | Skill 发布到 npm |
| FEAT-009 list | Phase 3 | Skill 列表查看 |

## 技术栈

- **语言**: TypeScript (ES2022)
- **框架**: Node.js + Commander.js
- **交互**: Inquirer.js
- **测试**: Vitest
- **构建**: TypeScript Compiler

## 测试覆盖

当前测试统计：
- **测试文件**: 13 个
- **测试总数**: 71 个
- **通过率**: 100%

测试覆盖范围：
- ✅ CLI 命令测试
- ✅ Agent 目录映射测试
- ✅ Skill 部署流程测试
- ✅ Skill 创建框架测试
- ✅ 分类解析测试
- ✅ 名称校验测试
- ✅ 文件生成器测试
- ✅ 错误处理测试

## 使用示例

### 示例 1: 初始化 Claude 项目

```bash
# 执行 init 命令
quick-skill init

# 选择 Claude
# 输出:
✓ 已选择 Agent: claude
✓ 目标目录: /path/to/your/project/claude/skills
✓ 发现 3 个 Skill
✓ 成功部署: 3 个 Skill

# 结果: claude/skills/ 目录下包含所有 Skills
```

### 示例 2: 创建新 Skill

```bash
# 执行 create 命令
quick-skill create

# 交互流程:
1. 选择分类: public (或创建新分类)
2. 输入名称: my-new-skill
3. 输入描述: A skill for doing something
4. 输入触发边界: When to use / When NOT to use
5. 输入成功标准: What to build / Definition of done
6. 是否定义执行步骤? Yes/No

# 结果: skills/public/my-new-skill/SKILL.md 已生成
```

### 示例 3: 快速创建指定分类 Skill

```bash
# 指定分类创建，跳过分类选择
quick-skill create --category requirements

# 流程从第 2 步开始（使命定义）
# 结果: skills/requirements/new-skill/SKILL.md
```

## 常见问题

### Q1: init 命令会覆盖我的自定义 Skill 吗？

**不会**。init 命令仅覆盖与内置 Skill 同名的文件/目录，其他 Skill 完整保留不受影响。

### Q2: Skill 名称格式有什么要求？

Skill 名称必须为 **kebab-case** 格式（如 `my-skill-name`），不支持空格、下划线或大写字母。create 命令会自动转换并提示确认。

### Q3: 如何更新已有的 Skills？

重新执行 `quick-skill init` 命令即可。同名 Skill 会自动覆盖为新版本，其他 Skill 保持不变。

### Q4: 支持哪些 AI Agent？

当前支持：
- Claude (`./claude/skills`)
- OpenCode (`./opencode/skills`)
- Relay (`./.relay/skills`)

### Q5: 全局安装和局部安装有什么区别？

功能完全一致。全局安装后可直接调用 `quick-skill init`，局部安装需通过 `npx quick-skill init`。

### Q6: 如何查看已安装的 Skills？

`quick-skill list` 命令正在开发中（FEAT-009）。当前可通过查看目标目录下的文件列表。

## 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/your-org/quick-skill.git

# 安装依赖
npm install

# 运行测试
npm test

# 构建
npm run build

# 本地调试
node dist/cli.js init
node dist/cli.js create
```

### 添加新命令

1. 在 `src/commands/` 下创建命令实现文件
2. 在 `src/cli.ts` 中注册命令
3. 在 `tests/commands/` 下编写测试
4. 更新 README 功能列表

## 贡献指南

欢迎贡献代码、报告问题或提出功能建议：

1. Fork 项目
2. 创建 Feature 分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

MIT License

## 更新日志

### v0.1.0 (2026-05-08)

**新增功能**：
- ✅ `quick-skill init` 命令 - Skill 平铺部署
- ✅ `quick-skill create` 命令 - 交互式 Skill 创建

**测试覆盖**：
- 71 个单元测试全部通过

**技术实现**：
- TypeScript 编译成功
- Commander.js CLI 框架
- Inquirer.js 交互式引导
- Vitest 测试框架

---

**项目状态**: 核心功能已可用，后续功能持续开发中

**联系方式**: 查看项目 GitHub Issues

**文档更新**: 2026-05-08