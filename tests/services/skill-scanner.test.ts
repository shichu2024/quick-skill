import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { scanSkills, SkillSourceEmptyError } from '../../src/services/skill-scanner.js';

describe('skill scanner', () => {
  describe('scanSkills', () => {
    it('should scan all skills from multiple categories', () => {
      const skillPath = path.resolve(process.cwd(), 'skills');
      const entries = scanSkills(skillPath);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some(e => e.category === 'public')).toBe(true);
      expect(entries.some(e => e.name === 'skill-a')).toBe(true);
      expect(entries.some(e => e.name === 'skill-b')).toBe(true);
    });

    it('should return SkillEntry with correct structure', () => {
      const skillPath = path.resolve(process.cwd(), 'skills');
      const entries = scanSkills(skillPath);

      for (const entry of entries) {
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('sourcePath');
        expect(entry).toHaveProperty('category');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.sourcePath).toBe('string');
        expect(typeof entry.category).toBe('string');
        expect(fs.existsSync(entry.sourcePath)).toBe(true);
      }
    });

    it('should throw SkillSourceEmptyError when source path does not exist', () => {
      expect(() => scanSkills('/nonexistent/path')).toThrow(SkillSourceEmptyError);
    });

    it('should throw SkillSourceEmptyError when source path is empty', () => {
      const tempDir = path.join(process.cwd(), 'temp-empty-skills');
      fs.mkdirSync(tempDir, { recursive: true });

      expect(() => scanSkills(tempDir)).toThrow(SkillSourceEmptyError);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw SkillSourceEmptyError when categories have no skills', () => {
      const tempDir = path.join(process.cwd(), 'temp-no-skills');
      const emptyCategory = path.join(tempDir, 'empty-category');
      fs.mkdirSync(emptyCategory, { recursive: true });

      expect(() => scanSkills(tempDir)).toThrow(SkillSourceEmptyError);

      fs.rmSync(tempDir, { recursive: true });
    });
  });
});