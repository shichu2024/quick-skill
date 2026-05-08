# 用户故事

## 索引

| ID | 标题 | 优先级 | 状态 | 依赖 |
|----|-------|----------|--------|------|
| ST-001 | 组装发布包内容并发布到 npm 仓库 | P2 | ready | - |
| ST-002 | 发布前评测门禁 | P2 | ready | ST-001 |
| ST-003 | 语义化版本号校验与管理 | P2 | ready | - |
| ST-004 | 发布包文件边界控制 | P2 | ready | - |

## ST-001 组装发布包内容并发布到 npm 仓库

```yaml
id: ST-001
title: 组装发布包内容并发布到 npm 仓库
priority: P2
status: ready
depends_on: []
```

### 故事

作为 quick-skill 维护者，我希望通过一条 `quick-skill publish` 命令将 CLI 可执行入口、完整 Skill 源和正确配置的 package.json 打包发布到 npm 仓库，以便终端用户可以通过 npm install 获取并使用 quick-skill CLI。

### 验收标准

- `AC-1`: Given 执行 `quick-skill publish`，When 发布流程开始，Then 自动组装发布内容：CLI 可执行入口文件、完整的 skills/ 目录（含所有分类子目录、SKILL.md、evals/）、package.json
- `AC-2`: Given 发布包中的 package.json，When npm 发布完成，Then package.json 包含正确的 bin 字段，终端用户安装后可直接执行 `quick-skill` 命令
- `AC-3`: Given 发布到公共 npm 仓库，When 执行 `npm i quick-skill -g`，Then 安装后的 CLI 包含完整的 skills/ 目录结构，init 命令可正常部署所有 Skill
- `AC-4`: Given 发布到私有 npm 仓库，When 用户配置了正确的 registry URL 和认证信息，Then 发布流程正常完成，终端用户可通过配置 registry 安装

### 范围外

- npm 账号登录和认证管理
- 多包（monorepo）发布
- CI/CD 管道集成

---

## ST-002 发布前评测门禁

```yaml
id: ST-002
title: 发布前评测门禁
priority: P2
status: ready
depends_on: [ST-001]
```

### 故事

作为 quick-skill 维护者，我希望在发布前自动执行全量 Skill 评测（`quick-skill eval --all`），仅当所有 Skill 评测通过后才允许发布，以防止不合规的 Skill 进入 npm 仓库。

### 验收标准

- `AC-1`: Given 发布前评测门禁已启用，When 执行 `quick-skill publish`，Then 自动调用 FEAT-006 eval 的 `quick-skill eval --all` 执行全量评测
- `AC-2`: Given 全量评测中所有 Skill 均通过，When 评测完成，Then 发布流程继续执行
- `AC-3`: Given 全量评测中存在任何 Skill 未通过，When 评测完成，Then 发布流程终止，输出评测失败摘要和详细报告路径
- `AC-4`: Given 发布前评测门禁，When 用户需要紧急发布，Then 可通过配置或参数跳过评测门禁，但跳过操作需在发布日志中明确记录

### 范围外

- 评测门禁的通过阈值自定义配置
- 评测失败时的自动修复能力
- 评测结果的持久化归档（属于 FEAT-006 范畴）

---

## ST-003 语义化版本号校验与管理

```yaml
id: ST-003
title: 语义化版本号校验与管理
priority: P2
status: ready
depends_on: []
```

### 故事

作为 quick-skill 维护者，我希望 publish 命令在发布前校验版本号是否符合 Semantic Versioning 规范（MAJOR.MINOR.PATCH），并检查是否与 npm 仓库已有版本冲突，以避免发布失败或版本管理混乱。

### 验收标准

- `AC-1`: Given package.json 中的版本号符合 SemVer 格式（MAJOR.MINOR.PATCH），When 执行发布，Then 版本校验通过，继续发布流程
- `AC-2`: Given package.json 中的版本号不符合 SemVer 格式，When 执行发布，Then 终止发布并输出版本号格式错误提示，明确指出当前版本号和期望格式
- `AC-3`: Given npm 仓库中已存在与当前版本号相同的已发布版本，When 执行发布，Then 终止发布并输出版本冲突提示，建议递增版本号
- `AC-4`: Given 版本号校验和冲突检查均通过，When npm publish 执行，Then 包以正确的版本号成功发布到目标仓库

### 范围外

- 自动判断 MAJOR/MINOR/PATCH 的版本递增策略
- CHANGELOG 自动生成
- Git tag 自动创建

---

## ST-004 发布包文件边界控制

```yaml
id: ST-004
title: 发布包文件边界控制
priority: P2
status: ready
depends_on: []
```

### 故事

作为 quick-skill 维护者，我希望发布包严格包含运行时必需的文件（CLI 入口、Skill 源、package.json），排除所有开发环境文件，以确保发布包体积最小且不泄露开发环境信息。

### 验收标准

- `AC-1`: Given 发布包已组装完成，When 检查包内容，Then 包含 CLI 可执行入口文件、完整 skills/ 目录（含所有分类子目录中的 SKILL.md 和 evals/）、package.json
- `AC-2`: Given 发布包已组装完成，When 检查包内容，Then 不包含 node_modules/、.git/、测试临时文件、IDE 配置文件等开发环境文件
- `AC-3`: Given skills/ 目录下存在某个分类子目录，When 发布包组装，Then 该分类子目录下的所有 Skill 目录（含 SKILL.md 和 evals/ 子目录）均被完整包含在发布包中
- `AC-4`: Given 发布包不完整（缺少关键文件如 skills/ 目录或 bin 入口），When 执行发布，Then 终止发布并输出缺少关键文件的错误提示

### 范围外

- 发布包内容的自定义过滤规则
- 发布包大小的阈值控制和警告
- 发布包的签名校验
