import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import { syncSkillCases } from '../../core/sync-engine.js';
import { applyConstraint } from '../../core/constraint-applier.js';
import { findSkillDir, scanAllSkillsDetailed } from '../../utils/skill-finder.js';
import { parseSkillMd } from '../../core/skill-parser.js';
import {
  generateExplicitCases,
  generateImplicitCases,
} from '../../core/explicit-implicit-generator.js';
import { generateContextCases, generateNegativeCases } from '../../core/context-negative-generator.js';
import { writeCasesToCsv } from '../../io/csv-writer.js';
import { readCasesFromCsv } from '../../io/csv-reader.js';
import { generateSnapshot } from '../../io/snapshot-manager.js';
import { backupFile, listBackups, restoreFromBackup } from '../../io/backup.js';
import { TestCase } from '../../types/test-case.js';

/**
 * 批量同步结果
 */
export interface EvalSyncAllResult {
  /** 已同步的技能数量 */
  synced: number;
  /** 跳过的技能名称列表 */
  skipped: string[];
  /** 失败的技能列表（含名称和错误信息） */
  failed: Array<{ name: string; error: string }>;
}

/**
 * 注册 eval-sync 命令
 * 用法:
 *   quick-skill eval-sync [skill-name]              增量同步
 *   quick-skill eval-sync [skill-name] --override    全量覆盖
 *   quick-skill eval-sync [skill-name] --constraint  约束驱动
 *   quick-skill eval-sync --all                      批量同步（T-009）
 */
export function registerEvalSyncCommand(program: Command): void {
  program
    .command('eval-sync')
    .description('同步 Skill 的测试用例与 SKILL.md 保持一致')
    .argument('[skill-name]', '技能名称')
    .option('--override', '全量覆盖模式：重新生成所有用例')
    .option('--constraint <text>', '约束驱动模式：将约束追加到 SKILL.md 并调整用例')
    .option('--all', '批量同步所有 Skill（T-009）')
    .action(async (skillName: string | undefined, options: {
      override?: boolean;
      constraint?: string;
      all?: boolean;
    }) => {
      try {
        // --all 批量同步模式（T-009）
        if (options.all) {
          const batchResult = await evalSyncAll(options);
          // 退出码：存在失败返回 1，否则返回 0
          process.exit(batchResult.failed.length > 0 ? 1 : 0);
          return;
        }

        // 校验：非批量模式必须提供技能名称
        if (!skillName) {
          console.error('错误: 请提供技能名称，或使用 --all 批量同步');
          process.exit(1);
        }

        // --constraint 约束驱动模式
        if (options.constraint) {
          await evalSyncConstraint(skillName, options.constraint);
          process.exit(0);
          return;
        }

        // --override 全量覆盖模式
        if (options.override) {
          await evalSyncOverride(skillName);
          process.exit(0);
          return;
        }

        // 默认：增量同步模式
        await evalSyncIncremental(skillName);
        process.exit(0);
      } catch (error) {
        console.error(`错误: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

/**
 * 增量同步模式：调用 T-006 的 syncSkillCases
 *
 * @param skillName - 技能名称
 */
async function evalSyncIncremental(skillName: string): Promise<void> {
  const skillDir = findSkillDir(skillName);
  if (!skillDir) {
    throw new Error(`未找到技能: ${skillName}`);
  }

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`技能目录下缺少 SKILL.md: ${skillDir}`);
  }

  console.log(`🔄 开始增量同步: ${skillName}`);
  const result = syncSkillCases(skillDir);

  console.log(`\n✅ 增量同步完成`);
  console.log(`  新增: ${result.added}`);
  console.log(`  修改: ${result.modified}`);
  console.log(`  停用: ${result.deprecated}`);
  console.log(`  冲突: ${result.conflicts}`);
  if (result.skipped.length > 0) {
    console.log(`  跳过: ${result.skipped.join(', ')}`);
  }
}

/**
 * 全量覆盖模式：重新生成所有用例，同时保护 custom=true 用例
 *
 * 流程:
 * 1. 查找技能目录
 * 2. 备份当前 CSV 到 ./evals/.backup/
 * 3. 提示用户确认（y/N）
 * 4. 用户拒绝时终止
 * 5. 全量重新生成用例
 * 6. 从备份中恢复 custom=true 用例
 * 7. 写入 CSV 并更新快照
 *
 * @param skillName - 技能名称
 * @param skillDirOverride - 可选，直接指定技能目录（用于测试）
 */
export async function evalSyncOverride(skillName: string, skillDirOverride?: string): Promise<void> {
  const skillDir = skillDirOverride || findSkillDir(skillName);
  if (!skillDir) {
    throw new Error(`未找到技能: ${skillName}`);
  }

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`技能目录下缺少 SKILL.md: ${skillDir}`);
  }

  const evalsDir = path.join(skillDir, 'evals');
  const csvPath = path.join(evalsDir, 'test-cases.csv');
  const backupDir = path.join(evalsDir, '.backup');

  // ===== 步骤 1：备份当前用例文件 =====
  let hasExistingCases = false;
  let customCases: TestCase[] = [];

  if (fs.existsSync(csvPath)) {
    hasExistingCases = true;
    console.log(`📦 备份当前用例文件...`);

    // 读取当前用例，提取 custom=true 的用例
    const currentCases = readCasesFromCsv(csvPath);
    customCases = currentCases.filter((c) => c.custom);

    // 执行备份
    const backupPath = backupFile(csvPath, backupDir);
    console.log(`  已备份到: ${path.relative(process.cwd(), backupPath)}`);
  }

  // ===== 步骤 2：提示用户确认 =====
  console.log(`\n⚠️  即将覆盖以下用例文件:`);
  console.log(`  ${path.relative(process.cwd(), csvPath)}`);

  if (customCases.length > 0) {
    console.log(`\n  将保留 ${customCases.length} 条自定义用例 (custom=true)`);
  }

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: '确认覆盖？',
      default: false,
    },
  ]);

  if (!confirmed) {
    // AC-007-4: 用户拒绝时终止，不修改任何文件
    console.log('\n❌ 覆盖已取消，未修改任何文件');
    process.exit(0);
    return;
  }

  // ===== 步骤 3：解析 SKILL.md =====
  console.log(`\n📄 解析技能文件: ${skillMdPath}`);
  const anchor = parseSkillMd(skillMdPath);
  console.log(`✅ 成功解析: ${anchor.name}`);

  // ===== 步骤 4：全量重新生成四类用例 =====
  console.log('\n🔧 全量重新生成测试用例...');
  const explicitCases = generateExplicitCases(anchor);
  const implicitCases = generateImplicitCases(anchor);
  const contextCases = generateContextCases(anchor);
  const negativeCases = generateNegativeCases(anchor);

  let allCases: TestCase[] = [
    ...explicitCases,
    ...implicitCases,
    ...contextCases,
    ...negativeCases,
  ];

  console.log(`  - 显式调用: ${explicitCases.length} 条`);
  console.log(`  - 隐式调用: ${implicitCases.length} 条`);
  console.log(`  - 上下文/噪声: ${contextCases.length} 条`);
  console.log(`  - 负例控制: ${negativeCases.length} 条`);
  console.log(`  - 系统生成总计: ${allCases.length} 条`);

  // ===== 步骤 5：恢复 custom=true 用例 =====
  if (customCases.length > 0) {
    console.log(`\n♻️  恢复 ${customCases.length} 条自定义用例...`);
    allCases = [...allCases, ...customCases];
  }

  // ===== 步骤 6：确保 evals 目录存在 =====
  if (!fs.existsSync(evalsDir)) {
    fs.mkdirSync(evalsDir, { recursive: true });
  }

  // ===== 步骤 7：写入 CSV =====
  writeCasesToCsv(csvPath, allCases);
  console.log(`\n✅ 用例已保存: ${path.relative(process.cwd(), csvPath)}`);
  console.log(`  总计: ${allCases.length} 条（含 ${customCases.length} 条自定义）`);

  // ===== 步骤 8：更新快照 =====
  const snapshot = generateSnapshot(skillMdPath, evalsDir);
  console.log(`✅ 快照已更新: ${path.relative(process.cwd(), path.join(evalsDir, '.skill-snapshot.json'))}`);
  console.log(`   哈希: ${snapshot.hash.substring(0, 16)}...`);

  console.log('\n🎉 全量覆盖同步完成!');
}

/**
 * 约束驱动模式：调用 T-007 的 applyConstraint
 *
 * @param skillName - 技能名称
 * @param constraintText - 约束文本
 */
async function evalSyncConstraint(skillName: string, constraintText: string): Promise<void> {
  const skillDir = findSkillDir(skillName);
  if (!skillDir) {
    throw new Error(`未找到技能: ${skillName}`);
  }

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`技能目录下缺少 SKILL.md: ${skillDir}`);
  }

  console.log(`🔗 开始约束驱动同步: ${skillName}`);
  console.log(`  约束: ${constraintText}`);

  const result = applyConstraint(skillDir, constraintText);

  console.log(`\n✅ 约束落地完成`);
  console.log(`  写入章节: ${result.writtenSections.join(', ') || '无'}`);
  console.log(`  新增用例: ${result.addedCaseCount} 条`);
  console.log(`  修改用例: ${result.modifiedCaseCount} 条`);
  console.log(`  快照已更新: ${result.snapshotUpdated ? '是' : '否'}`);
  console.log('');
  console.log('提示: 可执行 `quick-skill eval` 验证约束效果');
}

/**
 * 批量同步所有 Skill（T-009 完整实现）
 *
 * 流程:
 * 1. 扫描 ./skills/ 下所有业务分类子目录中的 Skill
 * 2. 对每个 Skill 检测是否存在 SKILL.md 变更
 * 3. 有变更的执行增量同步，无变更的跳过
 * 4. 单个 Skill 失败不阻塞其他
 * 5. 输出汇总：已同步数量、跳过数量、失败数量及原因
 *
 * @param options - 选项
 * @returns 批量同步结果（调用方可通过 result.failed.length > 0 判断退出码）
 */
export async function evalSyncAll(options: { override?: boolean; constraint?: string }): Promise<EvalSyncAllResult> {
  console.log('🔍 扫描所有技能...');
  const allSkills = scanAllSkillsDetailed();

  if (allSkills.length === 0) {
    console.log('⚠️  未找到任何技能');
    return { synced: 0, skipped: [], failed: [] };
  }

  console.log(`📋 共发现 ${allSkills.length} 个技能\n`);

  // 汇总结果
  const result: EvalSyncAllResult = {
    synced: 0,
    skipped: [],
    failed: [],
  };

  // 串行遍历所有技能
  for (const skill of allSkills) {
    const skillName = skill.name;
    console.log(`\n--- 处理: ${skillName} [${skill.category}] ---`);

    try {
      // 查找技能目录
      const skillDir = findSkillDir(skillName);
      if (!skillDir) {
        result.failed.push({ name: skillName, error: '未找到技能目录' });
        console.log(`  ❌ 未找到技能目录`);
        continue;
      }

      // 检查 SKILL.md 是否存在
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        result.failed.push({ name: skillName, error: '缺少 SKILL.md 文件' });
        console.log(`  ❌ 缺少 SKILL.md 文件`);
        continue;
      }

      // 执行增量同步（syncSkillCases 内部会检测变更，无变更时直接返回全零结果）
      const syncResult = syncSkillCases(skillDir);

      // 判断是否有实际同步操作
      const hasSyncActions = syncResult.added > 0 || syncResult.modified > 0 || syncResult.deprecated > 0;

      if (hasSyncActions) {
        result.synced++;
        console.log(`  ✅ 已同步 (新增: ${syncResult.added}, 修改: ${syncResult.modified}, 停用: ${syncResult.deprecated})`);
      } else {
        result.skipped.push(skillName);
        console.log(`  ⏭️  跳过 (无变更)`);
      }
    } catch (error) {
      // 单个 Skill 失败不阻塞其他
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed.push({ name: skillName, error: errorMessage });
      console.log(`  ❌ 失败: ${errorMessage}`);
    }
  }

  // 输出汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 批量同步汇总');
  console.log('='.repeat(50));
  console.log(`  总计扫描: ${allSkills.length}`);
  console.log(`  ✅ 已同步: ${result.synced}`);
  console.log(`  ⏭️  跳过:   ${result.skipped.length}`);
  if (result.skipped.length > 0) {
    console.log(`           (${result.skipped.join(', ')})`);
  }
  console.log(`  ❌ 失败:   ${result.failed.length}`);
  if (result.failed.length > 0) {
    for (const f of result.failed) {
      console.log(`           - ${f.name}: ${f.error}`);
    }
  }
  console.log('='.repeat(50));

  return result;
}

export default registerEvalSyncCommand;
