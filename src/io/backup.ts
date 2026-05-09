import fs from 'fs';
import path from 'path';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/**
 * 将文件备份到指定目录，文件名附加时间戳
 * 返回备份文件的完整路径
 */
export function backupFile(filePath: string, backupDir: string): string {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new BackupError(`源文件不存在: ${absolutePath}`);
  }

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 生成备份文件名: {原文件名}.{YYYYMMDD-HHmmss}.bak
  const originalName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
  const backupName = `${originalName}.${timestamp}.bak${ext}`;
  const backupPath = path.join(backupDir, backupName);

  // 复制文件
  fs.copyFileSync(absolutePath, backupPath);

  return backupPath;
}

/**
 * 读取备份目录中指定文件的所有备份
 * 按时间戳降序排列（最新的在前）
 */
export function listBackups(originalFilePath: string, backupDir: string): string[] {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const originalName = path.basename(originalFilePath, path.extname(originalFilePath));
  const ext = path.extname(originalFilePath);
  const prefix = `${originalName}.`;
  const suffix = `.bak${ext}`;

  const files = fs.readdirSync(backupDir)
    .filter(file => file.startsWith(prefix) && file.endsWith(suffix))
    .map(file => path.join(backupDir, file))
    .sort()
    .reverse(); // 最新的在前

  return files;
}

/**
 * 从备份恢复文件
 */
export function restoreFromBackup(backupPath: string, targetPath: string): void {
  const absoluteBackup = path.resolve(backupPath);

  if (!fs.existsSync(absoluteBackup)) {
    throw new BackupError(`备份文件不存在: ${absoluteBackup}`);
  }

  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.copyFileSync(absoluteBackup, targetPath);
}
