/**
 * diagnose CLI 命令 - 技能合规性诊断
 */

import * as path from 'path';
import { defaultEngine } from '../core/diagnosis/diagnosis-engine.js';
import { defaultRegistry } from '../core/diagnosis/checker-registry.js';
import { structureChecker } from '../core/diagnosis/checkers/structure-checker.js';
import { metadataChecker } from '../core/diagnosis/checkers/metadata-checker.js';
import { boundaryChecker } from '../core/diagnosis/checkers/boundary-checker.js';
import { standardChecker } from '../core/diagnosis/checkers/standard-checker.js';
import { formatChecker } from '../core/diagnosis/checkers/format-checker.js';
import { evaluationChecker } from '../core/diagnosis/checkers/evaluation-checker.js';
import { compatibilityChecker } from '../core/diagnosis/checkers/compatibility-checker.js';
import { defaultScoringEngine } from '../core/diagnosis/scoring-engine.js';
import { defaultMarkdownReportGenerator } from '../core/diagnosis/report/markdown-report.js';
import { defaultRemediationPlanGenerator } from '../core/diagnosis/remediation-plan.js';
import { defaultBatchDiagnosisEngine } from '../core/diagnosis/batch-diagnosis.js';
import { defaultBatchReportGenerator } from '../core/diagnosis/report/batch-report.js';
import { defaultAutoFixEngine } from '../core/diagnosis/auto-fix-engine.js';

interface DiagnoseOptions {
  output?: string;
  fixAuto?: boolean;
  batch?: boolean;
  filter?: string;
}

// 注册所有检查器到默认注册表
defaultRegistry.register(structureChecker, 1);
defaultRegistry.register(metadataChecker, 2);
defaultRegistry.register(boundaryChecker, 3);
defaultRegistry.register(standardChecker, 4);
defaultRegistry.register(formatChecker, 5);
defaultRegistry.register(evaluationChecker, 6);
defaultRegistry.register(compatibilityChecker, 7);

/**
 * 诊断命令处理函数
 * @param skillPath 技能路径（位置参数）
 * @param options 命令选项
 */
export default async function diagnoseCommand(
  skillPath: string,
  options: DiagnoseOptions
): Promise<void> {
  const { output, fixAuto, batch, filter } = options;

  // V1: 提示未实现的功能
  if (fixAuto) {
    console.log(
      '⚠️  自动修复功能 (--fix-auto) 已启用，将在诊断后执行修复'
    );
  }

  try {
    // 解析路径
    const resolvedPath = path.resolve(skillPath);

    // 判断是否批量诊断
    if (batch) {
      await handleBatchDiagnosis(resolvedPath, output, filter);
    } else {
      await handleSingleDiagnosis(resolvedPath, output, fixAuto);
    }
  } catch (error) {
    console.error(
      `\n❌ 诊断失败: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * 处理单技能诊断
 */
async function handleSingleDiagnosis(
  resolvedPath: string,
  output?: string,
  fixAuto?: boolean
): Promise<void> {
  // 执行诊断
  console.log(`🔍 开始诊断技能: ${resolvedPath}`);
  const result = await defaultEngine.diagnose(resolvedPath);

  // 输出结果摘要
  console.log(`\n✅ 诊断完成: ${result.skillName}`);
  console.log(`📅 时间: ${result.timestamp}`);
  console.log(`📊 检查项数: ${result.checks.length}`);
  if (result.score !== undefined) {
    console.log(`🎯 合规评分: ${result.score}/100`);
  }

  // 按维度输出检查结果
  console.log('\n📋 维度检查结果:');
  for (const check of result.checks) {
    const statusIcon =
      check.status === 'pass'
        ? '✅'
        : check.status === 'fail'
        ? '❌'
        : '⚠️';
    console.log(`  ${statusIcon} ${check.dimension}: ${check.message}`);
    if (check.details) {
      console.log(`     ${check.details}`);
    }
    if (check.status === 'fail' && check.fixLevel) {
      console.log(
        `     修复等级: ${check.fixLevel}${check.autoFixable ? ' (可自动修复)' : ''}`
      );
    }
  }

  // 生成报告（如果指定了 --output）
  if (output) {
    const scoringResult = defaultScoringEngine.calculateScore(result);
    const remediationPlan = defaultRemediationPlanGenerator.generate(result);

    const reportPath = await defaultMarkdownReportGenerator.generateToFile(
      result,
      scoringResult,
      output,
      remediationPlan
    );
    console.log(`\n📄 报告已生成: ${reportPath}`);
  }

  // 自动修复（如果指定了 --fix-auto）
  if (fixAuto) {
    console.log('\n🔧 开始自动修复...');
    const remediationPlan = defaultRemediationPlanGenerator.generate(result);

    if (remediationPlan.autoFixableItems.length === 0) {
      console.log('✅ 无需自动修复项');
    } else {
      const fixResult = await defaultAutoFixEngine.execute(
        remediationPlan,
        resolvedPath
      );

      console.log(`📊 修复结果: ${fixResult.fixedCount} 项已修复`);
      for (const msg of fixResult.summary) {
        console.log(`  ${msg}`);
      }
      if (fixResult.failures) {
        console.log('\n⚠️  修复失败项:');
        for (const msg of fixResult.failures) {
          console.log(`  ${msg}`);
        }
      }
      if (fixResult.backupPath) {
        console.log(`\n💾 备份路径: ${fixResult.backupPath}`);
      }
    }
  }
}

/**
 * 处理批量诊断
 */
async function handleBatchDiagnosis(
  resolvedPath: string,
  output?: string,
  filter?: string
): Promise<void> {
  console.log(`🔍 开始批量诊断目录: ${resolvedPath}`);

  const batchResult = await defaultBatchDiagnosisEngine.diagnoseBatch(
    resolvedPath,
    {
      filter: filter || 'SKILL.md',
      onProgress: (current, total, skillName) => {
        // 进度已在 batch-diagnosis.ts 中输出
      },
    }
  );

  // 输出汇总统计
  console.log(`\n✅ 批量诊断完成`);
  console.log(`📊 总扫描数: ${batchResult.totalScanned}`);
  console.log(`✅ 合规数: ${batchResult.compliantCount}`);
  console.log(`❌ 不合规数: ${batchResult.nonCompliantCount}`);
  console.log(`⚠️  诊断失败: ${batchResult.failedCount}`);

  // 生成汇总报告（如果指定了 --output）
  if (output) {
    const reportPath = await defaultBatchReportGenerator.generateToFile(
      batchResult,
      output
    );
    console.log(`\n📄 汇总报告已生成: ${reportPath}`);
  }
}
