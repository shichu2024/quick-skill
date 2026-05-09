import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseSkillMd, SkillParseError } from '../../../src/core/skill-parser.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'skill-parser');

function createTestFile(name: string, content: string): string {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanupTestFile(name: string): void {
  const filePath = path.join(testDir, name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

describe('parseSkillMd', () => {
  it('AC-001-1: 正确解析 YAML front matter 中的 name 和 description', () => {
    const filePath = createTestFile('valid-skill.md', `---
name: test-skill
description: A test skill for validation
---

## When to use this
When you need to test parsing

## When NOT to use this
Never use this in production
`);

    const result = parseSkillMd(filePath);
    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A test skill for validation');

    cleanupTestFile('valid-skill.md');
  });

  it('AC-001-2: 提取 When to use this 章节', () => {
    const filePath = createTestFile('when-to-use.md', `---
name: test-skill
description: A test skill
---

## When to use this
Use this when you need to validate parsing of markdown sections.
Multiple lines should be captured.

## When NOT to use this
Never
`);

    const result = parseSkillMd(filePath);
    expect(result.whenToUse).toContain('validate parsing');
    expect(result.whenToUse).toContain('Multiple lines');

    cleanupTestFile('when-to-use.md');
  });

  it('AC-001-3: 提取 When NOT to use this 章节', () => {
    const filePath = createTestFile('when-not-to-use.md', `---
name: test-skill
description: A test skill
---

## When to use this
Always

## When NOT to use this
Do not use this when the input is invalid
or when the file format is unsupported
`);

    const result = parseSkillMd(filePath);
    expect(result.whenNotToUse).toContain('input is invalid');
    expect(result.whenNotToUse).toContain('file format is unsupported');

    cleanupTestFile('when-not-to-use.md');
  });

  it('AC-001-4: 提取 Definition of done 章节', () => {
    const filePath = createTestFile('definition-of-done.md', `---
name: test-skill
description: A test skill
---

## When to use this
Always

## When NOT to use this
Never

## Definition of done
- All tests pass
- Code is reviewed
- Documentation is updated
`);

    const result = parseSkillMd(filePath);
    expect(result.definitionOfDone).toContain('All tests pass');
    expect(result.definitionOfDone).toContain('Code is reviewed');

    cleanupTestFile('definition-of-done.md');
  });

  it('AC-001-5: 提取 What to build 章节', () => {
    const filePath = createTestFile('what-to-build.md', `---
name: test-skill
description: A test skill
---

## When to use this
Always

## When NOT to use this
Never

## What to build
A CLI tool that parses SKILL.md files
`);

    const result = parseSkillMd(filePath);
    expect(result.whatToBuild).toContain('CLI tool');

    cleanupTestFile('what-to-build.md');
  });

  it('AC-001-6: 缺少必填字段时抛出 SkillParseError 并包含缺失项列表', () => {
    const filePath = createTestFile('missing-fields.md', `---
name: test-skill
---

## When NOT to use this
Never
`);

    expect(() => parseSkillMd(filePath)).toThrow(SkillParseError);
    try {
      parseSkillMd(filePath);
    } catch (error) {
      expect(error).toBeInstanceOf(SkillParseError);
      expect((error as SkillParseError).missingFields).toContain('description');
      expect((error as SkillParseError).missingFields).toContain('When to use this');
    }

    cleanupTestFile('missing-fields.md');
  });

  it('AC-001-7: 解析结果以结构化对象输出', () => {
    const filePath = createTestFile('structured.md', `---
name: structured-skill
description: A structured skill
---

## When to use this
When structured

## When NOT to use this
Never

## Definition of done
Done when complete

## What to build
Something
`);

    const result = parseSkillMd(filePath);
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('whenToUse');
    expect(result).toHaveProperty('whenNotToUse');
    expect(result).toHaveProperty('definitionOfDone');
    expect(result).toHaveProperty('whatToBuild');

    cleanupTestFile('structured.md');
  });

  it('文件不存在时抛出 SkillParseError', () => {
    expect(() => parseSkillMd('/nonexistent/path/SKILL.md')).toThrow(SkillParseError);
  });

  it('空文件时抛出 SkillParseError', () => {
    const filePath = createTestFile('empty.md', '');
    expect(() => parseSkillMd(filePath)).toThrow(SkillParseError);
    cleanupTestFile('empty.md');
  });

  it('缺少可选字段时返回空字符串', () => {
    const filePath = createTestFile('no-optional.md', `---
name: minimal-skill
description: Minimal skill
---

## When to use this
Always

## When NOT to use this
Never
`);

    const result = parseSkillMd(filePath);
    expect(result.definitionOfDone).toBe('');
    expect(result.whatToBuild).toBe('');

    cleanupTestFile('no-optional.md');
  });

  it('解析 ### 级别的章节标题', () => {
    const filePath = createTestFile('h3-heading.md', `---
name: h3-skill
description: H3 heading skill
---

### When to use this
When using H3

### When NOT to use this
Never
`);

    const result = parseSkillMd(filePath);
    expect(result.whenToUse).toContain('When using H3');
    expect(result.whenNotToUse).toContain('Never');

    cleanupTestFile('h3-heading.md');
  });
});
