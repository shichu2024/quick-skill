import fs from 'fs';
import path from 'path';
import { SkillSnapshot } from '../types/snapshot.js';

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/**
 * 生成 .skill-snapshot.json 文件
 * 记录 SKILL.md 完整文本和 SHA-256 版本哈希
 */
export function generateSnapshot(skillMdPath: string, outputDir: string): SkillSnapshot {
  const absolutePath = path.resolve(skillMdPath);

  if (!fs.existsSync(absolutePath)) {
    throw new SnapshotError(`SKILL.md 文件不存在: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const hash = computeSha256(content);
  const timestamp = new Date().toISOString();

  const snapshot: SkillSnapshot = {
    content,
    hash,
    timestamp,
  };

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const snapshotPath = path.join(outputDir, '.skill-snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  return snapshot;
}

/**
 * 读取已存在的 .skill-snapshot.json 文件
 * 文件不存在时返回 null
 */
export function readSnapshot(snapshotPath: string): SkillSnapshot | null {
  const absolutePath = path.resolve(snapshotPath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const snapshot: SkillSnapshot = JSON.parse(content);

    // 基本校验
    if (!snapshot.content || !snapshot.hash || !snapshot.timestamp) {
      throw new SnapshotError('快照文件格式不完整');
    }

    return snapshot;
  } catch (error) {
    if (error instanceof SnapshotError) {
      throw error;
    }
    throw new SnapshotError(`无法解析快照文件: ${absolutePath}`);
  }
}

/**
 * 计算字符串的 SHA-256 哈希（十六进制）
 */
function computeSha256(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}
