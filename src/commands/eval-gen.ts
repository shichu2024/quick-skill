import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { parseSkillMd } from '../core/skill-parser.js';
import { generateExplicitCases, generateImplicitCases } from '../core/explicit-implicit-generator.js';
import { generateContextCases, generateNegativeCases } from '../core/context-negative-generator.js';
import { writeCasesToCsv } from '../io/csv-writer.js';
import { generateSnapshot } from '../io/snapshot-manager.js';
import { findSkillDir, scanAllSkillsDetailed, SkillScanResult } from '../utils/skill-finder.js';
import { backupFile } from '../io/backup.js';

/**
 * 注册 eval-gen 命令
 * 用法: quick-skill eval-gen [skill-name] [--override] [--all]
 */
export function registerEvalGenCommand(program: Command): void {
  program
    .command('eval-gen')
    .description('为指定技能生成测试用例')
    .argument('[skill-name]', '技能名称')
    .option('--override', '覆盖已有的用例文件')
    .option('--all', '批量生成所有缺少用例的技能')
    .option('--output <dir>', '输出目录（默认为技能目录下的 evals）')
    .action(async (skillName: string | undefined, options: { override?: boolean; all?: boolean; output?: string }) => {
      try {
        if (options.all) {
          await evalGenAll(options);
        } else {
          if (!skillName) {
            console.error('错误: 请提供技能名称，或使用 --all 批量生成');
            process.exit(1);
          }
          await evalGen(skillName, options);
        }
        process.exit(0);
      } catch (error) {
        console.error(`错误: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

/**
 * 执行 eval-gen 核心逻辑
 */
export async function evalGen(skillName: string, options: { override?: boolean; output?: string }): Promise<void> {
  // 1. 查找技能目录
  const skillDir = findSkillDir(skillName);
  if (!skillDir) {
    throw new Error(`未找到技能: ${skillName}`);
  }

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`技能目录下缺少 SKILL.md: ${skillDir}`);
  }

  // 2. 解析 SKILL.md
  console.log(`📄 解析技能文件: ${skillMdPath}`);
  const anchor = parseSkillMd(skillMdPath);
  console.log(`✅ 成功解析: ${anchor.name}`);

  // 3. 确定输出目录
  const outputDir = options.output || path.join(skillDir, 'evals');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 4. 检查是否已有用例文件
  const casesFilePath = path.join(outputDir, 'test-cases.csv');
  const backupDir = path.join(outputDir, '.backup');

  if (fs.existsSync(casesFilePath)) {
    if (!options.override) {
      console.log(`⚠️  已存在用例文件: ${casesFilePath}`);
      console.log('如需覆盖，请使用 --override 参数');
      return;
    }

    // --override 模式：先备份再覆盖
    console.log(`📦 备份已有用例文件...`);
    const backupPath = backupFile(casesFilePath, backupDir);
    console.log(`✅ 已备份到: ${backupPath}`);
  }

  // 5. 生成四类用例
  console.log('🔧 生成测试用例...');
  const explicitCases = generateExplicitCases(anchor);
  const implicitCases = generateImplicitCases(anchor);
  const contextCases = generateContextCases(anchor);
  const negativeCases = generateNegativeCases(anchor);

  const allCases = [
    ...explicitCases,
    ...implicitCases,
    ...contextCases,
    ...negativeCases,
  ];

  console.log(`  - 显式调用: ${explicitCases.length} 条`);
  console.log(`  - 隐式调用: ${implicitCases.length} 条`);
  console.log(`  - 上下文/噪声: ${contextCases.length} 条`);
  console.log(`  - 负例控制: ${negativeCases.length} 条`);
  console.log(`  - 总计: ${allCases.length} 条`);

  // 6. 写入 CSV
  writeCasesToCsv(casesFilePath, allCases);
  console.log(`✅ 用例已保存: ${casesFilePath}`);

  // 7. 生成快照
  const snapshot = generateSnapshot(skillMdPath, outputDir);
  console.log(`✅ 快照已生成: ${path.join(outputDir, '.skill-snapshot.json')}`);
  console.log(`   哈希: ${snapshot.hash.substring(0, 16)}...`);

  console.log('\n🎉 测试用例生成完成!');
}

/**
 * 批量生成所有缺少用例的技能
 */
export async function evalGenAll(options: { override?: boolean; output?: string }): Promise<void> {
  console.log('🔍 扫描所有技能...');
  const allSkills = scanAllSkillsDetailed();

  if (allSkills.length === 0) {
    console.log('⚠️  未找到任何技能');
    return;
  }

  console.log(`📋 共发现 ${allSkills.length} 个技能`);

  // 过滤需要处理的技能
  const skillsToProcess = allSkills.filter(skill => {
    if (options.override) {
      return true; // --override 时处理所有技能
    }
    return !skill.hasExistingCases; // 默认只处理没有用例的技能
  });

  if (skillsToProcess.length === 0) {
    console.log('✅ 所有技能都已有用例，无需生成');
    return;
  }

  console.log(`🚀 将处理 ${skillsToProcess.length} 个技能\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const failures: { name: string; error: string }[] = [];

  // 串行处理每个技能
  for (const skill of skillsToProcess) {
    try {
      console.log(`\n--- 处理技能: ${skill.name} (分类: ${skill.category}) ---`);

      const skillMdPath = path.join(skill.dirPath, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        console.log(`⚠️  跳过: 缺少 SKILL.md`);
        skipCount++;
        continue;
      }

      // 复用 evalGen 的核心逻辑，但不退出进程
      await evalGenForSkill(skill.name, skill.dirPath, options);
      successCount++;
    } catch (error) {
      console.log(`❌ 失败: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
      failures.push({ name: skill.name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // 输出汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 批量生成汇总:');
  console.log(`  ✅ 成功: ${successCount}`);
  console.log(`  ⏭️  跳过: ${skipCount}`);
  console.log(`  ❌ 失败: ${failCount}`);

  if (failures.length > 0) {
    console.log('\n失败详情:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

/**
 * 为单个技能执行生成逻辑（不退出进程，供批量模式调用）
 */
async function evalGenForSkill(skillName: string, skillDir: string, options: { override?: boolean; output?: string }): Promise<void> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  // 解析 SKILL.md
  const anchor = parseSkillMd(skillMdPath);

  // 确定输出目录
  const outputDir = options.output || path.join(skillDir, 'evals');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 检查是否已有用例文件
  const casesFilePath = path.join(outputDir, 'test-cases.csv');
  const backupDir = path.join(outputDir, '.backup');

  if (fs.existsSync(casesFilePath)) {
    if (!options.override) {
      console.log(`⏭️  已存在用例文件，跳过`);
      return;
    }

    // --override 模式：先备份再覆盖
    const backupPath = backupFile(casesFilePath, backupDir);
    console.log(`📦 已备份到: ${path.basename(backupPath)}`);
  }

  // 生成四类用例
  const explicitCases = generateExplicitCases(anchor);
  const implicitCases = generateImplicitCases(anchor);
  const contextCases = generateContextCases(anchor);
  const negativeCases = generateNegativeCases(anchor);

  const allCases = [
    ...explicitCases,
    ...implicitCases,
    ...contextCases,
    ...negativeCases,
  ];

  // 写入 CSV
  writeCasesToCsv(casesFilePath, allCases);

  // 生成快照
  generateSnapshot(skillMdPath, outputDir);

  console.log(`✅ 生成 ${allCases.length} 条用例`);
}

export default registerEvalGenCommand;
