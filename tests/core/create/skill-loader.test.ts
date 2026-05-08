import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SkillLoader } from '../../../src/core/create/skill-loader.js';

describe('skill-loader', () => {
  let loader: SkillLoader;
  let tempSkillsPath: string;

  beforeEach(() => {
    tempSkillsPath = path.join(process.cwd(), 'temp-test-skills-loader');
    fs.mkdirSync(tempSkillsPath, { recursive: true });
    loader = new SkillLoader(tempSkillsPath);
  });

  afterEach(() => {
    fs.rmSync(tempSkillsPath, { recursive: true, force: true });
  });

  describe('findSkill', () => {
    it('should return null when skill does not exist', async () => {
      const result = await loader.findSkill('non-existent-skill');
      expect(result).toBeNull();
    });

    it('should find SKILL.md by name in category subdirectory', async () => {
      // 创建测试 skill 目录和文件
      const skillDir = path.join(tempSkillsPath, 'test-category', 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: my-skill\ndescription: A test skill\n---\n\n# When to use this\n\nTest content\n'
      );

      const result = await loader.findSkill('my-skill');
      expect(result).not.toBeNull();
      expect(result).toContain('my-skill');
      expect(result).toContain('SKILL.md');
    });

    it('should find skill when multiple categories exist', async () => {
      // 创建多个分类目录
      const dir1 = path.join(tempSkillsPath, 'category-a', 'skill-a');
      const dir2 = path.join(tempSkillsPath, 'category-b', 'skill-b');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      fs.writeFileSync(
        path.join(dir1, 'SKILL.md'),
        '---\nname: skill-a\ndescription: Skill A\n---\n'
      );
      fs.writeFileSync(
        path.join(dir2, 'SKILL.md'),
        '---\nname: skill-b\ndescription: Skill B\n---\n'
      );

      const resultA = await loader.findSkill('skill-a');
      const resultB = await loader.findSkill('skill-b');

      expect(resultA).not.toBeNull();
      expect(resultA).toContain('category-a');
      expect(resultB).not.toBeNull();
      expect(resultB).toContain('category-b');
    });

    it('should return the first match when duplicate names exist', async () => {
      const dir1 = path.join(tempSkillsPath, 'cat1', 'dup-skill');
      const dir2 = path.join(tempSkillsPath, 'cat2', 'dup-skill');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      fs.writeFileSync(
        path.join(dir1, 'SKILL.md'),
        '---\nname: dup-skill\ndescription: First\n---\n'
      );
      fs.writeFileSync(
        path.join(dir2, 'SKILL.md'),
        '---\nname: dup-skill\ndescription: Second\n---\n'
      );

      const result = await loader.findSkill('dup-skill');
      expect(result).not.toBeNull();
      expect(result).toContain('SKILL.md');
    });
  });

  describe('parseSkillMd', () => {
    it('should parse frontmatter fields correctly', async () => {
      const skillDir = path.join(tempSkillsPath, 'parse-test', 'test-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const filePath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(
        filePath,
        `---
name: test-skill
description: A parsed test skill
---

# When to use this

Use when parsing tests

# When NOT to use this

Not for production
`
      );

      const result = await loader.parseSkillMd(filePath);

      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('A parsed test skill');
      expect(result.whenToUse).toContain('Use when parsing tests');
      expect(result.whenNotToUse).toContain('Not for production');
    });

    it('should parse all sections including optional ones', async () => {
      const skillDir = path.join(tempSkillsPath, 'full-parse', 'full-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const filePath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(
        filePath,
        `---
name: full-skill
description: Full skill description
---

# When to use this

When building features

# When NOT to use this

Never skip tests

# What to build

Build complete modules

# Steps

1. Plan
2. Implement
3. Verify

# Definition of done

All tests pass
`
      );

      const result = await loader.parseSkillMd(filePath);

      expect(result.name).toBe('full-skill');
      expect(result.description).toBe('Full skill description');
      expect(result.whenToUse).toContain('When building features');
      expect(result.whenNotToUse).toContain('Never skip tests');
      expect(result.whatToBuild).toContain('Build complete modules');
      expect(result.steps).toContain('1. Plan');
      expect(result.definitionOfDone).toContain('All tests pass');
    });

    it('should extract category from file path', async () => {
      const skillDir = path.join(tempSkillsPath, 'my-category', 'path-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const filePath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(
        filePath,
        '---\nname: path-skill\ndescription: Test\n---\n'
      );

      const result = await loader.parseSkillMd(filePath);
      expect(result.category).toBe('my-category');
    });

    it('should throw error when file does not exist', async () => {
      const nonExistentPath = path.join(tempSkillsPath, 'no-file', 'SKILL.md');
      await expect(loader.parseSkillMd(nonExistentPath)).rejects.toThrow();
    });

    it('should handle missing optional sections gracefully', async () => {
      const skillDir = path.join(tempSkillsPath, 'minimal', 'minimal-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const filePath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(
        filePath,
        '---\nname: minimal-skill\ndescription: Minimal\n---\n'
      );

      const result = await loader.parseSkillMd(filePath);

      expect(result.name).toBe('minimal-skill');
      expect(result.description).toBe('Minimal');
      expect(result.whenToUse).toBeUndefined();
      expect(result.whenNotToUse).toBeUndefined();
      expect(result.whatToBuild).toBeUndefined();
      expect(result.steps).toBeUndefined();
      expect(result.definitionOfDone).toBeUndefined();
    });

    it('should handle multi-line section content', async () => {
      const skillDir = path.join(tempSkillsPath, 'multiline', 'ml-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const filePath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(
        filePath,
        `---
name: ml-skill
description: Multi-line test
---

# When to use this

First line
Second line
Third line

# Steps

Step one details
Step two details
`
      );

      const result = await loader.parseSkillMd(filePath);

      expect(result.whenToUse).toContain('First line');
      expect(result.whenToUse).toContain('Second line');
      expect(result.whenToUse).toContain('Third line');
      expect(result.steps).toContain('Step one details');
      expect(result.steps).toContain('Step two details');
    });
  });
});
