import fs from 'fs';
import path from 'path';
import type { SkillScore, CaseEvalResult } from '../types/eval.js';

/**
 * 持久化输入接口
 * 包含评测结果持久化所需的全部数据
 */
export interface PersistInput {
  /** Skill 名称 */
  skillName: string;
  /** Skill 业务分类 */
  category: string;
  /** Skill 级别打分结果 */
  skillScore: SkillScore;
  /** 所有用例的评测结果 */
  caseResults: CaseEvalResult[];
  /** trace 日志源文件路径 */
  tracePath: string;
  /** ISO 8601 格式时间戳 */
  timestamp: string;
}

/**
 * 持久化输出接口
 * 包含持久化后各文件的路径信息
 */
export interface PersistOutput {
  /** 归档结果目录路径 */
  resultDir: string;
  /** JSON 结果文件路径 */
  jsonPath: string;
  /** trace 日志归档路径 */
  tracePath: string;
  /** HTML 报告路径（由 T-013 生成） */
  htmlPath: string;
}

/**
 * 将 ISO 8601 时间戳转换为 YYYYMMDD-HHmmss 格式
 *
 * @param isoTimestamp ISO 8601 格式时间戳
 * @returns 格式化后的时间字符串
 *
 * @example
 * formatTimestamp('2026-05-09T10:30:00.000Z') // => '20260509-103000'
 */
function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  // 使用 UTC 方法，确保与 ISO 8601 时间戳一致
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * 评测结果持久化与归档
 *
 * 将评测结果按「测试时间/Skill 业务分类/Skill 名称」三级目录结构
 * 归档到本地 .quick-skill-eval/ 目录。
 *
 * @param input 持久化输入数据
 * @returns 持久化输出路径信息
 *
 * 目录结构: ./.quick-skill-eval/{YYYYMMDD-HHmmss}/{category}/{skill-name}/
 *
 * 归档内容:
 * - result.json: 全量 JSON 格式测试结果
 * - trace.jsonl: 结构化 trace 日志（从源路径复制）
 * - report.html: HTML 可视化报告路径（由 T-013 生成，此处仅预留路径）
 *
 * 错误处理:
 * - 目标目录无写入权限时抛出错误
 * - trace 源文件不存在时跳过复制，不影响 JSON 写入
 *
 * @throws {Error} 当无法创建归档目录或写入文件时
 */
export function persistResult(input: PersistInput): PersistOutput {
  // 获取归档根目录（可通过环境变量覆盖，便于测试）
  const evalRoot = process.env.QUICK_SKILL_EVAL_ROOT ?? path.join(process.cwd(), '.quick-skill-eval');

  // 格式化时间戳为目录名
  const timeDir = formatTimestamp(input.timestamp);

  // 构建三级目录结构: {evalRoot}/{timeDir}/{category}/{skillName}/
  const resultDir = path.join(evalRoot, timeDir, input.category, input.skillName);

  // 计算各输出文件路径
  const jsonPath = path.join(resultDir, 'result.json');
  const archiveTracePath = path.join(resultDir, 'trace.jsonl');
  const htmlPath = path.join(resultDir, 'report.html');

  // 创建归档目录（递归创建，权限不足时抛出错误）
  try {
    fs.mkdirSync(resultDir, { recursive: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法创建评测归档目录 "${resultDir}"，请检查写入权限。错误详情: ${errorMessage}`
    );
  }

  // 构建 JSON 结果对象
  const resultJson = {
    skillName: input.skillName,
    category: input.category,
    timestamp: input.timestamp,
    skillScore: input.skillScore,
    caseResults: input.caseResults,
    tracePath: archiveTracePath,
    htmlPath,
  };

  // 写入 JSON 结果文件
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(resultJson, null, 2), 'utf-8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法写入评测结果 JSON 文件 "${jsonPath}"，请检查写入权限。错误详情: ${errorMessage}`
    );
  }

  // 复制 trace 日志到归档目录（源文件不存在时跳过）
  if (input.tracePath && fs.existsSync(input.tracePath)) {
    try {
      fs.copyFileSync(input.tracePath, archiveTracePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `无法复制 trace 日志到 "${archiveTracePath}"，请检查写入权限。错误详情: ${errorMessage}`
      );
    }
  }

  return {
    resultDir,
    jsonPath,
    tracePath: archiveTracePath,
    htmlPath,
  };
}
