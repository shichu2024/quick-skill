import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { backupFile, listBackups, restoreFromBackup, BackupError } from '../../../src/io/backup.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'backup');

function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

describe('backupFile', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('AC-005-1: 备份文件创建成功', () => {
    const sourceDir = path.join(testDir, 'source');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    fs.writeFileSync(sourcePath, 'id,should_trigger,prompt\n1,true,test', 'utf-8');

    const backupPath = backupFile(sourcePath, backupDir);

    expect(fs.existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain('.backup');
    expect(backupPath).toContain('.bak.csv');
  });

  it('AC-005-2: 备份文件名包含时间戳', () => {
    const sourceDir = path.join(testDir, 'source');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    fs.writeFileSync(sourcePath, 'test content', 'utf-8');

    const backupPath = backupFile(sourcePath, backupDir);
    const backupName = path.basename(backupPath);

    // 格式: test-cases.YYYY-MM-DD-HH-mm-ss.bak.csv
    expect(backupName).toMatch(/test-cases\.\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.bak\.csv/);
  });

  it('AC-005-3: 备份目录不存在时自动创建', () => {
    const sourceDir = path.join(testDir, 'source');
    const backupDir = path.join(testDir, 'new', 'nested', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    fs.writeFileSync(sourcePath, 'test content', 'utf-8');

    const backupPath = backupFile(sourcePath, backupDir);

    expect(fs.existsSync(backupDir)).toBe(true);
    expect(fs.existsSync(backupPath)).toBe(true);
  });

  it('AC-005-4: 源文件不存在时抛出 BackupError', () => {
    const backupDir = path.join(testDir, '.backup');
    expect(() => backupFile('/nonexistent/file.csv', backupDir)).toThrow(BackupError);
  });

  it('AC-005-5: 备份文件内容与源文件一致', () => {
    const sourceDir = path.join(testDir, 'source');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    const originalContent = 'id,should_trigger,prompt\n1,true,test\n2,false,negative';
    fs.writeFileSync(sourcePath, originalContent, 'utf-8');

    const backupPath = backupFile(sourcePath, backupDir);
    const backupContent = fs.readFileSync(backupPath, 'utf-8');

    expect(backupContent).toBe(originalContent);
  });

  it('多次备份产生多个文件', () => {
    const sourceDir = path.join(testDir, 'source');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    fs.writeFileSync(sourcePath, 'version 1', 'utf-8');
    const backup1 = backupFile(sourcePath, backupDir);

    // 等待一小段时间确保时间戳不同
    const start = Date.now();
    while (Date.now() - start < 1001) {
      // 等待 1 秒
    }

    fs.writeFileSync(sourcePath, 'version 2', 'utf-8');
    const backup2 = backupFile(sourcePath, backupDir);

    expect(backup1).not.toBe(backup2);
    expect(fs.existsSync(backup1)).toBe(true);
    expect(fs.existsSync(backup2)).toBe(true);
  });
});

describe('listBackups', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('返回指定文件的所有备份', () => {
    const sourceDir = path.join(testDir, 'source');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    fs.writeFileSync(sourcePath, 'content', 'utf-8');

    const backup1 = backupFile(sourcePath, backupDir);

    // 等待时间戳变化
    const start = Date.now();
    while (Date.now() - start < 1001) {}

    const backup2 = backupFile(sourcePath, backupDir);

    const backups = listBackups(sourcePath, backupDir);

    expect(backups.length).toBe(2);
    expect(backups[0]).toBe(backup2); // 最新的在前
    expect(backups[1]).toBe(backup1);
  });

  it('备份目录不存在时返回空数组', () => {
    const sourcePath = path.join(testDir, 'source', 'test-cases.csv');
    const backups = listBackups(sourcePath, '/nonexistent/backup');
    expect(backups).toEqual([]);
  });

  it('只返回匹配前缀和后缀的文件', () => {
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(backupDir, { recursive: true });

    // 创建匹配的备份文件
    fs.writeFileSync(path.join(backupDir, 'test-cases.2024-01-01-12-00-00.bak.csv'), 'backup', 'utf-8');

    // 创建不匹配的文件
    fs.writeFileSync(path.join(backupDir, 'other-file.csv'), 'other', 'utf-8');
    fs.writeFileSync(path.join(backupDir, 'test-cases.csv'), 'original', 'utf-8');

    const sourcePath = path.join(testDir, 'source', 'test-cases.csv');
    const backups = listBackups(sourcePath, backupDir);

    expect(backups.length).toBe(1);
    expect(backups[0]).toContain('test-cases');
    expect(backups[0]).toContain('.bak.csv');
  });
});

describe('restoreFromBackup', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('从备份恢复文件', () => {
    const sourceDir = path.join(testDir, 'source');
    const targetDir = path.join(testDir, 'target');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    const originalContent = 'id,should_trigger,prompt\n1,true,test';
    fs.writeFileSync(sourcePath, originalContent, 'utf-8');

    const backupPath = backupFile(sourcePath, backupDir);

    // 删除源文件
    fs.unlinkSync(sourcePath);

    // 从备份恢复
    restoreFromBackup(backupPath, sourcePath);

    expect(fs.existsSync(sourcePath)).toBe(true);
    const restoredContent = fs.readFileSync(sourcePath, 'utf-8');
    expect(restoredContent).toBe(originalContent);
  });

  it('备份文件不存在时抛出 BackupError', () => {
    const targetPath = path.join(testDir, 'target', 'test-cases.csv');
    expect(() => restoreFromBackup('/nonexistent/backup.bak.csv', targetPath)).toThrow(BackupError);
  });

  it('目标目录不存在时自动创建', () => {
    const sourceDir = path.join(testDir, 'source');
    const targetPath = path.join(testDir, 'new', 'nested', 'target', 'test-cases.csv');
    const backupDir = path.join(testDir, 'evals', '.backup');
    fs.mkdirSync(sourceDir, { recursive: true });

    const sourcePath = path.join(sourceDir, 'test-cases.csv');
    fs.writeFileSync(sourcePath, 'content', 'utf-8');

    const backupPath = backupFile(sourcePath, backupDir);

    restoreFromBackup(backupPath, targetPath);

    expect(fs.existsSync(targetPath)).toBe(true);
  });
});
