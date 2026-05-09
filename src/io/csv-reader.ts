import fs from 'fs';
import path from 'path';
import { TestCase } from '../types/test-case.js';

export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`CSV 文件不存在: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class CsvFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvFormatError';
  }
}

/**
 * 从 CSV 文件读取 TestCase 列表
 * 表头: id,should_trigger,prompt,pass_criteria,custom,deprecated
 * 支持双引号转义，逗号分隔
 */
export function readCasesFromCsv(filePath: string): TestCase[] {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new FileNotFoundError(absolutePath);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = parseCsvLines(content);

  if (lines.length === 0) {
    return [];
  }

  // 验证表头
  const header = lines[0];
  validateHeader(header);

  const cases: TestCase[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 6) {
      // 跳过格式错误的行
      continue;
    }

    try {
      const testCase: TestCase = {
        id: row[0],
        should_trigger: parseBoolean(row[1]),
        prompt: row[2],
        pass_criteria: row[3],
        custom: parseBoolean(row[4]),
        deprecated: parseBoolean(row[5]),
      };
      cases.push(testCase);
    } catch {
      // 跳过无法解析的行
      continue;
    }
  }

  return cases;
}

function parseCsvLines(content: string): string[][] {
  const result: string[][] = [];
  let current = '';
  let inQuotes = false;
  let currentRow: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // 转义的双引号
        current += '"';
        i++; // 跳过下一个引号
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(current);
        current = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(current);
        current = '';
        if (currentRow.some(field => field.trim() !== '')) {
          result.push(currentRow);
        }
        currentRow = [];
        if (char === '\r') i++; // 跳过 \n
      } else {
        current += char;
      }
    }
  }

  // 处理最后一行
  if (current || currentRow.length > 0) {
    currentRow.push(current);
    if (currentRow.some(field => field.trim() !== '')) {
      result.push(currentRow);
    }
  }

  return result;
}

function validateHeader(header: string[]): void {
  const expected = ['id', 'should_trigger', 'prompt', 'pass_criteria', 'custom', 'deprecated'];
  const normalized = header.map(h => h.trim().toLowerCase());

  for (const field of expected) {
    if (!normalized.includes(field)) {
      throw new CsvFormatError(`CSV 表头缺少字段: ${field}`);
    }
  }
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`无法解析布尔值: ${value}`);
}
