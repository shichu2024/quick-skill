# 技能合规诊断报告

| 项目 | 值 |
|------|-----|
| 技能名称 | quick-sdd |
| 技能路径 | D:\code\github\quick-skill\.opencode\skills\quick-sdd |
| 诊断时间 | 2026-05-08T12:30:21.964Z |
| 检查维度 | 7 |

## 合规评分

**总分: 90/100**

**等级: 优秀**

### 各维度评分

| 维度 | 分数 | 状态 |
|------|------|------|
| structure | 100 | ✅ |
| metadata | 85 | ❌ |
| boundary | 85 | ❌ |
| standard | 85 | ❌ |
| format | 86.66666666666667 | ❌ |
| evaluation | 86.66666666666667 | ❌ |
| compatibility | 100 | ✅ |

## 维度详情

### ❌ metadata

- **状态**: fail
- **描述**: SKILL.md 缺少 YAML front matter
- **修复等级**: required
- **可自动修复**: 否

### ❌ boundary

- **状态**: fail
- **描述**: 边界合规性检查失败
- **详情**: 缺少 "When to use this" 章节; 缺少 "When NOT to use this" 章节
- **修复等级**: required
- **可自动修复**: 否

### ❌ standard

- **状态**: fail
- **描述**: 标准合规性检查失败
- **详情**: 缺少 "Definition of done" 章节
- **修复等级**: required
- **可自动修复**: 否

### ❌ format

- **状态**: fail
- **描述**: 格式合规性检查失败
- **详情**: 文件/目录名 "agents\openai.yaml" 包含特殊字符或空格; 文件/目录名 "references\dispatcher-resolution-spec.md" 包含特殊字符或空格; 文件/目录名 "references\role-capability-playbook.md" 包含特殊字符或空格; 文件/目录名 "scripts\init_codespec.py" 不符合 kebab-case 规范; 文件/目录名 "scripts\init_codespec.py" 包含特殊字符或空格 等36个问题
- **修复等级**: recommended
- **可自动修复**: 是
- **修复动作**: rename files

### ❌ evaluation

- **状态**: fail
- **描述**: evals/ 目录不存在
- **详情**: 技能缺少评测用例目录
- **修复等级**: recommended
- **可自动修复**: 否

### ✅ structure

- **状态**: pass
- **描述**: 结构合规性检查通过

### ✅ compatibility

- **状态**: pass
- **描述**: 兼容性合规性检查通过


## 改造清单

### 🔧 可自动修复项

1. **[format]** 格式合规性检查失败 - 文件/目录名 "agents\openai.yaml" 包含特殊字符或空格; 文件/目录名 "references\dispatcher-resolution-spec.md" 包含特殊字符或空格; 文件/目录名 "references\role-capability-playbook.md" 包含特殊字符或空格; 文件/目录名 "scripts\init_codespec.py" 不符合 kebab-case 规范; 文件/目录名 "scripts\init_codespec.py" 包含特殊字符或空格 等36个问题
   - 修复动作: rename files
   - 修复等级: recommended
   - 预期效果: 统一命名规范，提升代码库一致性

### ⚠️ 需人工确认项

1. **[metadata]** SKILL.md 缺少 YAML front matter
   - 修复等级: required
   - 预期效果: 确保技能元数据完整，便于识别和管理
   - 处理建议: 请根据技能业务逻辑手动调整
2. **[boundary]** 边界合规性检查失败 - 缺少 "When to use this" 章节; 缺少 "When NOT to use this" 章节
   - 修复等级: required
   - 预期效果: 明确技能使用边界，避免误用
   - 处理建议: 请根据技能业务逻辑手动调整
3. **[standard]** 标准合规性检查失败 - 缺少 "Definition of done" 章节
   - 修复等级: required
   - 预期效果: 建立可量化的完成标准，提升质量可控性
   - 处理建议: 请根据技能业务逻辑手动调整
4. **[evaluation]** evals/ 目录不存在 - 技能缺少评测用例目录
   - 修复等级: recommended
   - 预期效果: 完善测试用例覆盖，提升技能可靠性
   - 处理建议: 请根据技能业务逻辑手动调整
