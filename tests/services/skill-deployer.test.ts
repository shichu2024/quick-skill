import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { deploySkills } from '../../src/services/skill-deployer.js';
import type { SkillEntry } from '../../src/services/skill-scanner.js';

describe('skill deployer', () => {
  let tempTargetDir: string;

  beforeEach(() => {
    tempTargetDir = path.join(process.cwd(), 'temp-target-skills');
    fs.mkdirSync(tempTargetDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempTargetDir, { recursive: true, force: true });
  });

  describe('deploySkills', () => {
    it('should deploy skills to target directory', async () => {
      const entries: SkillEntry[] = [
        {
          name: 'skill-a',
          sourcePath: path.join(process.cwd(), 'skills', 'public', 'skill-a'),
          category: 'public',
        },
      ];

      const result = await deploySkills(entries, tempTargetDir);

      expect(result.deployed).toContain('skill-a');
      expect(fs.existsSync(path.join(tempTargetDir, 'skill-a'))).toBe(true);
      expect(fs.existsSync(path.join(tempTargetDir, 'skill-a', 'SKILL.md'))).toBe(true);
    });

    it('should preserve complete internal structure', async () => {
      const entries: SkillEntry[] = [
        {
          name: 'skill-a',
          sourcePath: path.join(process.cwd(), 'skills', 'public', 'skill-a'),
          category: 'public',
        },
      ];

      await deploySkills(entries, tempTargetDir);

      const skillFiles = fs.readdirSync(path.join(tempTargetDir, 'skill-a'));
      expect(skillFiles).toContain('SKILL.md');
    });

    it('should flatten skills from different categories', async () => {
      const entries: SkillEntry[] = [
        {
          name: 'skill-a',
          sourcePath: path.join(process.cwd(), 'skills', 'public', 'skill-a'),
          category: 'public',
        },
        {
          name: 'skill-c',
          sourcePath: path.join(process.cwd(), 'skills', '需求分析', 'skill-c'),
          category: '需求分析',
        },
      ];

      const result = await deploySkills(entries, tempTargetDir);

      expect(result.deployed).toHaveLength(2);
      expect(result.deployed).toContain('skill-a');
      expect(result.deployed).toContain('skill-c');
      expect(fs.existsSync(path.join(tempTargetDir, 'skill-a'))).toBe(true);
      expect(fs.existsSync(path.join(tempTargetDir, 'skill-c'))).toBe(true);
    });

    it('should return errors when deployment fails', async () => {
      const entries: SkillEntry[] = [
        {
          name: 'nonexistent-skill',
          sourcePath: '/nonexistent/path',
          category: 'test',
        },
      ];

      const result = await deploySkills(entries, tempTargetDir);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].skillName).toBe('nonexistent-skill');
      expect(result.deployed).toHaveLength(0);
    });
  });
});