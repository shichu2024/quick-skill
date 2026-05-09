import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateSnapshot, readSnapshot, SnapshotError } from '../../../src/io/snapshot-manager.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'snapshot');

function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

const sampleSkillMd = `---
name: test-skill
description: A test skill
---

## When to use this
When testing

## When NOT to use this
Never

## Definition of done
All tests pass

## What to build
A test tool
`;

describe('generateSnapshot', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('AC-003-4: 生成 .skill-snapshot.json 文件', () => {
    const skillMdPath = path.join(testDir, 'SKILL.md');
    const outputDir = path.join(testDir, 'evals');

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(skillMdPath, sampleSkillMd, 'utf-8');

    const snapshot = generateSnapshot(skillMdPath, outputDir);

    const snapshotPath = path.join(outputDir, '.skill-snapshot.json');
    expect(fs.existsSync(snapshotPath)).toBe(true);
    expect(snapshot).toBeDefined();
  });

  it('AC-003-5: 快照包含 SKILL.md 完整文本和版本哈希', () => {
    const skillMdPath = path.join(testDir, 'SKILL.md');
    const outputDir = path.join(testDir, 'evals');

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(skillMdPath, sampleSkillMd, 'utf-8');

    const snapshot = generateSnapshot(skillMdPath, outputDir);

    expect(snapshot.content).toBe(sampleSkillMd);
    expect(snapshot.hash).toBeDefined();
    expect(snapshot.hash.length).toBe(64); // SHA-256 hex = 64 chars
    expect(snapshot.timestamp).toBeDefined();
  });

  it('哈希值对相同内容保持一致', () => {
    const skillMdPath = path.join(testDir, 'SKILL.md');
    const outputDir = path.join(testDir, 'evals');

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(skillMdPath, sampleSkillMd, 'utf-8');

    const snapshot1 = generateSnapshot(skillMdPath, outputDir);
    const snapshot2 = generateSnapshot(skillMdPath, outputDir);

    expect(snapshot1.hash).toBe(snapshot2.hash);
  });

  it('不同内容产生不同哈希', () => {
    const skillMdPath1 = path.join(testDir, 'SKILL1.md');
    const skillMdPath2 = path.join(testDir, 'SKILL2.md');
    const outputDir = path.join(testDir, 'evals');

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(skillMdPath1, sampleSkillMd, 'utf-8');
    fs.writeFileSync(skillMdPath2, sampleSkillMd + '\nextra', 'utf-8');

    const snapshot1 = generateSnapshot(skillMdPath1, outputDir);
    const snapshot2 = generateSnapshot(skillMdPath2, outputDir);

    expect(snapshot1.hash).not.toBe(snapshot2.hash);
  });

  it('SKILL.md 不存在时抛出 SnapshotError', () => {
    const outputDir = path.join(testDir, 'evals');
    expect(() => generateSnapshot('/nonexistent/SKILL.md', outputDir)).toThrow(SnapshotError);
  });

  it('输出目录不存在时自动创建', () => {
    const skillMdPath = path.join(testDir, 'SKILL.md');
    const outputDir = path.join(testDir, 'new', 'nested', 'evals');

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(skillMdPath, sampleSkillMd, 'utf-8');

    generateSnapshot(skillMdPath, outputDir);

    const snapshotPath = path.join(outputDir, '.skill-snapshot.json');
    expect(fs.existsSync(snapshotPath)).toBe(true);
  });
});

describe('readSnapshot', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('文件不存在时返回 null', () => {
    const result = readSnapshot('/nonexistent/.skill-snapshot.json');
    expect(result).toBeNull();
  });

  it('正确读取已生成的快照', () => {
    const skillMdPath = path.join(testDir, 'SKILL.md');
    const outputDir = path.join(testDir, 'evals');

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(skillMdPath, sampleSkillMd, 'utf-8');
    generateSnapshot(skillMdPath, outputDir);

    const snapshotPath = path.join(outputDir, '.skill-snapshot.json');
    const result = readSnapshot(snapshotPath);

    expect(result).not.toBeNull();
    expect(result!.content).toBe(sampleSkillMd);
    expect(result!.hash.length).toBe(64);
  });

  it('快照格式不完整时抛出 SnapshotError', () => {
    const snapshotPath = path.join(testDir, '.skill-snapshot.json');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify({ content: 'test' }), 'utf-8');

    expect(() => readSnapshot(snapshotPath)).toThrow(SnapshotError);
  });
});
