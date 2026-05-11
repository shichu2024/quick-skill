import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createSandbox, cleanupSandbox, type SandboxContext, type SandboxOptions } from '../../../src/eval/sandbox-manager.js';

/** 固定测试 fixture 目录 */
const fixtureDir = path.resolve(__dirname, '__fixtures__', 'sandbox-manager');

/** 清理测试 fixture 目录 */
function cleanupFixtures(): void {
  if (fs.existsSync(fixtureDir)) {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

/** 创建一个模拟 Skill 目录，包含 SKILL.md 和依赖文件 */
function createMockSkillDir(name: string, extraFiles: Record<string, string> = {}): string {
  const skillDir = path.join(fixtureDir, name);
  fs.mkdirSync(skillDir, { recursive: true });

  // 写入 SKILL.md
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nThis is a test skill.', 'utf-8');

  // 写入额外依赖文件
  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const fullPath = path.join(skillDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  return skillDir;
}

/** 获取临时目录下所有已创建的沙箱目录（用于事后清理） */
const createdSandboxes: string[] = [];

/** 记录沙箱目录以便最终清理 */
function trackSandbox(context: SandboxContext): SandboxContext {
  createdSandboxes.push(context.sandboxDir);
  return context;
}

describe('createSandbox', () => {
  beforeEach(cleanupFixtures);
  afterEach(() => {
    cleanupFixtures();
    // 清理所有遗留沙箱目录
    for (const dir of createdSandboxes) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    createdSandboxes.length = 0;
  });

  // ─── AC-002-1: 每条用例执行前创建独立临时沙箱目录 ───

  it('在系统临时目录下创建独立沙箱目录', () => {
    const skillDir = createMockSkillDir('skill-unique');
    const ctx = trackSandbox(createSandbox(skillDir));

    expect(ctx.sandboxDir).toBeDefined();
    expect(ctx.sandboxDir.startsWith(os.tmpdir())).toBe(true);
    expect(fs.existsSync(ctx.sandboxDir)).toBe(true);
    expect(fs.statSync(ctx.sandboxDir).isDirectory()).toBe(true);

    cleanupSandbox(ctx);
  });

  it('两次调用创建不同的沙箱目录', () => {
    const skillDir = createMockSkillDir('skill-different');
    const ctx1 = trackSandbox(createSandbox(skillDir));
    const ctx2 = trackSandbox(createSandbox(skillDir));

    expect(ctx1.sandboxDir).not.toBe(ctx2.sandboxDir);
    expect(fs.existsSync(ctx1.sandboxDir)).toBe(true);
    expect(fs.existsSync(ctx2.sandboxDir)).toBe(true);

    cleanupSandbox(ctx1);
    cleanupSandbox(ctx2);
  });

  // ─── AC-002-2: 沙箱内复制目标 Skill 的必要文件 ───

  it('复制 SKILL.md 到沙箱目录', () => {
    const skillDir = createMockSkillDir('skill-copy');
    const ctx = trackSandbox(createSandbox(skillDir));

    expect(ctx.skillMdPath).toBeDefined();
    expect(fs.existsSync(ctx.skillMdPath)).toBe(true);

    // 验证内容一致
    const originalContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    const sandboxContent = fs.readFileSync(ctx.skillMdPath, 'utf-8');
    expect(sandboxContent).toBe(originalContent);

    cleanupSandbox(ctx);
  });

  it('复制 Skill 目录下的所有文件到沙箱', () => {
    const skillDir = createMockSkillDir('skill-copy-all', {
      'scripts/run.sh': '#!/bin/bash\necho "run"',
      'config/settings.json': '{"key": "value"}',
      'README.md': '# README',
    });
    const ctx = trackSandbox(createSandbox(skillDir));

    // 验证所有文件都被复制
    expect(fs.existsSync(path.join(ctx.sandboxDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(ctx.sandboxDir, 'scripts', 'run.sh'))).toBe(true);
    expect(fs.existsSync(path.join(ctx.sandboxDir, 'config', 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(ctx.sandboxDir, 'README.md'))).toBe(true);

    // 验证子目录内容
    const settingsContent = fs.readFileSync(path.join(ctx.sandboxDir, 'config', 'settings.json'), 'utf-8');
    expect(settingsContent).toBe('{"key": "value"}');

    cleanupSandbox(ctx);
  });

  it('空 Skill 目录（仅 SKILL.md）也能正常创建沙箱', () => {
    const skillDir = createMockSkillDir('skill-empty');
    const ctx = trackSandbox(createSandbox(skillDir));

    // 沙箱内只有 SKILL.md
    const files = fs.readdirSync(ctx.sandboxDir);
    expect(files).toContain('SKILL.md');

    cleanupSandbox(ctx);
  });

  // ─── AC-002-3: 默认只读模式挂载原始 Skill 源 ───

  it('skillMdPath 指向沙箱内的 SKILL.md 副本', () => {
    const skillDir = createMockSkillDir('skill-readonly');
    const ctx = trackSandbox(createSandbox(skillDir));

    // skillMdPath 必须在沙箱目录内，而非原始目录
    expect(ctx.skillMdPath.startsWith(ctx.sandboxDir)).toBe(true);
    expect(ctx.skillMdPath.startsWith(skillDir)).toBe(false);

    cleanupSandbox(ctx);
  });

  // ─── AC-002-5: 超时可配置，默认 10 秒，最大 30 秒 ───

  it('默认超时时间为 10 秒（10000 毫秒）', () => {
    const skillDir = createMockSkillDir('skill-default-timeout');
    const ctx = trackSandbox(createSandbox(skillDir));

    expect(ctx.timeoutMs).toBe(10000);

    cleanupSandbox(ctx);
  });

  it('可配置自定义超时时间', () => {
    const skillDir = createMockSkillDir('skill-custom-timeout');
    const ctx = trackSandbox(createSandbox(skillDir, { timeout: 5 }));

    expect(ctx.timeoutMs).toBe(5000);

    cleanupSandbox(ctx);
  });

  it('超时时间超过 30 秒时自动截断为 30 秒', () => {
    const skillDir = createMockSkillDir('skill-max-timeout');
    const ctx = trackSandbox(createSandbox(skillDir, { timeout: 60 }));

    expect(ctx.timeoutMs).toBe(30000);

    cleanupSandbox(ctx);
  });

  it('超时时间为 0 时使用默认值 10 秒', () => {
    const skillDir = createMockSkillDir('skill-zero-timeout');
    const ctx = trackSandbox(createSandbox(skillDir, { timeout: 0 }));

    expect(ctx.timeoutMs).toBe(10000);

    cleanupSandbox(ctx);
  });

  it('超时时间为负数时使用默认值 10 秒', () => {
    const skillDir = createMockSkillDir('skill-negative-timeout');
    const ctx = trackSandbox(createSandbox(skillDir, { timeout: -5 }));

    expect(ctx.timeoutMs).toBe(10000);

    cleanupSandbox(ctx);
  });

  // ─── cleanup 回调 ───

  it('context.cleanup 回调能正确清理沙箱目录', () => {
    const skillDir = createMockSkillDir('skill-cleanup-callback');
    const ctx = trackSandbox(createSandbox(skillDir));
    const sandboxDir = ctx.sandboxDir;

    expect(fs.existsSync(sandboxDir)).toBe(true);

    ctx.cleanup();

    expect(fs.existsSync(sandboxDir)).toBe(false);
  });

  // ─── 边界场景 ───

  it('Skill 目录不存在时抛出错误', () => {
    const nonExistentDir = path.join(fixtureDir, 'non-existent-skill');

    expect(() => createSandbox(nonExistentDir)).toThrow();
  });

  it('Skill 目录中没有 SKILL.md 时抛出错误', () => {
    const noSkillMdDir = path.join(fixtureDir, 'no-skillmd');
    fs.mkdirSync(noSkillMdDir, { recursive: true });
    // 不创建 SKILL.md

    expect(() => createSandbox(noSkillMdDir)).toThrow();
  });
});

describe('cleanupSandbox', () => {
  beforeEach(cleanupFixtures);
  afterEach(() => {
    cleanupFixtures();
    for (const dir of createdSandboxes) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    createdSandboxes.length = 0;
  });

  // ─── AC-002-4: 执行完成后自动清理沙箱 ───

  it('清理已存在的沙箱目录', () => {
    const skillDir = createMockSkillDir('skill-cleanup');
    const ctx = trackSandbox(createSandbox(skillDir));

    expect(fs.existsSync(ctx.sandboxDir)).toBe(true);

    cleanupSandbox(ctx);

    expect(fs.existsSync(ctx.sandboxDir)).toBe(false);
  });

  it('清理包含多个文件和子目录的沙箱', () => {
    const skillDir = createMockSkillDir('skill-cleanup-complex', {
      'a/b/c/deep.txt': 'deep content',
      'file1.txt': 'content1',
      'file2.txt': 'content2',
    });
    const ctx = trackSandbox(createSandbox(skillDir));

    cleanupSandbox(ctx);

    expect(fs.existsSync(ctx.sandboxDir)).toBe(false);
  });

  it('对已清理的沙箱重复调用 cleanup 不抛异常', () => {
    const skillDir = createMockSkillDir('skill-double-cleanup');
    const ctx = trackSandbox(createSandbox(skillDir));

    cleanupSandbox(ctx);
    // 第二次清理不应抛异常
    expect(() => cleanupSandbox(ctx)).not.toThrow();
  });

  // ─── AC-002-6: 超时后自动终止并清理 ───

  it('createSandbox 返回的 AbortController 信号可用于超时控制', () => {
    const skillDir = createMockSkillDir('skill-abort');
    const ctx = trackSandbox(createSandbox(skillDir, { timeout: 1 }));

    // context 应提供 abortSignal 用于超时控制
    expect('abortSignal' in ctx).toBe(true);
    expect(ctx.abortSignal).toBeDefined();
    expect(ctx.abortSignal.aborted).toBe(false);

    cleanupSandbox(ctx);
  });
});
