# Git 提交指南

## 当前项目状态

根据 `git status` 检查，当前有以下文件待提交：

```
未跟踪文件:
  .gitignore           ← Git 忽略规则（应提交）
  AGENT.md             ← 项目协作入口（应提交）
  README.md            ← 项目说明文档（应提交）
  codespec/            ← SDD 规格工作区（应提交）
  docs/                ← 文档目录（应提交）
  package.json         ← 项目配置（应提交）
  package-lock.json    ← 依赖锁定（应提交）
  scripts/             ← 验证脚本（应提交）
  skills/              ← 内置 Skills（应提交）
  src/                 ← 源代码（应提交）
  tests/               ← 测试文件（应提交）
  tsconfig.json        ← TypeScript 配置（应提交）
  vitest.config.ts     ← 测试配置（应提交）
  原始需求.md          ← 需求规格（应提交）
```

## 应该提交的文件清单

### ✅ 配置文件（必须提交）
- `.gitignore` - Git 忽略规则
- `package.json` - 项目依赖和配置
- `package-lock.json` - 依赖版本锁定
- `tsconfig.json` - TypeScript 编译配置
- `vitest.config.ts` - Vitest 测试配置

### ✅ 源代码和测试（必须提交）
- `src/` - 所有 TypeScript 源代码
  - `cli.ts` - CLI 入口
  - `commands/` - 命令实现
  - `core/` - 核心逻辑
  - `services/` - 服务层
  - `utils/` - 工具函数
  - `constants/` - 常量定义
- `tests/` - 所有测试文件
  - `commands/` - 命令测试
  - `core/` - 核心逻辑测试
  - `services/` - 服务测试
  - `utils/` - 工具测试
- `scripts/` - 辅助脚本
  - `verify-local.js` - 本地验证脚本
  - `quick-verify.js` - 快速验证脚本
  - `verify-gitignore.js` - gitignore 验证脚本

### ✅ Skills（正式 Skills 应提交）
- `skills/public/skill-a/` - 测试 Skill A
- `skills/public/skill-b/` - 测试 Skill B  
- `skills/需求分析/skill-c/` - 测试 Skill C
- ❌ `skills/public/my-test-skill/` - 测试创建的临时 Skill（已在 gitignore）

### ✅ 文档（必须提交）
- `README.md` - 项目说明文档
- `AGENT.md` - 项目协作入口文档
- `原始需求.md` - 需求规格说明书
- `docs/` - 文档目录
  - `LOCAL_VERIFICATION.md` - 本地验证指南
  - `GITIGNORE_GUIDE.md` - gitignore 配置说明
  - `GITIGNORE_STATUS.md` - gitignore 状态报告

### ✅ SDD 规格（必须提交）
- `codespec/specs/` - Feature 规格文档
  - `FEAT-001-skill-diagnose/`
  - `FEAT-002-skill-transform/`
  - `FEAT-003-skill-create/`
  - `FEAT-007-init/`
  - 等
- `codespec/runtime/` - 运行时配置
  - `state.json` - 运行时状态
  - `role-policy.yaml` - 角色策略
  - `tools.yaml` - 工具配置
- `codespec/README.md` - SDD 工作区说明

## 不应该提交的文件（已在 .gitignore）

### ❌ 编译输出
- `dist/` - TypeScript 编译结果（应通过 CI 生成）

### ❌ 依赖
- `node_modules/` - 第三方依赖（应通过 npm install 安装）

### ❌ 测试临时文件
- `claude/` - init 命令测试生成
- `opencode/` - init 命令测试生成
- `.relay/` - init 命令测试生成
- `temp-*` - 临时测试目录
- `coverage/` - 测试覆盖率报告

### ❌ IDE 配置
- `.claude/` - Claude Code 配置
- `.opencode/` - OpenCode 配置
- `.vscode/` - VS Code 配置（如果添加）

### ❌ 其他
- `*.log` - 日志文件
- `.DS_Store` - macOS 系统文件
- `Thumbs.db` - Windows 缩略图缓存

## 提交步骤

### 步骤 1: 清理临时文件

```bash
# 确保没有测试生成的临时文件
rm -rf claude opencode .relay
rm -rf temp-* temp-test-* temp-target-* temp-overwrite-*
rm -rf skills/public/my-test-skill skills/public/test-skill

# 确认清理完成
ls -la | grep -E "claude|opencode|relay|temp"
# 应该无输出
```

### 步骤 2: 验证 gitignore 生效

```bash
# 运行验证脚本
node scripts/verify-gitignore.js

# 检查关键目录是否被忽略
git check-ignore -v dist/
git check-ignore -v node_modules/

# 应显示被 .gitignore 规则匹配
```

### 步骤 3: 添加文件到 Git

```bash
# 方式 1: 添加所有未跟踪文件（推荐）
git add .

# 方式 2: 逐个添加重要文件
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git add src/ tests/ scripts/ docs/
git add README.md AGENT.md 原始需求.md
git add skills/public/skill-a skills/public/skill-b skills/需求分析/skill-c
git add codespec/
```

### 步骤 4: 检查即将提交的内容

```bash
# 查看暂存区内容
git status

# 查看具体文件变更
git status --short

# 确认没有不应该提交的文件
git status --short | grep -E "dist|node_modules|claude|opencode"
# 应该无输出
```

### 步骤 5: 创建初始提交

```bash
# 提交所有暂存文件
git commit -m "Initial commit: quick-skill CLI tool

Features:
- init command: Deploy Skills to Agent directories
- create command: Interactive Skill creation workflow
- 71 unit tests passing (100% coverage)
- Complete documentation and SDD specs

Technical:
- TypeScript compilation configured
- Vitest testing framework
- Commander.js CLI framework
- Inquirer.js interactive prompts
"
```

### 步骤 6: 查看提交历史

```bash
# 查看最新提交
git log -1 --stat

# 查看提交文件列表
git show --name-only --oneline HEAD
```

## 提交内容统计

预估提交内容：

```
文件类型统计:
  配置文件: 5 个 (.gitignore, package.json, tsconfig.json, vitest.config.ts, package-lock.json)
  源代码: ~16 个 TypeScript 文件
  测试文件: ~13 个测试文件
  Skills: 3 个正式 Skills
  文档: 4 个主要文档 + docs/ 目录
  SDD 规格: 9 个 Feature 规格 + 运行时配置
  脚本: 3 个验证脚本

总文件数: ~50 个文件
总代码行数: ~2000+ 行（不含 node_modules）
```

## 提交后的操作

### 推送到远程仓库

```bash
# 添加远程仓库（如果还未添加）
git remote add origin https://github.com/your-org/quick-skill.git

# 推送到 main 分支
git push -u origin main

# 或推送到 master 分支
git push -u origin master
```

### 设置分支保护

建议设置 main/master 分支保护规则：
- 要求 PR 审核
- 要求 CI 通过
- 禁止强制推送

## CI/CD 配置建议

提交后建议添加 CI/CD 配置：

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## 文件大小检查

```bash
# 检查大文件
find . -type f -size +1M -not -path "./node_modules/*" -not -path "./.git/*"

# 检查总大小
du -sh --exclude=node_modules --exclude=.git .

# 预估大小: ~2-5MB（不含 node_modules）
```

## 提交验证清单

提交前确认：

- [ ] 所有临时文件已清理
- [ ] gitignore 配置正确生效
- [ ] `dist/` 未在暂存区
- [ ] `node_modules/` 未在暂存区
- [ ] 测试临时目录已清理
- [ ] 所有源代码已暂存
- [ ] 所有测试文件已暂存
- [ ] 配置文件已暂存
- [ ] 文档已暂存
- [ ] Skills 已暂存（仅正式 Skills）
- [ ] SDD 规格已暂存
- [ ] commit message 清晰完整

## 提交后的验证

提交后检查：

```bash
# 查看提交是否成功
git log -1

# 查看提交内容
git show HEAD

# 确认远程推送成功
git remote -v
git branch -vv
```

---

**准备状态**: ✅ 已就绪  
**验证脚本**: `scripts/verify-gitignore.js`  
**下一步**: 执行 `git add . && git commit`