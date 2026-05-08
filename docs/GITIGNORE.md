# .gitignore 配置说明

本文档说明 quick-skill 项目的 .gitignore 配置，确保不会将不必要的文件提交到版本控制。

## 配置分类

### 1. IDE 和编辑器配置
```
.claude/          # Claude Code 配置
.opencode/        # OpenCode 配置
.vscode/          # VS Code 配置
.idea/            # IntelliJ IDEA 配置
*.swp, *.swo      # Vim 临时文件
*~                # 编辑器备份文件
```

### 2. Node.js 依赖和日志
```
node_modules/     # 第三方依赖（不应提交）
npm-debug.log*    # npm 调试日志
yarn-debug.log*   # yarn 调试日志
yarn-error.log*   # yarn 错误日志
.npm, .yarn       # npm/yarn 缓存
```

### 3. TypeScript 编译输出
```
dist/             # 编译输出目录（不应提交）
*.tsbuildinfo     # TypeScript 构建信息
```

**说明**：
- `dist/` 是编译生成的代码，不应提交到版本控制
- 源代码在 `src/` 目录，编译输出应通过 CI/CD 流程生成
- 用户可通过 `npm run build` 重新编译

### 4. 测试相关
```
coverage/         # 测试覆盖率报告
.nyc_output/      # NYC 测试输出
temp-*            # 临时测试目录
temp-test-*       # 测试脚本生成的临时目录
```

**说明**：
- 测试覆盖率报告可在 CI 中生成
- 临时测试目录是运行测试脚本时创建的

### 5. CLI 测试生成的目录
```
claude/           # quick-skill init 测试生成
opencode/         # quick-skill init 测试生成
.relay/           # quick-skill init 测试生成
```

**说明**：
- 这些目录是通过 `quick-skill init` 命令生成的 Skill 部署目录
- 在本地测试时会创建，不应提交
- 用户执行 init 命令时会在自己的项目中创建

### 6. 测试过程中创建的 Skill
```
skills/public/my-test-skill/
skills/public/test-skill/
skills/*/test-*
skills/*/*test*
```

**说明**：
- 通过 `quick-skill create` 测试时创建的临时 Skill
- 包含 "test" 或 "my-test" 名称的 Skill 应忽略
- 正式的 Skill（如 skill-a, skill-b）应保留并提交

### 7. 操作系统文件
```
.DS_Store         # macOS 系统文件
Thumbs.db         # Windows 缩略图缓存
*.bak             # 备份文件
*.backup          # 备份文件
```

### 8. 临时文件
```
*.tmp             # 临时文件
*.temp            # 临时文件
.cache/           # 缓存目录
```

### 9. 日志文件
```
*.log             # 所有日志文件
logs/             # 日志目录
```

### 10. SDD 相关临时文件
```
codespec/runtime/*.bak      # 运行时状态备份
*.draft.json                # 草稿文件
.create-draft.json          # Skill 创建草稿
```

**保留的 SDD 文件**：
- `codespec/specs/` - Feature 规格文档（应提交）
- `codespec/runtime/state.json` - 运行时状态（可提交用于进度追踪）
- `AGENT.md` - 项目协作入口（应提交）

### 11. 环境变量和密钥
```
.env              # 环境变量文件
.env.local        # 本地环境变量
.env.*.local      # 特定环境变量
*.key             # 密钥文件
*.pem             # PEM 证书文件
```

### 12. 打包文件
```
*.tgz             # npm 包文件
*.tar.gz          # tar.gz 压缩包
*.zip             # ZIP 压缩包
```

### 13. 其他
```
.eslintcache      # ESLint 缓存
.parcel-cache     # Parcel 缓存
```

## 应该提交的重要文件

以下文件应该提交到版本控制：

### 项目配置文件
- ✅ `package.json` - 项目依赖和配置
- ✅ `package-lock.json` - 依赖锁定文件
- ✅ `tsconfig.json` - TypeScript 配置
- ✅ `vitest.config.ts` - 测试配置
- ✅ `.gitignore` - Git 忽略规则

### 源代码
- ✅ `src/` - 所有源代码
- ✅ `tests/` - 所有测试文件

### 文档
- ✅ `README.md` - 项目说明文档
- ✅ `AGENT.md` - 协作入口文档
- ✅ `docs/` - 其他文档
- ✅ `原始需求.md` - 需求规格说明书

### Skills
- ✅ `skills/public/skill-a/` - 正式 Skill
- ✅ `skills/public/skill-b/` - 正式 Skill
- ✅ `skills/需求分析/skill-c/` - 正式 Skill
- ❌ `skills/public/my-test-skill/` - 测试 Skill（应忽略）

### SDD 规格
- ✅ `codespec/specs/` - Feature 规格
- ✅ `codespec/runtime/state.json` - 运行时状态
- ✅ `codespec/runtime/role-policy.yaml` - 角色策略
- ✅ `codespec/runtime/tools.yaml` - 工具配置

### 脚本
- ✅ `scripts/` - 验证和管理脚本

## 验证方法

运行验证脚本检查 gitignore 配置：

```bash
node scripts/verify-gitignore.js
```

输出示例：
```
=== .gitignore 配置验证 ===

1. 检查 .gitignore 文件:
   ✓ .gitignore 存在，包含 48 条规则

2. 检查应该被忽略的目录:
   ✓ node_modules/ 已被 gitignore
   ✓ dist/ 已被 gitignore

3. 检查测试生成的临时目录:
   ✓ claude/ 不存在或已被忽略
   ✓ opencode/ 不存在或已被忽略

4. 检查 git status:
   ✓ 所有应该忽略的文件都已正确忽略

=== 验证完成 ===
```

## 清理临时文件

如果需要清理测试生成的临时文件：

```bash
# 清理 CLI 测试生成的目录
rm -rf claude opencode .relay

# 清理测试 Skill
rm -rf skills/public/my-test-skill
rm -rf skills/public/test-skill

# 清理临时测试目录
rm -rf temp-test-skills
rm -rf temp-overwrite-skills
rm -rf temp-target-skills
```

## Git 操作建议

### 添加文件到版本控制

```bash
# 添加所有应该提交的文件
git add package.json package-lock.json tsconfig.json vitest.config.ts
git add src/ tests/ scripts/ docs/
git add README.md AGENT.md .gitignore
git add skills/public/skill-a skills/public/skill-b skills/需求分析/skill-c
git add codespec/specs/ codespec/runtime/

# 查看即将提交的内容
git status

# 确认无误后提交
git commit -m "Initial commit: quick-skill CLI tool"
```

### 检查 gitignore 是否生效

```bash
# 检查特定文件是否被忽略
git check-ignore -v dist/
git check-ignore -v node_modules/
git check-ignore -v claude/

# 查看未跟踪文件
git status --short

# 强制添加被忽略的文件（不推荐）
git add -f dist/  # 仅在特殊情况下使用
```

## 常见问题

### Q1: dist/ 已经被提交了怎么办？

```bash
# 从版本控制中移除但保留本地文件
git rm --cached -r dist/

# 提交移除操作
git commit -m "Remove dist/ from version control"
```

### Q2: 测试生成的文件出现在 git status？

```bash
# 确认文件已被忽略
git check-ignore -v claude/

# 如果未被忽略，检查 .gitignore 语法
cat .gitignore | grep claude

# 手动清理测试文件
rm -rf claude opencode .relay
```

### Q3: 如何添加新的忽略规则？

编辑 `.gitignore` 文件，添加新规则：

```bash
# 例如忽略特定文件
echo "temp-output/" >> .gitignore

# 或使用通配符
echo "*.generated.ts" >> .gitignore

# 验证新规则
git check-ignore -v temp-output/
```

### Q4: skills 目录中的哪些 Skill 应该提交？

提交规则：
- ✅ 提交：正式使用的 Skill（skill-a, skill-b 等）
- ❌ 忽略：测试创建的 Skill（my-test-skill, test-skill 等）
- ❌ 忽略：名称包含 "test" 的 Skill

在 .gitignore 中已配置：
```
skills/public/my-test-skill/
skills/public/test-skill/
skills/*/test-*
skills/*/*test*
```

## 注意事项

1. **不要提交编译输出**：`dist/` 目录应该通过 CI/CD 流程自动生成
2. **不要提交依赖**：`node_modules/` 通过 `npm install` 安装
3. **不要提交测试临时文件**：本地测试生成的目录应定期清理
4. **提交源代码和配置**：`src/`, `tests/`, `package.json` 等应提交
5. **提交文档和规格**：README, SDD 规格, 需求文档应提交
6. **定期清理**：运行测试后清理临时文件，避免污染版本控制

---

**更新时间**: 2026-05-08  
**验证脚本**: `scripts/verify-gitignore.js`  
**配置文件**: `.gitignore`