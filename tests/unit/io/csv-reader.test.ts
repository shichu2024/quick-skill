import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readCasesFromCsv, FileNotFoundError, CsvFormatError } from '../../../src/io/csv-reader.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'csv-reader');

function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

describe('readCasesFromCsv', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('文件不存在时抛出 FileNotFoundError', () => {
    expect(() => readCasesFromCsv('/nonexistent/file.csv')).toThrow(FileNotFoundError);
  });

  it('空文件返回空数组', () => {
    const filePath = path.join(testDir, 'empty.csv');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(filePath, '', 'utf-8');

    const result = readCasesFromCsv(filePath);
    expect(result).toEqual([]);
  });

  it('表头不匹配时抛出 CsvFormatError', () => {
    const filePath = path.join(testDir, 'bad-header.csv');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(filePath, 'wrong,header\n1,true', 'utf-8');

    expect(() => readCasesFromCsv(filePath)).toThrow(CsvFormatError);
  });

  it('格式错误的行被跳过', () => {
    const filePath = path.join(testDir, 'malformed.csv');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(filePath, 'id,should_trigger,prompt,pass_criteria,custom,deprecated\ntest-1,true\n', 'utf-8');

    const result = readCasesFromCsv(filePath);
    expect(result.length).toBe(0);
  });

  it('正确解析含转义字符的 CSV', () => {
    const filePath = path.join(testDir, 'escaped.csv');
    fs.mkdirSync(testDir, { recursive: true });
    const csvContent = `id,should_trigger,prompt,pass_criteria,custom,deprecated
test-1,true,"Hello, ""world""\nNew line",Check; this,false,false`;
    fs.writeFileSync(filePath, csvContent, 'utf-8');

    const result = readCasesFromCsv(filePath);
    expect(result.length).toBe(1);
    expect(result[0].prompt).toContain('Hello, "world"');
    expect(result[0].prompt).toContain('New line');
  });
});
