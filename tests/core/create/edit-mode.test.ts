import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EditMode } from '../../../src/core/create/edit-mode.js';
import { SkillLoader } from '../../../src/core/create/skill-loader.js';
import type { SkillFormData } from '../../../src/core/create/types.js';

// Mock inquirer to avoid interactive prompts in tests
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';

const mockPrompt = vi.mocked(inquirer.prompt);

/** 辅助函数：创建按顺序返回指定值的 mock */
function mockAnswers(values: string[]) {
  values.forEach((v) => {
    mockPrompt.mockResolvedValueOnce({ value: v });
  });
}

describe('edit-mode', () => {
  let editMode: EditMode;
  let tempSkillsPath: string;

  beforeEach(() => {
    tempSkillsPath = path.join(process.cwd(), 'temp-test-skills-edit');
    fs.mkdirSync(tempSkillsPath, { recursive: true });
    const loader = new SkillLoader(tempSkillsPath);
    editMode = new EditMode(loader, tempSkillsPath);
    mockPrompt.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tempSkillsPath, { recursive: true, force: true });
  });

  describe('loadSkill', () => {
    it('should throw error when skill does not exist', async () => {
      await expect(editMode.loadSkill('non-existent')).rejects.toThrow(
        '未找到 Skill: non-existent'
      );
    });

    it('should load existing skill and return SkillFormData', async () => {
      const skillDir = path.join(tempSkillsPath, 'load-cat', 'load-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
name: load-skill
description: A loadable skill
---

# When to use this

Loading skills
`
      );

      const result = await editMode.loadSkill('load-skill');

      expect(result.name).toBe('load-skill');
      expect(result.description).toBe('A loadable skill');
      expect(result.whenToUse).toContain('Loading skills');
      expect(result.category).toBe('load-cat');
    });
  });

  describe('runEditFlow', () => {
    // 8 个字段：category, name, description, whenToUse, whenNotToUse, whatToBuild, steps, definitionOfDone

    it('should return unchanged data when user keeps all values', async () => {
      const currentData: SkillFormData = {
        category: 'edit-cat',
        name: 'edit-skill',
        description: 'Original description',
        whenToUse: 'Original whenToUse',
      };

      // 模拟用户全部按 Enter 保留原值（空字符串 = 不修改）
      mockAnswers(['', '', '', '', '', '', '', '']);

      // 全部未修改应抛出错误
      await expect(editMode.runEditFlow(currentData)).rejects.toThrow(
        '未做任何修改'
      );
    });

    it('should apply user modifications to fields', async () => {
      const currentData: SkillFormData = {
        category: 'old-cat',
        name: 'old-name',
        description: 'Old description',
      };

      // 第 3 个字段 (description) 修改为新值，其余保留
      mockAnswers(['', '', 'New description', '', '', '', '', '']);

      const result = await editMode.runEditFlow(currentData);

      expect(result.description).toBe('New description');
      expect(result.name).toBe('old-name');
      expect(result.category).toBe('old-cat');
    });

    it('should allow changing category', async () => {
      const currentData: SkillFormData = {
        category: 'old-category',
        name: 'test-skill',
        description: 'Test',
      };

      // 第 1 个字段 (category) 修改
      mockAnswers(['new-category', '', '', '', '', '', '', '']);

      const result = await editMode.runEditFlow(currentData);

      expect(result.category).toBe('new-category');
    });

    it('should require at least one modification to proceed', async () => {
      const currentData: SkillFormData = {
        category: 'req-cat',
        name: 'req-skill',
        description: 'Required test',
      };

      // 全部保留原值
      mockAnswers(['', '', '', '', '', '', '', '']);

      await expect(editMode.runEditFlow(currentData)).rejects.toThrow(
        '未做任何修改'
      );
    });

    it('should handle empty input as "keep original" for undefined fields', async () => {
      const currentData: SkillFormData = {
        category: 'undef-cat',
        name: 'undef-skill',
        description: 'Has description',
        // whenToUse etc. are undefined
      };

      // 全部未修改
      mockAnswers(['', '', '', '', '', '', '', '']);

      await expect(editMode.runEditFlow(currentData)).rejects.toThrow(
        '未做任何修改'
      );
    });

    it('should modify multiple fields at once', async () => {
      const currentData: SkillFormData = {
        category: 'multi-cat',
        name: 'multi-skill',
        description: 'Old desc',
        whenToUse: 'Old whenToUse',
      };

      // 修改 description 和 whenToUse
      mockAnswers(['', '', 'New desc', 'New whenToUse', '', '', '', '']);

      const result = await editMode.runEditFlow(currentData);

      expect(result.description).toBe('New desc');
      expect(result.whenToUse).toBe('New whenToUse');
      expect(result.category).toBe('multi-cat');
    });

    it('should preserve original values for fields not modified', async () => {
      const currentData: SkillFormData = {
        category: 'preserve-cat',
        name: 'preserve-skill',
        description: 'Keep this',
        whenToUse: 'Keep this too',
        whenNotToUse: 'And this',
      };

      // 只修改 steps
      mockAnswers(['', '', '', '', '', '', 'New steps content', '']);

      const result = await editMode.runEditFlow(currentData);

      expect(result.category).toBe('preserve-cat');
      expect(result.name).toBe('preserve-skill');
      expect(result.description).toBe('Keep this');
      expect(result.whenToUse).toBe('Keep this too');
      expect(result.whenNotToUse).toBe('And this');
      expect(result.steps).toBe('New steps content');
    });
  });
});
