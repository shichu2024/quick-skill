import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { writeCasesToCsv } from '../../../src/io/csv-writer.js';
import { readCasesFromCsv, FileNotFoundError, CsvFormatError } from '../../../src/io/csv-reader.js';
import { TestCase } from '../../../src/types/test-case.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'csv-writer');

function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

describe('writeCasesToCsv', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('AC-003-6: 目录不存在时自动递归创建', () => {
    const filePath = path.join(testDir, 'nested', 'deep', 'test.csv');
    const cases: TestCase[] = [
      { id: 'test-1', should_trigger: true, prompt: 'Hello', pass_criteria: 'Works', custom: false, deprecated: false },
    ];

    writeCasesToCsv(filePath, cases);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('AC-003-2: 表头格式正确', () => {
    const filePath = path.join(testDir, 'test.csv');
    const cases: TestCase[] = [
      { id: 'test-1', should_trigger: true, prompt: 'Hello', pass_criteria: 'Works', custom: false, deprecated: false },
    ];

    writeCasesToCsv(filePath, cases);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('id,should_trigger,prompt,pass_criteria,custom,deprecated');
  });

  it('AC-003-3: 含逗号和换行的字段正确转义', () => {
    const filePath = path.join(testDir, 'escape.csv');
    const cases: TestCase[] = [
      {
        id: 'test-1',
        should_trigger: true,
        prompt: 'Hello, world\nNew line',
        pass_criteria: 'Check; this',
        custom: false,
        deprecated: false,
      },
    ];

    writeCasesToCsv(filePath, cases);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('"Hello, world\nNew line"');
  });

  it('正常写入多条用例', () => {
    const filePath = path.join(testDir, 'multi.csv');
    const cases: TestCase[] = [
      { id: 'test-1', should_trigger: true, prompt: 'Prompt 1', pass_criteria: 'Criteria 1', custom: false, deprecated: false },
      { id: 'test-2', should_trigger: false, prompt: 'Prompt 2', pass_criteria: 'Criteria 2', custom: true, deprecated: true },
    ];

    writeCasesToCsv(filePath, cases);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(3);
  });
});

describe('readCasesFromCsv', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('文件不存在时抛出 FileNotFoundError', () => {
    expect(() => readCasesFromCsv('/nonexistent/file.csv')).toThrow(FileNotFoundError);
  });

  it('正常读取 CSV 文件', () => {
    const filePath = path.join(testDir, 'read.csv');
    const cases: TestCase[] = [
      { id: 'test-1', should_trigger: true, prompt: 'Prompt 1', pass_criteria: 'Criteria 1', custom: false, deprecated: false },
      { id: 'test-2', should_trigger: false, prompt: 'Prompt 2', pass_criteria: 'Criteria 2', custom: true, deprecated: false },
    ];

    writeCasesToCsv(filePath, cases);
    const result = readCasesFromCsv(filePath);

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('test-1');
    expect(result[0].should_trigger).toBe(true);
    expect(result[1].should_trigger).toBe(false);
  });

  it('AC-003-3: 正确解析转义后的字段', () => {
    const filePath = path.join(testDir, 'escaped.csv');
    const cases: TestCase[] = [
      {
        id: 'test-1',
        should_trigger: true,
        prompt: 'Hello, "world"\nNew line',
        pass_criteria: 'Check; this',
        custom: false,
        deprecated: false,
      },
    ];

    writeCasesToCsv(filePath, cases);
    const result = readCasesFromCsv(filePath);

    expect(result.length).toBe(1);
    expect(result[0].prompt).toContain('Hello, "world"');
    expect(result[0].prompt).toContain('New line');
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
});

describe('读写往返', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('写入后读取结果一致', () => {
    const filePath = path.join(testDir, 'roundtrip.csv');
    const original: TestCase[] = [
      { id: 'skill-explicit-1', should_trigger: true, prompt: '$my-skill do something', pass_criteria: 'Done; Verified', custom: false, deprecated: false },
      { id: 'skill-negative-1', should_trigger: false, prompt: 'Do something else', pass_criteria: 'Not triggered', custom: false, deprecated: false },
    ];

    writeCasesToCsv(filePath, original);
    const result = readCasesFromCsv(filePath);

    expect(result).toEqual(original);
  });
});
