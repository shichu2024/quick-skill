import { createHash } from 'crypto';
import { TestCase } from '../types/test-case.js';
import { ConflictInfo } from '../types/conflict.js';

/**
 * 计算用例内容的 SHA-256 哈希
 * 哈希算法：对 prompt + pass_criteria 拼接后取 SHA-256
 * custom 字段不参与哈希计算
 *
 * @param testCase 用例对象
 * @returns SHA-256 十六进制字符串
 */
export function computeContentHash(testCase: TestCase): string {
  const content = testCase.prompt + testCase.pass_criteria;
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 检测当前用例集与原始哈希之间的冲突
 * - custom=true 的用例始终跳过哈希对比
 * - 无原始哈希记录的系统用例不标记为冲突
 * - 哈希不一致的系统用例标记为冲突
 *
 * @param currentCases 当前用例列表
 * @param originalHashes 原始（系统生成时）的用例哈希映射，key 为用例 id
 * @returns 冲突信息列表（不包含被跳过的 custom 用例）
 */
export function detectConflicts(
  currentCases: TestCase[],
  originalHashes: Map<string, string>
): ConflictInfo[] {
  const results: ConflictInfo[] = [];

  for (const testCase of currentCases) {
    // AC-003-1: custom=true 的用例始终跳过哈希对比
    if (testCase.custom) {
      continue;
    }

    const currentHash = computeContentHash(testCase);
    const originalHash = originalHashes.get(testCase.id) ?? '';

    // AC-003-2: 仅当存在原始哈希且与当前哈希不一致时标记为冲突
    const isConflict = originalHash !== '' && currentHash !== originalHash;

    results.push({
      caseId: testCase.id,
      currentHash,
      originalHash,
      isConflict,
    });
  }

  return results;
}
