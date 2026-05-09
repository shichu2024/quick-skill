import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evalGenAll } from '../../src/commands/eval-gen.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'eval-gen-batch');
const skillsRoot = path.join(testDir, 'skills');

function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

function createTestSkill(name: string, category: string, content: string, hasCases: boolean = false): string {
  const skillDir = path.join(skillsRoot, category, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');

  if (hasCases) {
    const evalsDir = path.join(skillDir, 'evals');
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), 'existing,content', 'utf-8');
  }

  return skillDir;
}

const sampleSkillMd = `---
name: test-skill
description: A test skill for validation
---

## When to use this
When you need to test parsing

## When NOT to use this
Never use this in production

## Definition of done
All tests pass
`;

describe('evalGenAll', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('AC-006-1: 批量扫描所有技能', async () => {
    createTestSkill('skill-a', 'core', sampleSkillMd);
    createTestSkill('skill-b', 'core', sampleSkillMd);
    createTestSkill('skill-c', 'web', sampleSkillMd);

    // Mock process.cwd
    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGenAll({});

    process.cwd = originalCwd;

    // All skills should have cases now
    expect(fs.existsSync(path.join(skillsRoot, 'core', 'skill-a', 'evals', 'test-cases.csv'))).toBe(true);
    expect(fs.existsSync(path.join(skillsRoot, 'core', 'skill-b', 'evals', 'test-cases.csv'))).toBe(true);
    expect(fs.existsSync(path.join(skillsRoot, 'web', 'skill-c', 'evals', 'test-cases.csv'))).toBe(true);
  });

  it('AC-006-2: 跳过已有用例的技能', async () => {
    createTestSkill('skill-a', 'core', sampleSkillMd, true); // has cases
    createTestSkill('skill-b', 'core', sampleSkillMd, false); // no cases

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGenAll({});

    process.cwd = originalCwd;

    // skill-a should still have original content
    const contentA = fs.readFileSync(path.join(skillsRoot, 'core', 'skill-a', 'evals', 'test-cases.csv'), 'utf-8');
    expect(contentA).toBe('existing,content');

    // skill-b should have new content
    const contentB = fs.readFileSync(path.join(skillsRoot, 'core', 'skill-b', 'evals', 'test-cases.csv'), 'utf-8');
    expect(contentB).toContain('id,should_trigger');
  });

  it('AC-006-3: --override 时覆盖所有技能', async () => {
    createTestSkill('skill-a', 'core', sampleSkillMd, true);
    createTestSkill('skill-b', 'core', sampleSkillMd, true);

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGenAll({ override: true });

    process.cwd = originalCwd;

    // Both should have new content
    const contentA = fs.readFileSync(path.join(skillsRoot, 'core', 'skill-a', 'evals', 'test-cases.csv'), 'utf-8');
    const contentB = fs.readFileSync(path.join(skillsRoot, 'core', 'skill-b', 'evals', 'test-cases.csv'), 'utf-8');
    expect(contentA).toContain('id,should_trigger');
    expect(contentB).toContain('id,should_trigger');
  });

  it('AC-006-4: 单个技能失败不阻塞其他', async () => {
    createTestSkill('skill-a', 'core', sampleSkillMd);
    // skill-b has invalid SKILL.md (missing required fields)
    createTestSkill('skill-b', 'core', `---
name: invalid-skill
---

## When NOT to use this
Never
`);
    createTestSkill('skill-c', 'core', sampleSkillMd);

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    // Should not throw, just exit with code 1
    try {
      await evalGenAll({});
    } catch (error) {
      // Expected to throw due to process.exit(1)
    }

    process.cwd = originalCwd;

    // skill-a and skill-c should have cases despite skill-b failing
    expect(fs.existsSync(path.join(skillsRoot, 'core', 'skill-a', 'evals', 'test-cases.csv'))).toBe(true);
    expect(fs.existsSync(path.join(skillsRoot, 'core', 'skill-c', 'evals', 'test-cases.csv'))).toBe(true);
  });

  it('AC-006-5: 所有技能已有用例时跳过', async () => {
    createTestSkill('skill-a', 'core', sampleSkillMd, true);
    createTestSkill('skill-b', 'core', sampleSkillMd, true);

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    await evalGenAll({});

    process.cwd = originalCwd;

    // Both should still have original content
    const contentA = fs.readFileSync(path.join(skillsRoot, 'core', 'skill-a', 'evals', 'test-cases.csv'), 'utf-8');
    const contentB = fs.readFileSync(path.join(skillsRoot, 'core', 'skill-b', 'evals', 'test-cases.csv'), 'utf-8');
    expect(contentA).toBe('existing,content');
    expect(contentB).toBe('existing,content');
  });

  it('AC-006-6: 汇总输出包含成功/跳过/失败计数', async () => {
    createTestSkill('skill-a', 'core', sampleSkillMd);
    createTestSkill('skill-b', 'core', sampleSkillMd, true); // will be skipped

    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    // Capture console.log output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    await evalGenAll({});

    console.log = originalLog;
    process.cwd = originalCwd;

    const output = logs.join('\n');
    expect(output).toContain('成功');
    expect(output).toContain('跳过');
  });
});
