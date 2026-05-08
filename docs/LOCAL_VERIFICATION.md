# 本地验证指南

## 验证方法概览

当前 quick-skill 已通过 `npm link` 链接到全局，可以直接使用命令进行测试。

## 快速验证

运行验证脚本：

```bash
node scripts/quick-verify.js
```

验证结果：
```
=== Quick Skill 快速验证 ===

1. 项目结构检查:
   ✓ package.json
   ✓ tsconfig.json
   ✓ vitest.config.ts
   ✓ src/cli.ts
   ✓ dist目录

2. npm link 状态:
   ✓ quick-skill 已链接到全局
   可以直接使用: quick-skill init

3. 可用的测试命令:
   • 查看帮助: node dist/cli.js --help
   • 测试 init: quick-skill init
   • 测试 create: quick-skill create --category public
   • 运行测试: npm test

=== 验证完成 ===
```

## 功能测试步骤

### 步骤 1: 检查 CLI 基本功能

```bash
# 查看 CLI 帮助
node dist/cli.js --help

# 查看 init 命令帮助
node dist/cli.js init --help

# 查看 create 命令帮助
node dist/cli.js create --help
```

### 步骤 2: 测试 init 命令（交互式）

```bash
# 使用全局链接的命令
quick-skill init

# 或直接运行编译文件
node dist/cli.js init
```

**交互流程**：
1. 显示 Agent 选择列表（Claude / OpenCode / Relay）
2. 选择一个 Agent
3. 自动创建目标目录并部署 Skills
4. 输出部署汇总报告

**预期输出**：
```
=== Skill 创建向导 (创建模式) ===

选择目标 AI Agent:
  Claude
  OpenCode  
  Relay

✓ 已选择 Agent: claude
✓ 目标目录: ./claude/skills

正在扫描 Skill 源...
✓ 发现 3 个 Skill

正在部署 Skill...

=== 部署汇总 ===
目标目录: ./claude/skills

✓ 成功部署: 3 个 Skill
  - skill-a
  - skill-b
  - skill-c

✓ 初始化完成！
```

### 步骤 3: 测试 create 命令（交互式）

```bash
# 交互式创建 Skill
quick-skill create

# 或指定分类创建（跳过分类选择）
quick-skill create --category public
```

**交互流程**：
1. 业务分类选择（如果未指定 --category）
2. Skill 名称和描述输入
3. 触发边界定义（When to use / When NOT to use）
4. 成功标准定义（What to build / Definition of done）
5. 执行步骤定义（可选）

**预期输出**：
```
=== Skill 创建向导 (创建模式) ===

=== 业务分类选择 ===
选择业务分类:
  public
  需求分析
  + 创建新分类

✓ 已选择分类: public

=== Skill 使命定义 ===
Skill 名称（kebab-case 格式）: my-test-skill
✓ 名称: my-test-skill
Skill 描述（简要说明 Skill 的用途）: A test skill for verification
✓ 描述: A test skill for verification

=== 触发边界定义 ===
When to use this（何时使用此 Skill）: Use for testing
When NOT to use this（何时不应使用此 Skill）: Not for production
✓ 触发边界已定义

=== 成功标准定义 ===
What to build（产出物、规范要求、用户约束）: Test artifacts
Definition of done（可量化的完成标准）: All tests pass
✓ 成功标准已定义

=== 执行步骤定义 ===
是否跳过执行步骤定义？ Yes

=== 创建完成 ===
✓ SKILL.md 已生成: skills/public/my-test-skill/SKILL.md
✓ evals/ 目录已创建
```

### 步骤 4: 验证生成的文件

```bash
# 查看 create 命令生成的文件结构
ls -la skills/public/my-test-skill/

# 查看 SKILL.md 内容
cat skills/public/my-test-skill/SKILL.md

# 查看 evals 目录
ls -la skills/public/my-test-skill/evals/
```

**预期文件结构**：
```
skills/
  public/
    my-test-skill/
      SKILL.md
      evals/
```

**SKILL.md 示例内容**：
```markdown
---
name: my-test-skill
description: A test skill for verification
---

# When to use this
Use for testing

# When NOT to use this
Not for production

# What to build
Test artifacts

# Definition of done
All tests pass
```

### 步骤 5: 运行自动化测试

```bash
# 运行所有单元测试
npm test

# 运行特定测试
npm test -- --grep "init"
npm test -- --grep "create"
npm test -- --grep "skill-md"
```

**预期测试结果**：
```
Test Files  13 passed (13)
Tests       71 passed (71)
Duration    ~3s
```

## 验证清单

使用以下清单确认所有功能正常：

### 编译验证
- [ ] TypeScript 编译成功 (`npm run build`)
- [ ] dist 目录存在
- [ ] dist/cli.js 存在
- [ ] 所有源文件都已编译

### 全局链接验证
- [ ] npm link 成功
- [ ] `quick-skill --help` 显示帮助信息
- [ ] `quick-skill init --help` 显示 init 帮助
- [ ] `quick-skill create --help` 显示 create 帮助

### init 命令验证
- [ ] 交互式 Agent 选择正常
- [ ] Claude 目标目录创建正常
- [ ] Skills 平铺部署成功
- [ ] 同名 Skill 覆盖正常
- [ ] 非 Skill 文件保留正常
- [ ] 部署报告输出正常

### create 命令验证
- [ ] 业务分类选择正常
- [ ] 名称 kebab-case 转换正常
- [ ] 同名 Skill 重复检测正常
- [ ] SKILL.md 文件生成正常
- [ ] evals 目录创建正常
- [ ] YAML front matter 格式正确
- [ ] 6 大标准章节填充正确

### 测试覆盖验证
- [ ] 所有单元测试通过
- [ ] 71 个测试全部成功
- [ ] 无测试失败或跳过

## 常见问题解决

### 问题 1: npm link 失败

**解决方案**：
```bash
# 清除旧链接
npm unlink -g quick-skill

# 重新创建链接
npm link
```

### 问题 2: 命令执行报错

**解决方案**：
```bash
# 重新编译
npm run build

# 检查 dist 文件
ls dist/cli.js

# 使用 node 直接运行
node dist/cli.js init
```

### 问题 3: Skills 目录为空

**当前状态**：skills 目录有 3 个测试 Skill

如果需要添加更多测试 Skills：
```bash
# 创建测试 Skill
mkdir -p skills/public/test-skill
echo "name: test-skill
description: A test skill
---
# When to use this
For testing" > skills/public/test-skill/SKILL.md
```

### 问题 4: create 命令找不到 skills 目录

**解决方案**：
```bash
# 确保 skills 目录存在
mkdir -p skills/public

# 或在 create 时指定 category 参数
quick-skill create --category public
```

## 下一步测试建议

1. **测试不同 Agent 目标**：
   ```bash
   quick-skill init  # 选择 Claude
   quick-skill init  # 选择 OpenCode
   quick-skill init  # 选择 Relay
   ```

2. **测试不同分类创建**：
   ```bash
   quick-skill create --category public
   quick-skill create --category requirements
   ```

3. **测试边界场景**：
   ```bash
   # 空 Skills 源测试
   # 同名 Skill 覆盖测试
   # kebab-case 转换测试
   ```

4. **查看生成的文件**：
   ```bash
   # 查看 Claude 目录
   ls claude/skills/
   
   # 查看 OpenCode 目录
   ls opencode/skills/
   
   # 查看创建的 Skill
   cat skills/public/my-skill/SKILL.md
   ```

## 清理测试环境

如果需要清理测试产生的文件：

```bash
# 清理 Agent 目录
rm -rf claude opencode .relay

# 清理测试 Skill
rm -rf skills/public/my-test-skill

# 清理全局链接
npm unlink -g quick-skill
```

---

**验证状态**: ✅ 所有核心功能已验证可用

**测试命令**: `node scripts/quick-verify.js`

**下一步**: 开始使用 quick-skill 进行实际开发