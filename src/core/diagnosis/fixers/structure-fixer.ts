/**
 * 目录结构补齐修复器
 * 创建缺失的必要目录和文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Fixer, FixResult } from './types.js';
import { RemediationItem } from '../remediation-plan.js';

export class StructureFixer implements Fixer {
  action = 'create SKILL.md';

  async fix(item: RemediationItem, skillPath: string): Promise<FixResult> {
    try {
      const created: string[] = [];

      // 检查是否需要创建 SKILL.md
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      try {
        await fs.access(skillMdPath);
      } catch {
        // 文件不存在，创建默认 SKILL.md
        const defaultContent = this.generateDefaultSkillMd(skillPath);
        await fs.writeFile(skillMdPath, defaultContent, 'utf-8');
        created.push('SKILL.md');
      }

      // 检查是否需要创建 evals 目录
      const evalsPath = path.join(skillPath, 'evals');
      try {
        const stats = await fs.stat(evalsPath);
        if (!stats.isDirectory()) {
          throw new Error('Not a directory');
        }
      } catch {
        await fs.mkdir(evalsPath, { recursive: true });
        created.push('evals/');
      }

      if (created.length === 0) {
        return {
          success: true,
          description: '结构已完整，无需创建',
        };
      }

      return {
        success: true,
        description: `成功创建: ${created.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        description: `结构修复失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 生成默认 SKILL.md 内容
   */
  private generateDefaultSkillMd(skillPath: string): string {
    const skillName = path.basename(skillPath);

    return `---
name: ${skillName}
description: TODO: Add a description of this skill
---

# ${skillName}

## When to use this

TODO: Describe when this skill should be used

## When NOT to use this

TODO: Describe when this skill should NOT be used

## Definition of done

TODO: Define quantifiable completion criteria

`;
  }
}
