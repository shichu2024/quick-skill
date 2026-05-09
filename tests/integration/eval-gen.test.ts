import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evalGen } from '../../src/commands/eval-gen.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'eval-gen');
const skillsRoot = path.join(testDir, 'skills');

function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

function createTestSkill(name: string, category: string, content: string): string {
  const skillDir = path.join(skillsRoot, category, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
  return skillDir;
}

const sampleSkillMd = `---
name: test-skill
description: A test skill for validation
---

## When to use this
When you need to test parsing
Or when validating markdown sections

## When NOT to use this
Never use this in production

## Definition of done
All tests pass; Code is reviewed

## What to build
A CLI tool that parses SKILL.md files
`;

describe('eval-gen', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('AC-004-1: 为指定技能生成测试用例', async () => {
    createTestSkill('test-skill', 'core', sampleSkillMd);

    // Mock process.cwd to use our test skills root
    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGen('test-skill', {});

    process.cwd = originalCwd;

    const casesFile = path.join(skillsRoot, 'core', 'test-skill', 'evals', 'test-cases.csv');
    expect(fs.existsSync(casesFile)).toBe(true);
  });

  it('AC-004-2: 生成快照文件', async () => {
    createTestSkill('test-skill', 'core', sampleSkillMd);

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGen('test-skill', {});

    process.cwd = originalCwd;

    const snapshotFile = path.join(skillsRoot, 'core', 'test-skill', 'evals', '.skill-snapshot.json');
    expect(fs.existsSync(snapshotFile)).toBe(true);
  });

  it('AC-004-3: 已有用例文件且未指定 --override 时跳过', async () => {
    const skillDir = createTestSkill('test-skill', 'core', sampleSkillMd);
    const evalsDir = path.join(skillDir, 'evals');
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), 'existing content', 'utf-8');

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    // Should not throw, just return early
    await evalGen('test-skill', {});

    process.cwd = originalCwd;

    // File should still have original content
    const content = fs.readFileSync(path.join(evalsDir, 'test-cases.csv'), 'utf-8');
    expect(content).toBe('existing content');
  });

  it('AC-004-4: 指定 --override 时覆盖已有用例', async () => {
    const skillDir = createTestSkill('test-skill', 'core', sampleSkillMd);
    const evalsDir = path.join(skillDir, 'evals');
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), 'existing content', 'utf-8');

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGen('test-skill', { override: true });

    process.cwd = originalCwd;

    // File should have new content
    const content = fs.readFileSync(path.join(evalsDir, 'test-cases.csv'), 'utf-8');
    expect(content).not.toBe('existing content');
    expect(content).toContain('id,should_trigger,prompt');
  });

  it('AC-004-5: 技能不存在时抛出错误', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await expect(evalGen('nonexistent-skill', {})).rejects.toThrow('未找到技能');

    process.cwd = originalCwd;
  });

  it('生成四类用例', async () => {
    createTestSkill('test-skill', 'core', sampleSkillMd);

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGen('test-skill', {});

    process.cwd = originalCwd;

    const casesFile = path.join(skillsRoot, 'core', 'test-skill', 'evals', 'test-cases.csv');
    const content = fs.readFileSync(casesFile, 'utf-8');
    const lines = content.trim().split('\n');

    // Header + at least 10 cases (2-3 explicit + 3-4 implicit + 3-4 context + 3-4 negative)
    expect(lines.length).toBeGreaterThan(10);
  });
});
