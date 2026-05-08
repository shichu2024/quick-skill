---
id: FEAT-008
title: publish -- Skill源打包与npm发布
type: feature
priority: P2
depends_on: [FEAT-006]
---

# 提案

## 问题

- quick-skill 作为一个 npm CLI 工具，需要将 CLI 可执行入口和完整 Skill 源打包发布到 npm 仓库，当前缺乏标准化的发布流程和工具
- 发布到 npm 仓库的包可能包含不合规的 Skill（如评测未通过），缺乏发布前质量门禁
- 版本号管理依赖人工维护，容易违反语义化版本规范（SemVer）
- 发布包内容边界不清晰，可能误包含开发环境文件或遗漏关键 Skill 资源

## 目标

- 提供一条 `quick-skill publish` 命令，将 CLI 可执行入口、完整 Skill 源（含 SKILL.md 和 evals/）、配置了 bin 字段的 package.json 打包并发布到 npm 仓库
- 支持发布到公共 npm 仓库或 quick-skill 私有 npm 仓库
- 内置发布前评测门禁：支持配置发布前自动执行 `quick-skill eval --all`，全量评测通过后方可发布
- 遵循 Semantic Versioning 规范，确保版本号递增可追溯

## 范围内

- `quick-skill publish` 命令的完整发布流程
- 发布内容组装：CLI 可执行入口 + 完整 skills/ 目录（含所有分类子目录、SKILL.md、evals/）+ 含 bin 字段的 package.json
- npm 仓库选择：公共 npm 仓库（npmjs.com）和私有 npm 仓库
- 语义化版本管理：MAJOR.MINOR.PATCH 格式
- 发布前评测门禁：调用 FEAT-006 eval 的 `quick-skill eval --all` 能力，全量通过后方可继续发布
- 发布包的文件边界控制：不包含开发环境文件（如 node_modules、.git、测试临时文件等）

## 范围外

- npm 账号认证和登录流程（由 npm CLI 本身处理）
- 自动化版本号递增策略（自动判断 MAJOR/MINOR/PATCH）
- CHANGELOG 自动生成
- CI/CD 管道集成（GitHub Actions、GitLab CI 等）
- 多包（monorepo）发布管理
- 发包后的版本回滚（npm unpublish）

## 风险

- 依赖 FEAT-006 eval 模块的评测能力，若 FEAT-006 未就绪，发布门禁无法生效
- 评测门禁作为前置条件会显著增加发布耗时，全量 Skill 评测可能在大型 Skill 集上耗时较长
- 私有 npm 仓库的认证配置（.npmrc、token 等）因环境差异可能导致发布失败
- 发布包遗漏 Skill 源文件或误包含开发文件，直接影响终端用户的 init 命令可用性
- 版本号冲突（npm 仓库已存在同版本号）导致发布失败

## 待确认问题

- 发布前评测门禁是默认启用还是需要通过配置开关启用？如果默认启用，是否提供 `--skip-eval` 参数以支持紧急发布？
- 私有 npm 仓库的 registry URL 和认证方式是否有标准约定，还是完全由用户通过 .npmrc 配置？
- 版本号是由用户在发布前手动修改 package.json，还是 publish 命令提供版本号交互式输入或参数？
- 发布失败后是否需要自动回滚已推送到 npm 临时文件或中间产物？
- 发布包是否需要包含每个 Skill 的 evals/ 目录，还是仅发布 Skill 源本身（SKILL.md + 资源文件）？
