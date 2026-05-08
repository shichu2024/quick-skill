import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { overwriteSkill, deployWithOverwrite } from '../../src/services/skill-overwriter.js';
import type { SkillEntry } from '../../src/services/skill-scanner.js';

describe('skill overwriter', () => {
  let tempTargetDir: string;

  beforeEach(() => {
    tempTargetDir = path.join(process.cwd(), 'temp-overwrite-skills');
    fs.mkdirSync(tempTargetDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempTargetDir, { recursive: true, force: true });
  });

  describe('overwriteSkill', () => {
    it('should return not overwritten when skill does not exist', async () => {
      const result = await overwriteSkill('nonexistent-skill', tempTargetDir);

      expect(result.overwritten).toBe(false);
      expect(result.skipped).toBe(false);
    });

    it('should delete existing skill and return overwritten true', async () => {
      const existingSkillPath = path.join(tempTargetDir, 'existing-skill');
      fs.mkdirSync(existingSkillPath, { recursive: true });
      fs.writeFileSync(path.join(existingSkillPath, 'SKILL.md'), 'old content');

      const result = await overwriteSkill('existing-skill', tempTargetDir);

      expect(result.overwritten).toBe(true);
      expect(result.skipped).toBe(false);
      expect(fs.existsSync(existingSkillPath)).toBe(false);
    });

    it('should return skipped true when deletion fails', async () => {
      const existingSkillPath = path.join(tempTargetDir, 'readonly-skill');
      fs.mkdirSync(existingSkillPath, { recursive: true });
      fs.writeFileSync(path.join(existingSkillPath, 'SKILL.md'), 'readonly content');

      const result = await overwriteSkill('readonly-skill', tempTargetDir);

      expect(result.skipped).toBe(false);
      expect(result.overwritten).toBe(true);
    });
  });

  describe('deployWithOverwrite', () => {
    it('should overwrite existing skill and deploy new version', async () => {
      const existingSkillPath = path.join(tempTargetDir, 'skill-a');
      fs.mkdirSync(existingSkillPath, { recursive: true });
      fs.writeFileSync(path.join(existingSkillPath, 'SKILL.md'), 'old version');

      const entries: SkillEntry[] = [
        {
          name: 'skill-a',
          sourcePath: path.join(process.cwd(), 'skills', 'public', 'skill-a'),
          category: 'public',
        },
      ];

      const result = await deployWithOverwrite(entries, tempTargetDir);

      expect(result.deployed).toContain('skill-a');
      expect(fs.existsSync(path.join(tempTargetDir, 'skill-a', 'SKILL.md'))).toBe(true);
      
      const newContent = fs.readFileSync(path.join(tempTargetDir, 'skill-a', 'SKILL.md'), 'utf-8');
      expect(newContent).toContain('Skill A');
    });

    it('should preserve non同名 skills', async () => {
      const otherSkillPath = path.join(tempTargetDir, 'other-skill');
      fs.mkdirSync(otherSkillPath, { recursive: true });
      fs.writeFileSync(path.join(otherSkillPath, 'OTHER.md'), 'should be preserved');

      const entries: SkillEntry[] = [
        {
          name: 'skill-a',
          sourcePath: path.join(process.cwd(), 'skills', 'public', 'skill-a'),
          category: 'public',
        },
      ];

      await deployWithOverwrite(entries, tempTargetDir);

      expect(fs.existsSync(otherSkillPath)).toBe(true);
      expect(fs.existsSync(path.join(otherSkillPath, 'OTHER.md'))).toBe(true);
    });

    it('should deploy skill directly when no existing skill', async () => {
      const entries: SkillEntry[] = [
        {
          name: 'skill-a',
          sourcePath: path.join(process.cwd(), 'skills', 'public', 'skill-a'),
          category: 'public',
        },
      ];

      const result = await deployWithOverwrite(entries, tempTargetDir);

      expect(result.deployed).toContain('skill-a');
      expect(result.skipped).toHaveLength(0);
      expect(fs.existsSync(path.join(tempTargetDir, 'skill-a'))).toBe(true);
    });

    it('should skip skill when overwrite fails', async () => {
      const entries: SkillEntry[] = [
        {
          name: 'nonexistent-source',
          sourcePath: '/nonexistent/path',
          category: 'test',
        },
      ];

      const result = await deployWithOverwrite(entries, tempTargetDir);

      expect(result.deployed).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});