/**
 * 结构合规性检查器
 * 验证技能为独立目录，包含核心技能文件，无零散散落文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DiagnosticChecker, DiagnosticDimension, CheckResult } from '../types.js';

export class StructureChecker implements DiagnosticChecker {
  dimension = DiagnosticDimension.structure;

  async check(skillPath: string): Promise<CheckResult> {
    const issues: string[] = [];
    let autoFixable = false;
    let fixAction: string | undefined;

    try {
      // 检查是否为目录
      const stats = await fs.stat(skillPath);
      if (!stats.isDirectory()) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: '技能路径不是目录',
          autoFixable: false,
        };
      }

      // 读取目录内容
      const entries = await fs.readdir(skillPath, { withFileTypes: true });

      // 检查是否包含核心技能文件（SKILL.md 或 skill.md）
      const hasCoreFile = entries.some(
        (entry) =>
          entry.isFile() &&
          (entry.name.toLowerCase() === 'skill.md' ||
            entry.name.toLowerCase() === 'skill.yaml' ||
            entry.name.toLowerCase() === 'skill.json')
      );

      if (!hasCoreFile) {
        issues.push('缺少核心技能文件 (SKILL.md)');
        autoFixable = true;
        fixAction = 'create SKILL.md';
      }

      // 检查是否存在零散散落文件（根目录下的非目录文件，排除核心文件）
      const coreFileNames = ['skill.md', 'skill.yaml', 'skill.json'];
      const scatteredFiles = entries.filter(
        (entry) =>
          entry.isFile() && !coreFileNames.includes(entry.name.toLowerCase())
      );

      if (scatteredFiles.length > 0) {
        const fileNames = scatteredFiles.map((f) => f.name).join(', ');
        issues.push(`存在零散文件: ${fileNames}`);
        autoFixable = true;
        fixAction = 'move scattered files to subdirectory';
      }

      // 检查是否有合理的子目录结构（可选，非必须）
      const subdirs = entries.filter((entry) => entry.isDirectory());
      if (subdirs.length === 0 && !hasCoreFile) {
        issues.push('技能目录为空或无有效结构');
      }

      if (issues.length > 0) {
        return {
          dimension: this.dimension,
          status: 'fail',
          fixLevel: issues.some((i) => i.includes('缺少核心'))
            ? 'required'
            : 'recommended',
          message: '结构合规性检查失败',
          details: issues.join('; '),
          autoFixable,
          fixAction,
        };
      }

      return {
        dimension: this.dimension,
        status: 'pass',
        message: '结构合规性检查通过',
        autoFixable: false,
      };
    } catch (error) {
      return {
        dimension: this.dimension,
        status: 'fail',
        fixLevel: 'required',
        message: `结构检查异常: ${error instanceof Error ? error.message : String(error)}`,
        autoFixable: false,
      };
    }
  }
}

// 导出单例实例
export const structureChecker = new StructureChecker();
