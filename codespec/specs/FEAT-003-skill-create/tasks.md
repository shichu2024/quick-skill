# 任务清单

## 索引

| ID | Story | 标题 | 状态 | 依赖 | 负责人 |
|----|-------|------|------|------|--------|
| T-001 | - | CLI 命令注册与交互式框架基础 | done | - | dev |
| T-002 | ST-001 | 业务分类选择引导步骤 | done | T-001 | dev |
| T-003 | ST-001 | Skill 使命定义引导步骤 | done | T-001 | dev |
| T-004 | ST-001 | 触发边界与成功标准引导步骤 | done | T-001 | dev |
| T-005 | ST-001 | 执行步骤引导步骤 | done | T-001 | dev |
| T-006 | ST-002 | 交互式编辑模式 | done | T-001 | dev |
| T-007 | ST-003 | SKILL.md 标准文件生成器 | done | T-003 | dev |
| T-008 | ST-004 | eval-sync 联动触发集成 | done | T-007 | dev |
| T-009 | ST-005 | 草稿保存与中断恢复 | done | T-001 | dev |
| T-010 | ST-002/ST-004/ST-005 | QA 回流修复：create.ts 集成连线与 mergeContent 补全 | done | T-006,T-008,T-009 | dev |

---

## T-010 QA 回流修复：create.ts 集成连线与 mergeContent 补全

```yaml
id: T-010
story_id: "ST-002,ST-004,ST-005"
title: "QA 回流修复：create.ts 集成连线与 mergeContent 补全"
owner_role: dev
status: in_progress
depends_on: [T-006, T-008, T-009]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-runner.ts
  - src/core/create/edit-mode.ts
  - src/core/create/skill-loader.ts
  - src/core/create/eval-sync-trigger.ts
  - src/core/create/draft-manager.ts
  - src/core/create/skill-md-writer.ts
write_paths:
  - src/commands/create.ts
  - src/core/create/skill-md-writer.ts
  - tests/commands/create.test.ts
verify:
  - type: command
    value: npm run build
  - type: command
    value: npm test -- --grep "create command"
  - type: manual
    value: "quick-skill create --edit <skill-name> 可进入编辑模式"
  - type: manual
    value: "创建/编辑完成后正确提示 eval-sync 联动"
  - type: manual
    value: "中断后重新执行 create 可检测草稿并提示继续/重新开始"
```

### 目标

1. 修复 D-01：`create.ts` 添加 `--edit` 分支，调用 `SkillLoader.findSkill()` → `EditMode.loadSkill()` → `EditMode.runEditFlow()` → `SkillMdWriter.update()`
2. 修复 D-02：`create.ts` 创建 `DraftManager` 实例并注入 `StepRunner`
3. 修复 D-03：`create.ts` 在文件生成/更新完成后调用 `EvalSyncTriggerImpl`
4. 修复 D-04：`skill-md-writer.ts` 的 `mergeContent` 实现真正的章节级合并
5. 修复 D-07：编辑模式调用 `SkillMdWriter.update()` 而非 `create()`
6. 修复 D-06：区分"新建"和"更新"状态的确认信息

### 交付物

- `src/commands/create.ts` -- 完整的创建/编辑/草稿恢复/联动触发集成逻辑
- `src/core/create/skill-md-writer.ts` -- 修复 mergeContent 实现章节级合并
- `tests/commands/create.test.ts` -- 集成测试覆盖各分支

### 备注

- 此 task 为 QA 回流修复任务，不涉及新模块开发
- 所有依赖模块（EditMode、DraftManager、EvalSyncTriggerImpl）均已实现并通过测试
- 重点是正确连线和集成，而非重写

---

## T-001 CLI 命令注册与交互式框架基础

```yaml
id: T-001
story_id: "-"
title: CLI 命令注册与交互式框架基础
owner_role: dev
status: todo
depends_on: []
read_paths:
  - src/cli/**
  - src/core/**
  - src/types/**
write_paths:
  - src/cli/commands/create.ts
  - src/core/create/types.ts
  - src/core/create/step-runner.ts
  - src/core/create/step-registry.ts
verify:
  - type: command
    value: npm run build
  - type: command
    value: npm test -- --grep "create framework"
  - type: manual
    value: "quick-skill create --help 输出正确的命令描述和参数列表"
```

### 目标

1. 建立 `create` CLI 命令入口，注册 `--edit`、`--category` 参数。
2. 实现交互式引导框架抽象层：定义 `CreateStep` 接口、`StepRunner` 调度器、`StepRegistry` 注册机制。
3. 实现创建上下文：在步骤间传递已收集的用户输入。

### 交付物

- `create.ts` -- CLI 命令定义与参数解析
- `types.ts` -- `SkillFormData`、`CreateMode`、`StepResult` 类型定义
- `step-runner.ts` -- 步骤调度器，按序执行注册的步骤
- `step-registry.ts` -- 步骤注册表

### 接口契约

```typescript
type CreateMode = 'create' | 'edit';

interface SkillFormData {
  category?: string;
  name?: string;
  description?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  whatToBuild?: string;
  steps?: string;
  definitionOfDone?: string;
}

interface StepResult {
  stepName: string;
  completed: boolean;
  skipped: boolean;
  data: Partial<SkillFormData>;
}

interface CreateStep {
  name: string;
  isRequired: boolean;
  execute(formData: SkillFormData): Promise<StepResult>;
}
```

### 备注

- 步骤顺序：业务分类 -> 使命定义 -> 触发边界 -> 成功标准 -> 执行步骤 -> 文件生成。
- `--category` 参数允许跳过分类选择步骤。
- `--edit` 参数切换为编辑模式。
- 此 task 不实现具体步骤逻辑，仅定义框架。

---

## T-002 业务分类选择引导步骤

```yaml
id: T-002
story_id: ST-001
title: 业务分类选择引导步骤
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-registry.ts
write_paths:
  - src/core/create/steps/category-step.ts
  - src/core/create/category-resolver.ts
  - tests/unit/create/steps/category-step.test.ts
verify:
  - type: command
    value: npm test -- --grep "category-step"
  - type: manual
    value: "展示已有分类列表供选择，同时支持输入新分类名称"
```

### 目标

1. 实现业务分类选择步骤：展示已有分类列表，支持选择已有分类或输入新分类。
2. 当 `--category` 参数已指定时跳过此步骤。

### 交付物

- `category-step.ts` -- 实现 `CreateStep` 接口的分类选择步骤
- `category-resolver.ts` -- 扫描 `./skills/` 目录获取已有分类列表
- 对应单元测试文件

### 备注

- 分类来源：扫描 `./skills/` 目录下的一级子目录名。
- 交互方式：inquirer.js 的 list 选择 + "创建新分类" 选项。
- 新分类名需校验 kebab-case 格式。
- 此步骤可被 `--category` 参数跳过。

---

## T-003 Skill 使命定义引导步骤

```yaml
id: T-003
story_id: ST-001
title: Skill 使命定义引导步骤
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-registry.ts
write_paths:
  - src/core/create/steps/mission-step.ts
  - src/core/create/name-validator.ts
  - tests/unit/create/steps/mission-step.test.ts
verify:
  - type: command
    value: npm test -- --grep "mission-step"
  - type: manual
    value: "引导输入 name 和 description，name 自动转 kebab-case，校验不重复"
```

### 目标

1. 实现 Skill 使命定义步骤：引导用户输入 `name` 和 `description`。
2. name 自动校验并转换为 kebab-case 格式，不允许为空，不允许与同分类下已有 Skill 同名。
3. 不符合 kebab-case 时自动转换并提示用户确认。

### 交付物

- `mission-step.ts` -- 实现 `CreateStep` 接口的使命定义步骤
- `name-validator.ts` -- name 格式校验、转换、重复检测
- 对应单元测试文件

### 备注

- name 必填，不可跳过。
- description 必填，不可跳过。
- 同名检测范围：`./skills/{category}/` 目录下是否已存在同名的子目录。
- kebab-case 转换：空格和下划线转连字符，转小写，去除特殊字符。
- 转换后提示用户确认转换结果。

---

## T-004 触发边界与成功标准引导步骤

```yaml
id: T-004
story_id: ST-001
title: 触发边界与成功标准引导步骤
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-registry.ts
write_paths:
  - src/core/create/steps/boundary-step.ts
  - src/core/create/steps/standard-step.ts
  - tests/unit/create/steps/boundary-step.test.ts
  - tests/unit/create/steps/standard-step.test.ts
verify:
  - type: command
    value: npm test -- --grep "boundary-step"
  - type: command
    value: npm test -- --grep "standard-step"
  - type: manual
    value: "引导输入 When to use / When NOT to use / What to build / Definition of done"
```

### 目标

1. 实现触发边界定义步骤：引导用户输入 "When to use this" 和 "When NOT to use this"。
2. 实现成功标准定义步骤：引导用户输入 "What to build" 和 "Definition of done"。
3. 每个步骤提供清晰的提示信息和输入示例。

### 交付物

- `boundary-step.ts` -- 实现 `CreateStep` 接口的触发边界步骤
- `standard-step.ts` -- 实现 `CreateStep` 接口的成功标准步骤
- 对应单元测试文件

### 备注

- 两个步骤合并为一个 task 是因为它们都是文本输入类步骤，逻辑相似且体量较小。
- 每个输入项提供提示信息和示例文本。
- "When to use this" 和 "When NOT to use this" 支持多行输入。
- "What to build" 引导用户描述产出物、规范要求、用户约束。
- "Definition of done" 引导用户输入可量化的完成标准。

---

## T-005 执行步骤引导步骤

```yaml
id: T-005
story_id: ST-001
title: 执行步骤引导步骤
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-registry.ts
write_paths:
  - src/core/create/steps/steps-step.ts
  - tests/unit/create/steps/steps-step.test.ts
verify:
  - type: command
    value: npm test -- --grep "steps-step"
  - type: manual
    value: "引导用户输入核心执行步骤，该步骤可跳过标记为可选"
```

### 目标

1. 实现执行步骤定义步骤：引导用户输入核心执行步骤（Steps）。
2. 此步骤为可选步骤，用户可选择跳过。

### 交付物

- `steps-step.ts` -- 实现 `CreateStep` 接口的执行步骤定义
- 对应单元测试文件

### 备注

- `isRequired: false` -- 此步骤可跳过。
- 引导方式：提示用户逐步输入步骤描述，每步完成后询问是否继续添加。
- 跳过时 Steps 章节不写入 SKILL.md，或写入占位模板。

---

## T-006 交互式编辑模式

```yaml
id: T-006
story_id: ST-002
title: 交互式编辑模式
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-runner.ts
write_paths:
  - src/core/create/edit-mode.ts
  - src/core/create/skill-loader.ts
  - tests/unit/create/edit-mode.test.ts
verify:
  - type: command
    value: npm test -- --grep "edit-mode"
  - type: manual
    value: "通过 --edit 加载已有 SKILL.md，按章节展示当前值，用户可逐章节修改"
```

### 目标

1. 实现 `--edit` 编辑模式：加载已有 SKILL.md 内容，按章节展示当前值。
2. 用户可逐章节修改或保留不变，至少修改一个章节才触发文件更新。
3. 写入更新前自动备份上一版本。

### 交付物

- `edit-mode.ts` -- 编辑模式逻辑，复用 StepRunner 但预填当前值
- `skill-loader.ts` -- 解析已有 SKILL.md，提取各章节内容为 `SkillFormData`
- 对应单元测试文件

### 备注

- 编辑模式查找范围：`./skills/` 所有分类子目录。
- 指定的 skill-name 不存在时，输出明确错误提示并终止。
- 每个章节预填当前值，用户按 Enter 保留原值。
- 支持修改 Skill 所属的业务分类。
- 写入前备份：同目录下生成 `SKILL.md.bak`。
- T-002~T-006 可并行开发（共享 T-001 的接口定义）。

---

## T-007 SKILL.md 标准文件生成器

```yaml
id: T-007
story_id: ST-003
title: SKILL.md 标准文件生成器
owner_role: dev
status: todo
depends_on: [T-003]
read_paths:
  - src/core/create/types.ts
write_paths:
  - src/core/create/skill-md-writer.ts
  - src/core/create/templates/skill-md-template.ts
  - tests/unit/create/skill-md-writer.test.ts
verify:
  - type: command
    value: npm test -- --grep "skill-md-writer"
  - type: manual
    value: "生成标准格式 SKILL.md，包含 YAML front matter + 6 大章节，UTF-8 编码"
```

### 目标

1. 实现 SKILL.md 文件生成与更新：根据 `SkillFormData` 生成标准格式的 SKILL.md。
2. 创建模式下生成完整文件，编辑模式下仅更新修改的章节。
3. 创建模式下同步创建 `evals/` 空目录。

### 交付物

- `skill-md-writer.ts` -- 文件写入逻辑（创建/更新）
- `skill-md-template.ts` -- SKILL.md 模板定义（与 FEAT-002 共享格式标准）
- 对应单元测试文件

### 接口契约

```typescript
interface SkillMdWriter {
  create(formData: SkillFormData, targetPath: string): Promise<string>;
  update(existingPath: string, formData: Partial<SkillFormData>): Promise<string>;
}
```

### 备注

- 文件编码：UTF-8。
- 换行符：与项目配置一致（默认 LF）。
- 创建模式目标路径：`./skills/{category}/{skillName}/SKILL.md`。
- 创建模式同步创建：`./skills/{category}/{skillName}/evals/` 空目录。
- 编辑模式：仅更新 formData 中有值的字段，未修改章节保持原内容不变。
- 输出确认信息：文件路径、生成/更新状态。

---

## T-008 eval-sync 联动触发集成

```yaml
id: T-008
story_id: ST-004
title: eval-sync 联动触发集成
owner_role: dev
status: todo
depends_on: [T-007]
read_paths:
  - src/core/create/types.ts
  - src/core/create/skill-md-writer.ts
write_paths:
  - src/core/create/eval-sync-trigger.ts
  - tests/unit/create/eval-sync-trigger.test.ts
verify:
  - type: command
    value: npm test -- --grep "eval-sync-trigger"
  - type: manual
    value: "创建后提示生成用例，编辑后提示同步用例，拒绝不阻塞流程"
```

### 目标

1. 实现 eval-sync 联动触发：创建完成后提示是否生成测试用例（调用 eval-gen），编辑完成后提示是否同步更新用例（调用 eval-sync）。
2. 联动仅为提示性引导，不阻塞创建/编辑流程。
3. 联动调用失败时不影响 Skill 创建/编辑的最终结果。

### 交付物

- `eval-sync-trigger.ts` -- 联动触发逻辑
- 对应单元测试文件

### 接口契约

```typescript
interface EvalSyncTrigger {
  promptGenerateCases(skillPath: string): Promise<void>;
  promptSyncCases(skillPath: string): Promise<void>;
}
```

### 备注

- 创建模式：提示"是否立即生成测试用例" -> 确认后调用 eval-gen。
- 编辑模式：提示"是否同步更新测试用例" -> 确认后调用 eval-sync。
- 用户拒绝或跳过时不执行任何操作。
- eval-sync / eval-gen 不可用时输出降级提示。
- 联动提示仅在 SKILL.md 实际发生变化时出现。

---

## T-009 草稿保存与中断恢复

```yaml
id: T-009
story_id: ST-005
title: 草稿保存与中断恢复
owner_role: dev
status: todo
depends_on: [T-001]
read_paths:
  - src/core/create/types.ts
  - src/core/create/step-runner.ts
write_paths:
  - src/core/create/draft-manager.ts
  - tests/unit/create/draft-manager.test.ts
verify:
  - type: command
    value: npm test -- --grep "draft-manager"
  - type: manual
    value: "每步完成后自动保存草稿，重新执行时检测草稿并提示继续或重新开始"
```

### 目标

1. 实现草稿自动保存：每完成一个步骤，自动保存当前进度。
2. 实现中断恢复：重新执行创建命令时检测草稿，提示"继续上次"或"重新开始"。
3. 创建成功后自动清除草稿。

### 交付物

- `draft-manager.ts` -- 草稿保存、加载、清除逻辑
- 对应单元测试文件

### 接口契约

```typescript
interface DraftData {
  formData: Partial<SkillFormData>;
  completedSteps: string[];
  nextStep: string;
  savedAt: string;
}

interface DraftManager {
  save(draft: DraftData): Promise<void>;
  load(): Promise<DraftData | null>;
  clear(): Promise<void>;
  exists(): Promise<boolean>;
}
```

### 备注

- 草稿存储位置：`{skillPath}/.create-draft.json`。
- 草稿保存内容包括：已完成的分类选择、name、description、各已填写章节内容、已完成的步骤列表、下一步骤名称。
- 选择"继续上次"后从草稿中断的步骤继续，已完成步骤预填草稿内容。
- 选择"重新开始"后清除草稿。
- 仅支持创建模式的草稿恢复，不支持编辑模式。
- T-009 与 T-002~T-008 可并行开发（草稿管理嵌入 StepRunner，与具体步骤逻辑解耦）。
