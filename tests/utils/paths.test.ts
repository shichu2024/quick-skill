import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { getSkillSourcePath, resolveAgentSkillDir } from '../../src/utils/paths.js';

describe('skill source path resolution', () => {
  describe('getSkillSourcePath', () => {
    it('should return absolute path ending with skills/', () => {
      const skillPath = getSkillSourcePath();
      expect(skillPath).toContain('skills');
      expect(path.isAbsolute(skillPath)).toBe(true);
    });

    it('should work in global installation scenario', () => {
      const skillPath = getSkillSourcePath();
      expect(skillPath).toMatch(/quick-skill[\/\\]skills$/);
    });

    it('should work in local installation scenario (npx)', () => {
      const skillPath = getSkillSourcePath();
      expect(skillPath).toContain('skills');
      expect(typeof skillPath).toBe('string');
    });
  });

  describe('resolveAgentSkillDir', () => {
    it('should resolve claude agent directory', () => {
      const claudeDir = resolveAgentSkillDir('claude');
      const expectedDir = path.resolve(process.cwd(), './claude/skills');
      expect(claudeDir).toBe(expectedDir);
    });

    it('should resolve opencode agent directory', () => {
      const opencodeDir = resolveAgentSkillDir('opencode');
      const expectedDir = path.resolve(process.cwd(), './opencode/skills');
      expect(opencodeDir).toBe(expectedDir);
    });

    it('should resolve relay agent directory', () => {
      const relayDir = resolveAgentSkillDir('relay');
      const expectedDir = path.resolve(process.cwd(), './.relay/skills');
      expect(relayDir).toBe(expectedDir);
    });

    it('should return absolute path for all agents', () => {
      const claudeDir = resolveAgentSkillDir('claude');
      const opencodeDir = resolveAgentSkillDir('opencode');
      const relayDir = resolveAgentSkillDir('relay');
      
      expect(path.isAbsolute(claudeDir)).toBe(true);
      expect(path.isAbsolute(opencodeDir)).toBe(true);
      expect(path.isAbsolute(relayDir)).toBe(true);
    });
  });
});