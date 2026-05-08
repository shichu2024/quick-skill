import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SkillMdWriter } from '../../../dist/core/create/skill-md-writer.js';
import type { SkillFormData } from '../../../dist/core/create/types.js';

describe('skill-md-writer', () => {
  let writer: SkillMdWriter;
  let tempSkillsPath: string;

  beforeEach(() => {
    tempSkillsPath = path.join(process.cwd(), 'temp-test-skills');
    fs.mkdirSync(tempSkillsPath, { recursive: true });
    writer = new SkillMdWriter(tempSkillsPath);
  });

  afterEach(() => {
    fs.rmSync(tempSkillsPath, { recursive: true, force: true });
  });

  describe('SkillMdWriter', () => {
    it('should create SKILL.md file with all sections', async () => {
      const formData: SkillFormData = {
        category: 'test-category',
        name: 'test-skill',
        description: 'A test skill',
        whenToUse: 'Use when testing',
        whenNotToUse: 'Not for production',
        whatToBuild: 'Test artifacts',
        steps: '1. Test\n2. Verify',
        definitionOfDone: 'All pass',
      };

      const skillMdPath = await writer.create(formData);

      expect(fs.existsSync(skillMdPath)).toBe(true);
      expect(skillMdPath).toContain('test-category');
      expect(skillMdPath).toContain('test-skill');
      expect(skillMdPath).toContain('SKILL.md');

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      expect(content).toContain('name: test-skill');
      expect(content).toContain('description: A test skill');
    });

    it('should create evals directory', async () => {
      const formData: SkillFormData = {
        category: 'test-category',
        name: 'test-skill',
        description: 'A test skill',
      };

      await writer.create(formData);

      const evalsPath = path.join(tempSkillsPath, 'test-category', 'test-skill', 'evals');
      expect(fs.existsSync(evalsPath)).toBe(true);
    });

    it('should throw error when category or name missing', async () => {
      const formData: SkillFormData = {
        description: 'Missing category and name',
      };

      await expect(writer.create(formData)).rejects.toThrow('category 和 name 为必填字段');
    });

    it('should handle existing skill directory', async () => {
      const formData: SkillFormData = {
        category: 'existing-category',
        name: 'existing-skill',
        description: 'An existing skill',
      };

      // 第一次创建
      await writer.create(formData);

      // 第二次创建（覆盖）
      const skillMdPath = await writer.create(formData);
      expect(fs.existsSync(skillMdPath)).toBe(true);
    });
  });
});