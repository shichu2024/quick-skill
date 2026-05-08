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

    it('should update only modified chapters (chapter-level merge)', async () => {
      // First create a skill with all sections
      const initialData: SkillFormData = {
        category: 'merge-test',
        name: 'merge-skill',
        description: 'Initial description',
        whenToUse: 'Initial when to use',
        whenNotToUse: 'Initial when not to use',
        whatToBuild: 'Initial what to build',
        steps: 'Initial steps',
        definitionOfDone: 'Initial definition of done',
      };
      const skillMdPath = await writer.create(initialData);
      const skillDir = path.dirname(skillMdPath);

      // Now update only some fields
      const updateData: Partial<SkillFormData> = {
        name: 'merge-skill',
        description: 'Updated description',
        whenToUse: 'Updated when to use',
        // Other fields not included should be preserved
      };
      const updatedPath = await writer.update(skillDir, updateData);

      const updatedContent = fs.readFileSync(updatedPath, 'utf-8');

      // Updated fields should be present
      expect(updatedContent).toContain('description: Updated description');
      expect(updatedContent).toContain('Updated when to use');

      // Unmodified sections should be preserved
      expect(updatedContent).toContain('Initial when not to use');
      expect(updatedContent).toContain('Initial what to build');
      expect(updatedContent).toContain('Initial steps');
      expect(updatedContent).toContain('Initial definition of done');
    });

    it('should preserve unmodified sections when updating with partial data', async () => {
      // Create initial skill
      const initialData: SkillFormData = {
        category: 'partial-test',
        name: 'partial-skill',
        description: 'Test skill',
        whenToUse: 'Original when to use',
        whenNotToUse: 'Original when not to use',
        whatToBuild: 'Original what to build',
        steps: '1. Step one\n2. Step two',
        definitionOfDone: 'Original done',
      };
      const skillMdPath = await writer.create(initialData);
      const skillDir = path.dirname(skillMdPath);

      // Update only whenNotToUse
      const updateData: Partial<SkillFormData> = {
        name: 'partial-skill',
        description: 'Test skill',
        whenNotToUse: 'New when not to use',
      };
      await writer.update(skillDir, updateData);

      const content = fs.readFileSync(skillMdPath, 'utf-8');

      // Only whenNotToUse should be updated
      expect(content).toContain('New when not to use');
      // Others should remain unchanged
      expect(content).toContain('Original when to use');
      expect(content).toContain('Original what to build');
      expect(content).toContain('1. Step one');
      expect(content).toContain('Original done');
    });

    it('should create backup before updating', async () => {
      // Create initial skill
      const initialData: SkillFormData = {
        category: 'backup-test',
        name: 'backup-skill',
        description: 'Backup test',
        whenToUse: 'Backup content',
      };
      const skillMdPath = await writer.create(initialData);
      const skillDir = path.dirname(skillMdPath);

      // Update the skill
      await writer.update(skillDir, {
        name: 'backup-skill',
        description: 'Backup test',
        whenToUse: 'Updated backup content',
      });

      // Backup file should exist
      const backupPath = path.join(skillDir, 'SKILL.md.bak');
      expect(fs.existsSync(backupPath)).toBe(true);

      // Backup should contain original content
      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      expect(backupContent).toContain('Backup content');
      expect(backupContent).not.toContain('Updated backup content');
    });
  });
});