import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadCases } from '../../../src/eval/case-loader.js';
import { LoadResult } from '../../../src/types/eval.js';

const testDir = path.resolve(__dirname, '__fixtures__', 'case-loader');

/** 清理测试 fixture 目录 */
function cleanup(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/** 在指定 skill 目录下创建 evals CSV 文件 */
function createCsv(skillDir: string, filename: string, content: string): string {
  const evalsDir = path.join(skillDir, 'evals');
  fs.mkdirSync(evalsDir, { recursive: true });
  const filePath = path.join(evalsDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('loadCases', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ─── AC-001-1 & AC-001-3: 正常加载 CSV 并解析为结构化对象 ───

  it('能读取 CSV 文件并返回有效用例列表', () => {
    const skillDir = path.join(testDir, 'my-skill');
    createCsv(skillDir, 'my-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
case-1,true,请生成一个函数,函数能正确运行,false,false
case-2,false,不应触发此场景,不触发即为通过,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.warnings.length).toBe(0);
    expect(result.cases[0].id).toBe('case-1');
    expect(result.cases[0].should_trigger).toBe(true);
    expect(result.cases[0].prompt).toBe('请生成一个函数');
    expect(result.cases[0].pass_criteria).toBe('函数能正确运行');
    expect(result.cases[0].custom).toBe(false);
    expect(result.cases[0].deprecated).toBe(false);
    expect(result.cases[0].isValid).toBe(true);
    expect(result.cases[0].missingFields).toEqual([]);
  });

  // ─── AC-001-2: 正确处理含逗号、换行、双引号的转义 ───

  it('正确解析含转义字符的 CSV 内容', () => {
    const skillDir = path.join(testDir, 'escape-skill');
    const csvContent = `id,should_trigger,prompt,pass_criteria,custom,deprecated
case-1,true,"包含,逗号的prompt","包含""双引号""的校验",false,false`;
    createCsv(skillDir, 'escape-skill.prompts.csv', csvContent);

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(1);
    expect(result.cases[0].prompt).toBe('包含,逗号的prompt');
    expect(result.cases[0].pass_criteria).toBe('包含"双引号"的校验');
    expect(result.cases[0].isValid).toBe(true);
  });

  // ─── AC-001-4: 自动跳过 deprecated=true 的用例 ───

  it('自动跳过 deprecated=true 的用例并计数', () => {
    const skillDir = path.join(testDir, 'deprec-skill');
    createCsv(skillDir, 'deprec-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
active-1,true,有效用例 1,通过标准 1,false,false
old-1,true,已废弃用例,旧标准,false,true
active-2,false,有效用例 2,通过标准 2,false,false
old-2,true,另一个废弃用例,旧标准 2,false,true`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(2);
    expect(result.skippedCount).toBe(2);
    expect(result.cases[0].id).toBe('active-1');
    expect(result.cases[1].id).toBe('active-2');
    // 确保 deprecated 用例不在结果中
    expect(result.cases.some(c => c.id === 'old-1')).toBe(false);
    expect(result.cases.some(c => c.id === 'old-2')).toBe(false);
  });

  // ─── AC-001-5: CSV 不存在时输出警告，不中断 ───

  it('CSV 文件不存在时返回空结果并附加警告', () => {
    const skillDir = path.join(testDir, 'missing-skill');
    // 不创建 evals 目录和 CSV 文件

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('用例 CSV 文件不存在');
    expect(result.warnings[0]).toContain('missing-skill.prompts.csv');
  });

  it('evals 目录不存在时返回空结果并附加警告', () => {
    const skillDir = path.join(testDir, 'no-evals-skill');
    // 创建 skill 目录但不创建 evals 子目录
    fs.mkdirSync(skillDir, { recursive: true });

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('用例 CSV 文件不存在');
  });

  // ─── AC-001-6: 缺少必填字段时标记无效并提示 ───

  it('缺少必填字段 id 时标记 isValid=false 并收集警告', () => {
    const skillDir = path.join(testDir, 'missing-id-skill');
    createCsv(skillDir, 'missing-id-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
,true,一个 prompt,校验标准,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(1);
    expect(result.cases[0].isValid).toBe(false);
    expect(result.cases[0].missingFields).toContain('id');
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('缺少必填字段');
    expect(result.warnings[0]).toContain('id');
  });

  it('缺少必填字段 prompt 时标记 isValid=false', () => {
    const skillDir = path.join(testDir, 'missing-prompt-skill');
    createCsv(skillDir, 'missing-prompt-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
case-1,true,,校验标准,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(1);
    expect(result.cases[0].isValid).toBe(false);
    expect(result.cases[0].missingFields).toContain('prompt');
  });

  it('缺少必填字段 pass_criteria 时标记 isValid=false', () => {
    const skillDir = path.join(testDir, 'missing-criteria-skill');
    createCsv(skillDir, 'missing-criteria-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
case-1,true,一个 prompt,,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(1);
    expect(result.cases[0].isValid).toBe(false);
    expect(result.cases[0].missingFields).toContain('pass_criteria');
  });

  it('多个必填字段缺失时全部列出', () => {
    const skillDir = path.join(testDir, 'multi-missing-skill');
    createCsv(skillDir, 'multi-missing-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
,true,,,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(1);
    expect(result.cases[0].isValid).toBe(false);
    expect(result.cases[0].missingFields).toContain('id');
    expect(result.cases[0].missingFields).toContain('prompt');
    expect(result.cases[0].missingFields).toContain('pass_criteria');
    expect(result.cases[0].missingFields.length).toBe(3);
  });

  it('无效用例仍包含在结果列表中供排查', () => {
    const skillDir = path.join(testDir, 'invalid-included-skill');
    createCsv(skillDir, 'invalid-included-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
case-1,true,有效用例,通过标准,false,false
case-2,true,,通过标准,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    // 无效用例也应出现在结果中
    expect(result.cases.length).toBe(2);
    expect(result.cases[0].isValid).toBe(true);
    expect(result.cases[1].isValid).toBe(false);
    expect(result.cases[1].id).toBe('case-2');
  });

  // ─── 边界场景 ───

  it('空 CSV（仅表头）返回空用例列表', () => {
    const skillDir = path.join(testDir, 'empty-csv-skill');
    createCsv(skillDir, 'empty-csv-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  it('全 deprecated 的 CSV 返回空用例列表且 skippedCount > 0', () => {
    const skillDir = path.join(testDir, 'all-deprecated-skill');
    createCsv(skillDir, 'all-deprecated-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
old-1,true,旧用例 1,旧标准,false,true
old-2,true,旧用例 2,旧标准,false,true`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.cases.length).toBe(0);
    expect(result.skippedCount).toBe(2);
    expect(result.warnings.length).toBe(0);
  });

  it('警告信息中包含无 id 用例的占位标识', () => {
    const skillDir = path.join(testDir, 'no-id-warning-skill');
    createCsv(skillDir, 'no-id-warning-skill.prompts.csv',
      `id,should_trigger,prompt,pass_criteria,custom,deprecated
,true,有 prompt 但无 id,校验标准,false,false`
    );

    const result: LoadResult = loadCases(skillDir);

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('(无 id)');
  });
});
