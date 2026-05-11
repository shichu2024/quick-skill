import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyConstraint } from '../../../src/core/constraint-applier.js';
import fs from 'fs';
import path from 'path';

/**
 * T-007 约束驱动的 SKILL.md 更新与用例调整 — 单元测试
 *
 * 覆盖 5 种约束类型的落地效果：
 * - positive-trigger → 新增隐式调用用例
 * - negative-prohibition → 新增负例控制用例
 * - success-criteria → 更新所有正向用例 pass_criteria
 * - execution-flow → 更新相关用例 pass_criteria
 * - style-norm → 更新相关用例 pass_criteria
 */

// ===== 测试辅助 =====

/** 创建临时 Skill 目录，包含 SKILL.md 和 evals/test-cases.csv */
function createTempSkillDir(tmpDir: string, skillName: string = 'test-skill'): string {
  const skillDir = path.join(tmpDir, skillName);
  const evalsDir = path.join(skillDir, 'evals');

  fs.mkdirSync(evalsDir, { recursive: true });

  // 创建 SKILL.md
  const skillMdContent = `---
name: ${skillName}
description: 一个用于测试的 Skill
---

## When to use this

当需要处理数据时

## When NOT to use this

当数据量小于 10 条时

## Definition of done

功能按预期工作

## What to build

数据处理管道
`;
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMdContent, 'utf-8');

  // 创建初始 CSV（包含正向、隐式、负例用例）
  const csvContent = `id,should_trigger,prompt,pass_criteria,custom,deprecated
${skillName}-explicit-1,true,$${skillName},功能按预期工作,false,false
${skillName}-implicit-1,true,我需要处理数据,功能按预期工作,false,false
${skillName}-negative-1,false,当数据量小于10条时,Skill 不应被触发,false,false
`;
  fs.writeFileSync(path.join(evalsDir, 'test-cases.csv'), csvContent, 'utf-8');

  // 创建初始快照
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(skillMdContent, 'utf-8').digest('hex');
  const snapshot = {
    content: skillMdContent,
    hash,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(evalsDir, '.skill-snapshot.json'),
    JSON.stringify(snapshot, null, 2),
    'utf-8'
  );

  return skillDir;
}

/** 清理临时目录 */
function cleanupDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('applyConstraint', () => {
  let tmpDir: string;
  let skillDir: string;

  beforeEach(() => {
    // 创建临时目录
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'constraint-applier-'));
    skillDir = createTempSkillDir(tmpDir);
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  // ===== AC-006-4: 正向触发约束 → 新增隐式调用用例 =====
  describe('AC-006-4: 正向触发约束落地', () => {
    it('应新增至少 1 条隐式调用用例', () => {
      const result = applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      expect(result.addedCaseCount).toBeGreaterThanOrEqual(1);
      // 验证新增的用例是隐式调用类型
      const csvPath = path.join(skillDir, 'evals', 'test-cases.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('implicit');
    });

    it('应将约束追加到 When to use this 章节', () => {
      const result = applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      expect(result.writtenSections).toContain('When to use this');

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
      expect(skillMdContent).toContain('当用户需要可视化报表时可使用此技能');
    });
  });

  // ===== AC-006-5: 负向禁止约束 → 新增负例控制用例 =====
  describe('AC-006-5: 负向禁止约束落地', () => {
    it('应新增至少 1 条负例控制用例', () => {
      const result = applyConstraint(skillDir, '禁止在实时流处理场景中使用此技能');

      expect(result.addedCaseCount).toBeGreaterThanOrEqual(1);
      // 验证新增的用例是负例类型
      const csvPath = path.join(skillDir, 'evals', 'test-cases.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('negative');
    });

    it('应将约束追加到 When NOT to use this 章节', () => {
      const result = applyConstraint(skillDir, '禁止在实时流处理场景中使用此技能');

      expect(result.writtenSections).toContain('When NOT to use this');

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
      expect(skillMdContent).toContain('禁止在实时流处理场景中使用此技能');
    });
  });

  // ===== AC-006-6: 成功标准约束 → 更新所有正向用例 pass_criteria =====
  describe('AC-006-6: 成功标准约束落地', () => {
    it('应更新所有正向用例的 pass_criteria', () => {
      const result = applyConstraint(skillDir, '必须生成符合 JSON Schema 的产出');

      expect(result.modifiedCaseCount).toBeGreaterThanOrEqual(1);

      // 验证正向用例的 pass_criteria 已更新
      const csvPath = path.join(skillDir, 'evals', 'test-cases.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('JSON Schema');
    });

    it('应将约束追加到 Definition of done 章节', () => {
      const result = applyConstraint(skillDir, '必须生成符合 JSON Schema 的产出');

      expect(result.writtenSections).toContain('Definition of done');

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
      expect(skillMdContent).toContain('必须生成符合 JSON Schema 的产出');
    });
  });

  // ===== AC-006-7: 执行流程约束 → 更新相关用例 pass_criteria =====
  describe('AC-006-7: 执行流程约束落地', () => {
    it('应更新相关用例的 pass_criteria', () => {
      const result = applyConstraint(skillDir, '构建步骤：先编译 TypeScript，再打包');

      expect(result.modifiedCaseCount).toBeGreaterThanOrEqual(1);

      const csvPath = path.join(skillDir, 'evals', 'test-cases.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('TypeScript');
    });

    it('应将约束追加到 What to build 章节', () => {
      const result = applyConstraint(skillDir, '构建步骤：先编译 TypeScript，再打包');

      expect(result.writtenSections).toContain('What to build');

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
      expect(skillMdContent).toContain('构建步骤：先编译 TypeScript');
    });
  });

  // ===== AC-006-7: 风格规范约束 → 更新相关用例 pass_criteria =====
  describe('AC-006-7: 风格规范约束落地', () => {
    it('应更新相关用例的 pass_criteria', () => {
      const result = applyConstraint(skillDir, '所有组件必须使用函数式写法');

      expect(result.modifiedCaseCount).toBeGreaterThanOrEqual(1);

      const csvPath = path.join(skillDir, 'evals', 'test-cases.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('函数式写法');
    });

    it('应将约束追加到 What to build 章节', () => {
      const result = applyConstraint(skillDir, '所有组件必须使用函数式写法');

      expect(result.writtenSections).toContain('What to build');

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
      expect(skillMdContent).toContain('所有组件必须使用函数式写法');
    });
  });

  // ===== AC-006-2: 约束追加到章节末尾，不覆盖 =====
  describe('AC-006-2: 约束追加不覆盖', () => {
    it('应将约束追加到章节末尾，保留原有内容', () => {
      applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');

      // 原有内容应保留
      expect(skillMdContent).toContain('当需要处理数据时');
      // 新约束应追加
      expect(skillMdContent).toContain('当用户需要可视化报表时可使用此技能');
      // 原有内容应在新约束之前
      const oldIndex = skillMdContent.indexOf('当需要处理数据时');
      const newIndex = skillMdContent.indexOf('当用户需要可视化报表时可使用此技能');
      expect(oldIndex).toBeLessThan(newIndex);
    });
  });

  // ===== AC-006-3: SKILL.md 更新前自动备份 =====
  describe('AC-006-3: SKILL.md 自动备份', () => {
    it('应在更新前备份 SKILL.md 到 .backup/ 目录', () => {
      applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      const backupDir = path.join(skillDir, 'evals', '.backup');
      expect(fs.existsSync(backupDir)).toBe(true);

      const backupFiles = fs.readdirSync(backupDir);
      // 备份文件名格式: {原文件名}.{时间戳}.bak{扩展名}，例如 SKILL.2026-05-09-14-47-50.bak.md
      const skillMdBackups = backupFiles.filter(f => f.includes('SKILL') && f.includes('.bak.'));
      expect(skillMdBackups.length).toBeGreaterThanOrEqual(1);
    });

    it('备份文件内容应与更新前一致', () => {
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const originalContent = fs.readFileSync(skillMdPath, 'utf-8');

      applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      const backupDir = path.join(skillDir, 'evals', '.backup');
      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.includes('SKILL') && f.includes('.bak.'))
        .sort();
      const latestBackup = path.join(backupDir, backupFiles[backupFiles.length - 1]);
      const backupContent = fs.readFileSync(latestBackup, 'utf-8');

      expect(backupContent).toBe(originalContent);
    });
  });

  // ===== AC-006-8: 终端输出约束落地结果 =====
  describe('AC-006-8: 终端输出约束落地结果', () => {
    it('应输出写入的 SKILL.md 章节', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('When to use this');
      expect(output).toContain('写入');

      consoleSpy.mockRestore();
    });

    it('应输出新增/修改的用例数量', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toMatch(/新增.*条/);

      consoleSpy.mockRestore();
    });
  });

  // ===== AC-006-9: 提示用户可执行 eval 验证 =====
  describe('AC-006-9: 提示用户执行 eval', () => {
    it('应提示用户可执行 quick-skill eval 验证约束效果', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('quick-skill eval');

      consoleSpy.mockRestore();
    });
  });

  // ===== AC-006-1: 完整流程 =====
  describe('AC-006-1: 完整流程', () => {
    it('应完成约束解析、SKILL.md 更新、用例调整、快照更新的完整流程', () => {
      const result = applyConstraint(skillDir, '当用户需要可视化报表时可使用此技能');

      // 验证返回结果结构完整
      expect(result).toHaveProperty('writtenSections');
      expect(result).toHaveProperty('addedCaseCount');
      expect(result).toHaveProperty('modifiedCaseCount');
      expect(result).toHaveProperty('snapshotUpdated');

      // 验证快照已更新
      expect(result.snapshotUpdated).toBe(true);

      // 验证快照文件已更新
      const snapshotPath = path.join(skillDir, 'evals', '.skill-snapshot.json');
      expect(fs.existsSync(snapshotPath)).toBe(true);
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
      expect(snapshot.content).toContain('当用户需要可视化报表时可使用此技能');
    });
  });

  // ===== 模糊约束处理 =====
  describe('模糊约束处理', () => {
    it('当约束无法分类时，不修改任何文件', () => {
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const originalContent = fs.readFileSync(skillMdPath, 'utf-8');

      const result = applyConstraint(skillDir, '这是一句无法分类的话');

      // 模糊约束不应写入任何章节
      expect(result.writtenSections).toHaveLength(0);
      expect(result.addedCaseCount).toBe(0);
      expect(result.modifiedCaseCount).toBe(0);
      // SKILL.md 内容不变
      expect(fs.readFileSync(skillMdPath, 'utf-8')).toBe(originalContent);
    });
  });

  // ===== 多分类约束处理 =====
  describe('多分类约束处理', () => {
    it('当约束匹配多个分类时，应写入所有章节', () => {
      // 这条约束同时匹配 positive-trigger 和 style-norm
      const result = applyConstraint(
        skillDir,
        '当开发组件时，所有组件必须使用函数式写法'
      );

      // 应写入多个章节
      expect(result.writtenSections.length).toBeGreaterThanOrEqual(2);
      expect(result.writtenSections).toContain('When to use this');
      expect(result.writtenSections).toContain('What to build');
    });
  });
});
