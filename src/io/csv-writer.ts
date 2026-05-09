import fs from 'fs';
import path from 'path';
import { TestCase } from '../types/test-case.js';

/**
 * 将 TestCase 列表写入 CSV 文件
 * 表头: id,should_trigger,prompt,pass_criteria,custom,deprecated
 * 自动创建目标目录（如不存在）
 */
export function writeCasesToCsv(filePath: string, cases: TestCase[]): void {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  // 目录不存在时自动递归创建
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const header = 'id,should_trigger,prompt,pass_criteria,custom,deprecated';
  const rows = [header];

  for (const testCase of cases) {
    const row = [
      escapeCsvField(testCase.id),
      escapeCsvField(String(testCase.should_trigger)),
      escapeCsvField(testCase.prompt),
      escapeCsvField(testCase.pass_criteria),
      escapeCsvField(String(testCase.custom)),
      escapeCsvField(String(testCase.deprecated)),
    ].join(',');
    rows.push(row);
  }

  fs.writeFileSync(absolutePath, rows.join('\n') + '\n', 'utf-8');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
