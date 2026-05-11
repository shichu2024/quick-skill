import { describe, it, expect } from 'vitest';
import { parseConstraint } from '../../../src/core/constraint-parser.js';
import type { ConstraintType, ParsedConstraint } from '../../../src/types/constraint.js';

describe('parseConstraint', () => {
  // ===== AC-005-1: 识别正向触发约束 =====
  describe('AC-005-1: 正向触发约束 (positive-trigger)', () => {
    it('识别中文正向触发关键词', () => {
      const result = parseConstraint('当用户需要处理大量数据时可使用此技能');
      expect(result.categories).toContain('positive-trigger');
      expect(result.targetSections).toContain('When to use this');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"如果"开头的触发条件', () => {
      const result = parseConstraint('如果你的项目使用 TypeScript，这个技能很有用');
      expect(result.categories).toContain('positive-trigger');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"适用"场景', () => {
      const result = parseConstraint('此技能适用于需要自动化代码审查的场景');
      expect(result.categories).toContain('positive-trigger');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别英文 when/use 触发条件', () => {
      const result = parseConstraint('When you need to parse markdown files, use this skill');
      expect(result.categories).toContain('positive-trigger');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"可使用"触发条件', () => {
      const result = parseConstraint('当需要批量处理文件时可使用此工具');
      expect(result.categories).toContain('positive-trigger');
      expect(result.isAmbiguous).toBe(false);
    });
  });

  // ===== AC-005-2: 识别负向禁止约束 =====
  describe('AC-005-2: 负向禁止约束 (negative-prohibition)', () => {
    it('识别"禁止"关键词', () => {
      const result = parseConstraint('禁止在生产环境中使用调试模式');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.targetSections).toContain('When NOT to use this');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"不要"关键词', () => {
      const result = parseConstraint('不要在数据量小于 100 条时使用此技能');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"避免"关键词', () => {
      const result = parseConstraint('避免在并发场景下调用此接口');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"不能"关键词', () => {
      const result = parseConstraint('不能在未授权的情况下访问此资源');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别英文 never/avoid/don\'t 禁止条件', () => {
      const result = parseConstraint('Never use this in production without authentication');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"不应"关键词', () => {
      const result = parseConstraint('不应在测试环境中使用真实用户数据');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.isAmbiguous).toBe(false);
    });
  });

  // ===== AC-005-3: 识别成功标准约束 =====
  describe('AC-005-3: 成功标准约束 (success-criteria)', () => {
    it('识别"必须"关键词（成功标准语境）', () => {
      const result = parseConstraint('必须生成符合 ESLint 规范的产出');
      expect(result.categories).toContain('success-criteria');
      expect(result.targetSections).toContain('Definition of done');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"确保"关键词', () => {
      const result = parseConstraint('确保所有测试用例通过率达到 100%');
      expect(result.categories).toContain('success-criteria');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"验证"关键词', () => {
      const result = parseConstraint('验证输出格式必须符合 JSON Schema');
      expect(result.categories).toContain('success-criteria');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"标准"关键词', () => {
      const result = parseConstraint('完成标准是生成的代码可以通过所有单元测试');
      expect(result.categories).toContain('success-criteria');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别英文 must/ensure/verify 成功条件', () => {
      const result = parseConstraint('Must ensure all outputs are validated against the schema');
      expect(result.categories).toContain('success-criteria');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"产出"关键词', () => {
      const result = parseConstraint('最终产出必须包含完整的类型定义');
      expect(result.categories).toContain('success-criteria');
      expect(result.isAmbiguous).toBe(false);
    });
  });

  // ===== AC-005-4: 识别执行流程约束 =====
  describe('AC-005-4: 执行流程约束 (execution-flow)', () => {
    it('识别"步骤"关键词', () => {
      const result = parseConstraint('构建步骤：先编译 TypeScript，再打包');
      expect(result.categories).toContain('execution-flow');
      expect(result.targetSections).toContain('What to build');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"流程"关键词', () => {
      const result = parseConstraint('部署流程：先推送到 staging，验证后再发布到 production');
      expect(result.categories).toContain('execution-flow');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"先...然后"顺序结构', () => {
      const result = parseConstraint('先安装依赖，然后运行构建命令');
      expect(result.categories).toContain('execution-flow');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别工具选择约束', () => {
      const result = parseConstraint('必须使用 pnpm 进行包管理，禁止使用 npm');
      // 同时匹配执行流程和负向禁止
      expect(result.categories).toContain('execution-flow');
      expect(result.categories).toContain('negative-prohibition');
    });

    it('识别英文 step/process/flow 流程条件', () => {
      const result = parseConstraint('Build process: first run tests, then deploy');
      expect(result.categories).toContain('execution-flow');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"使用"工具约束', () => {
      const result = parseConstraint('使用 Vite 作为构建工具');
      expect(result.categories).toContain('execution-flow');
      expect(result.isAmbiguous).toBe(false);
    });
  });

  // ===== AC-005-5: 识别风格规范约束 =====
  describe('AC-005-5: 风格规范约束 (style-norm)', () => {
    it('识别"风格"关键词', () => {
      const result = parseConstraint('代码风格必须遵循 Airbnb 规范');
      expect(result.categories).toContain('style-norm');
      expect(result.targetSections).toContain('What to build');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"命名"关键词', () => {
      const result = parseConstraint('所有组件命名必须使用 PascalCase');
      expect(result.categories).toContain('style-norm');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"格式"关键词', () => {
      const result = parseConstraint('日志格式必须包含时间戳和日志级别');
      expect(result.categories).toContain('style-norm');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"写法"关键词', () => {
      const result = parseConstraint('所有组件必须使用函数式写法');
      expect(result.categories).toContain('style-norm');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别"约定"关键词', () => {
      const result = parseConstraint('遵循项目约定的目录结构');
      expect(result.categories).toContain('style-norm');
      expect(result.isAmbiguous).toBe(false);
    });

    it('识别英文 style/naming/convention 风格条件', () => {
      const result = parseConstraint('All components must follow the naming convention of PascalCase');
      expect(result.categories).toContain('style-norm');
      expect(result.isAmbiguous).toBe(false);
    });
  });

  // ===== AC-005-6: 无法分类时 isAmbiguous=true =====
  describe('AC-005-6: 无法分类时标记为模糊', () => {
    it('纯描述性语句无法分类', () => {
      const result = parseConstraint('这个技能很有趣');
      expect(result.isAmbiguous).toBe(true);
      expect(result.categories).toHaveLength(0);
    });

    it('无关键词的通用语句', () => {
      const result = parseConstraint('今天天气很好');
      expect(result.isAmbiguous).toBe(true);
      expect(result.categories).toHaveLength(0);
    });

    it('过于抽象的短语', () => {
      const result = parseConstraint('好的代码');
      expect(result.isAmbiguous).toBe(true);
      expect(result.categories).toHaveLength(0);
    });

    it('空字符串返回模糊', () => {
      const result = parseConstraint('');
      expect(result.isAmbiguous).toBe(true);
      expect(result.categories).toHaveLength(0);
    });
  });

  // ===== AC-005-7: 一条约束可匹配多分类 =====
  describe('AC-005-7: 一条约束可匹配多分类', () => {
    it('同时匹配正向触发和风格规范', () => {
      const result = parseConstraint('当开发 React 组件时，所有组件必须使用函数式写法');
      expect(result.categories.length).toBeGreaterThanOrEqual(2);
      expect(result.categories).toContain('positive-trigger');
      expect(result.categories).toContain('style-norm');
    });

    it('同时匹配成功标准和风格规范', () => {
      const result = parseConstraint('必须确保代码风格符合规范且所有测试通过');
      expect(result.categories.length).toBeGreaterThanOrEqual(2);
      expect(result.categories).toContain('success-criteria');
      expect(result.categories).toContain('style-norm');
    });

    it('同时匹配执行流程和负向禁止', () => {
      const result = parseConstraint('构建流程必须先运行测试，禁止跳过测试直接部署');
      expect(result.categories.length).toBeGreaterThanOrEqual(2);
      expect(result.categories).toContain('execution-flow');
      expect(result.categories).toContain('negative-prohibition');
    });

    it('多分类时 isAmbiguous 为 false', () => {
      const result = parseConstraint('当需要构建 API 时，必须使用 RESTful 风格且确保响应格式统一');
      expect(result.isAmbiguous).toBe(false);
      expect(result.categories.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===== 通用验证 =====
  describe('通用验证', () => {
    it('返回的 original 字段与输入一致', () => {
      const input = '当用户需要处理数据时使用此技能';
      const result = parseConstraint(input);
      expect(result.original).toBe(input);
    });

    it('targetSections 与 categories 对应关系正确', () => {
      const result = parseConstraint('禁止在生产环境使用');
      expect(result.categories).toContain('negative-prohibition');
      expect(result.targetSections).toContain('When NOT to use this');
    });

    it('正向触发对应 When to use this 章节', () => {
      const result = parseConstraint('当需要时使用');
      expect(result.categories).toContain('positive-trigger');
      expect(result.targetSections).toContain('When to use this');
    });

    it('成功标准对应 Definition of done 章节', () => {
      const result = parseConstraint('必须确保测试通过');
      expect(result.categories).toContain('success-criteria');
      expect(result.targetSections).toContain('Definition of done');
    });

    it('执行流程对应 What to build 章节', () => {
      const result = parseConstraint('使用 Vite 构建');
      expect(result.categories).toContain('execution-flow');
      expect(result.targetSections).toContain('What to build');
    });

    it('风格规范对应 What to build 章节', () => {
      const result = parseConstraint('遵循命名规范');
      expect(result.categories).toContain('style-norm');
      expect(result.targetSections).toContain('What to build');
    });

    it('无法分类时 targetSections 为空数组', () => {
      const result = parseConstraint('这是一句无关的话');
      expect(result.targetSections).toHaveLength(0);
    });
  });
});
