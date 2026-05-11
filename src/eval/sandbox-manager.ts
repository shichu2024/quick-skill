import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

/**
 * 沙箱配置选项
 */
export interface SandboxOptions {
  /** 超时时间（秒），默认 10 秒，最大 30 秒 */
  timeout?: number;
}

/**
 * 沙箱上下文，包含沙箱目录路径、文件路径、超时信息和清理回调
 */
export interface SandboxContext {
  /** 临时沙箱目录路径 */
  sandboxDir: string;
  /** 沙箱内 SKILL.md 的完整路径 */
  skillMdPath: string;
  /** 超时时间（毫秒） */
  timeoutMs: number;
  /** 清理沙箱目录的回调函数 */
  cleanup: () => void;
  /** 用于超时控制的 AbortController 信号 */
  abortSignal: AbortSignal;
}

/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT_MS = 10_000;

/** 最大超时时间（毫秒） */
const MAX_TIMEOUT_MS = 30_000;

/**
 * 为给定 Skill 目录创建独立的临时沙箱环境
 *
 * @param skillDir 原始 Skill 目录路径
 * @param options 可选配置（超时时间等）
 * @returns 沙箱上下文，包含目录路径、SKILL.md 路径、超时信息和清理回调
 *
 * 行为说明:
 * - 使用 os.tmpdir() + crypto.randomUUID() 生成唯一沙箱目录
 * - 将 Skill 目录下的所有文件（含子目录）复制到沙箱
 * - 默认超时 10 秒，最大不超过 30 秒
 * - 返回的 AbortController.signal 可用于外部超时控制
 */
export function createSandbox(
  skillDir: string,
  options?: SandboxOptions
): SandboxContext {
  // 验证源目录存在
  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill 目录不存在: ${skillDir}`);
  }

  // 验证 SKILL.md 存在
  const originalSkillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(originalSkillMd)) {
    throw new Error(`Skill 目录中缺少 SKILL.md: ${skillDir}`);
  }

  // 计算超时时间（秒 → 毫秒），处理无效值
  const timeoutMs = normalizeTimeout(options?.timeout);

  // 创建唯一沙箱目录
  const sandboxDir = path.join(os.tmpdir(), `quick-skill-sandbox-${randomUUID()}`);
  fs.mkdirSync(sandboxDir, { recursive: true });

  // 复制 Skill 目录下的所有文件到沙箱（保持目录结构）
  copyDirectoryRecursive(skillDir, sandboxDir);

  // 沙箱内 SKILL.md 路径
  const skillMdPath = path.join(sandboxDir, 'SKILL.md');

  // 创建 AbortController 用于超时控制
  const abortController = new AbortController();

  // 设置超时自动终止
  const timeoutId = setTimeout(() => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
    // 超时后自动清理沙箱
    try {
      if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      }
    } catch {
      // 清理失败时忽略，避免二次异常
    }
  }, timeoutMs);

  // 构造清理函数（幂等：可重复调用）
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  };

  return {
    sandboxDir,
    skillMdPath,
    timeoutMs,
    cleanup,
    abortSignal: abortController.signal,
  };
}

/**
 * 清理沙箱目录
 *
 * @param context 沙箱上下文
 *
 * 行为说明:
 * - 幂等操作，重复调用不会抛异常
 * - 无论沙箱目录是否存在都会安全返回
 */
export function cleanupSandbox(context: SandboxContext): void {
  context.cleanup();
}

/**
 * 规范化超时值
 *
 * - 无效值（0、负数、NaN）使用默认值 10 秒
 * - 超过最大值时截断为 30 秒
 */
function normalizeTimeout(timeoutSeconds?: number): number {
  if (timeoutSeconds === undefined || timeoutSeconds === null || isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  const ms = Math.round(timeoutSeconds * 1000);
  return Math.min(ms, MAX_TIMEOUT_MS);
}

/**
 * 递归复制目录（含所有子目录和文件）
 *
 * Node.js 16+ 支持 fs.cpSync，但为兼容性和可控性，手动实现递归复制
 */
function copyDirectoryRecursive(srcDir: string, destDir: string): void {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // 递归创建子目录并复制
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      // 复制文件
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
