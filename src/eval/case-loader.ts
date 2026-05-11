import fs from 'fs';
import path from 'path';
import { TestCase } from '../types/test-case.js';
import { LoadedCase, LoadResult } from '../types/eval.js';
import { readCasesFromCsv, FileNotFoundError } from '../io/csv-reader.js';

/** 必填字段列表 */
const REQUIRED_FIELDS: (keyof TestCase)[] = ['id', 'prompt', 'pass_criteria'];

/**
 * 从 Skill 的 evals 目录加载并解析测试用例 CSV 文件
 *
 * @param skillDir Skill 根目录路径
 * @returns 加载结果，包含用例列表、跳过数和警告信息
 *
 * 路径约定: {skillDir}/evals/{skill-name}.prompts.csv
 * - 自动跳过 deprecated=true 的用例
 * - CSV 不存在时不抛异常，返回空结果并附加警告
 * - 缺少必填字段时标记 isValid=false 并收集警告
 */
export function loadCases(skillDir: string): LoadResult {
  const result: LoadResult = {
    cases: [],
    skippedCount: 0,
    warnings: [],
  };

  // 从目录名提取 skill-name
  const skillName = path.basename(skillDir);
  const csvPath = path.join(skillDir, 'evals', `${skillName}.prompts.csv`);

  // 尝试读取 CSV 文件
  let rawCases: TestCase[];
  try {
    rawCases = readCasesFromCsv(csvPath);
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      result.warnings.push(`用例 CSV 文件不存在: ${csvPath}`);
      return result;
    }
    // 其他格式错误也作为警告返回，不中断流程
    result.warnings.push(`用例 CSV 格式错误 (${csvPath}): ${(error as Error).message}`);
    return result;
  }

  // 逐条处理用例
  for (const raw of rawCases) {
    // 跳过 deprecated 用例
    if (raw.deprecated) {
      result.skippedCount++;
      continue;
    }

    // 校验必填字段
    const missingFields = validateRequiredFields(raw);
    const isValid = missingFields.length === 0;

    if (!isValid) {
      result.warnings.push(
        `用例 "${raw.id || '(无 id)'}" 缺少必填字段: ${missingFields.join(', ')}`
      );
    }

    // 构造 LoadedCase（无论是否有效都加入结果，供调用方排查）
    const loadedCase: LoadedCase = {
      ...raw,
      isValid,
      missingFields,
    };
    result.cases.push(loadedCase);
  }

  return result;
}

/**
 * 检查用例是否包含所有必填字段
 */
function validateRequiredFields(testCase: TestCase): string[] {
  const missing: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = testCase[field];
    // 字符串字段为空或 undefined/null 视为缺失
    if (typeof value === 'string' && value.trim() === '') {
      missing.push(field);
    } else if (value === undefined || value === null) {
      missing.push(field);
    }
  }

  return missing;
}
