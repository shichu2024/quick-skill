import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { findSkillDir, scanAllSkillsDetailed } from '../../utils/skill-finder.js';
import { loadCases } from '../../eval/case-loader.js';
import { createSandbox, cleanupSandbox } from '../../eval/sandbox-manager.js';
import { runDeterministicEval } from '../../eval/deterministic-engine.js';
import type { CheckContext } from '../../eval/checkers/result-checker.js';
import { scoreCase, scoreSkill, scoreAllSkills } from '../../eval/scorer.js';
import { persistResult } from '../../eval/persistence.js';
import { detectRegression } from '../../eval/regression-detector.js';
import { generateHtmlReport } from '../../eval/report-generator.js';
import { createTraceCollector } from '../../eval/trace-collector.js';
import { parseSkillMd } from '../../core/skill-parser.js';
import { readSnapshot } from '../../io/snapshot-manager.js';
import type { CaseEvalResult, SkillScore } from '../../types/eval.js';
import type { RubricSchema } from '../../types/rubric.js';
import type { RegressionResult } from '../../eval/regression-detector.js';

// ==================== 批量评测类型定义 ====================

/**
 * 批量评测中单个 Skill 的结果
 */
export interface BatchSkillResult {
  /** Skill 名称 */
  skillName: string;
  /** Skill 业务分类 */
  category: string;
  /** 是否评测成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
  /** Skill 级别打分结果（成功时） */
  skillScore?: SkillScore;
  /** 回归检测结果 */
  regression?: RegressionResult;
}

/**
 * 批量/全量评测汇总结果
 */
export interface BatchEvalSummary {
  /** 总评测 Skill 数 */
  totalSkills: number;
  /** 成功评测的 Skill 数 */
  successCount: number;
  /** 评测失败的 Skill 数 */
  failCount: number;
  /** 跳过的 Skill 数（增量评测时） */
  skippedCount: number;
  /** 平均分 */
  averageScore: number;
  /** Top 3 高风险 Skill（分数最低的 3 个） */
  topRiskSkills: SkillScore[];
  /** 回归项总数 */
  regressionCount: number;
  /** 所有 Skill 的评测结果 */
  results: BatchSkillResult[];
}

/**
 * 批量评测选项
 */
export interface BatchEvalOptions {
  /** Skills 根目录 */
  skillsRoot?: string;
  /** 评测归档根目录 */
  evalRoot?: string;
  /** 并发数（默认 5） */
  concurrency?: number;
  /** 按分类筛选 */
  category?: string;
  /** 是否增量评测 */
  incremental?: boolean;
  /** Rubric Schema（可选） */
  rubricSchema?: RubricSchema;
  /** 超时时间（秒） */
  timeoutSeconds?: number;
}

// ==================== 默认常量 ====================

const DEFAULT_CONCURRENCY = 5;

/**
 * 注册 eval 命令
 *
 * 用法:
 *   quick-skill eval [skill-name]                     单 Skill 评测
 *   quick-skill eval skill1,skill2,...                批量评测指定 Skill
 *   quick-skill eval --all                            全量评测
 *   quick-skill eval --all --concurrency 10           全量评测，并发 10
 *   quick-skill eval --all --category core            仅评测 core 分类
 *   quick-skill eval --all --incremental              仅评测有变更的 Skill
 *   quick-skill eval [skill-name] --rubric <path>     启用模型辅助评测
 *   quick-skill eval [skill-name] --timeout <seconds> 自定义超时时间
 *
 * @param program Commander 实例
 */
export function registerEvalCommand(program: Command): void {
  program
    .command('eval')
    .description('评测 Skill 的测试用例（支持单 Skill、批量、全量模式）')
    .argument('[skill-name]', '要评测的技能名称，支持逗号分隔多个: skill1,skill2,...')
    .option('--all', '全量评测 ./skills/ 下所有 Skill')
    .option('--concurrency <number>', '并发数（默认 5）', '5')
    .option('--category <name>', '按 Skill 业务分类筛选')
    .option('--incremental', '仅测试上次后有变更的 Skill')
    .option('--rubric <schema-path>', '启用模型辅助评测，指定 Rubric Schema 文件路径')
    .option('--timeout <seconds>', '单条用例超时时间（秒），默认 10，最大 30', '10')
    .action(async (skillName: string | undefined, options: {
      all?: boolean;
      concurrency: string;
      category?: string;
      incremental?: boolean;
      rubric?: string;
      timeout: string;
    }) => {
      try {
        // 解析超时参数
        const timeoutSeconds = parseTimeout(options.timeout);

        // 加载 Rubric Schema（如果指定）
        let rubricSchema: RubricSchema | undefined;
        if (options.rubric) {
          rubricSchema = loadRubricSchema(options.rubric);
        }

        // 解析并发数
        const concurrency = parseConcurrency(options.concurrency);

        // 判断评测模式
        if (options.all) {
          // 全量评测模式
          const summary = await evalAllSkills({
            concurrency,
            category: options.category,
            incremental: options.incremental ?? false,
            rubricSchema,
            timeoutSeconds,
          });

          // 根据结果设置退出码
          process.exit(summary.failCount > 0 ? 1 : 0);
        } else if (skillName) {
          // 解析逗号分隔的 Skill 列表
          const skillNames = skillName.split(',').map(s => s.trim()).filter(s => s.length > 0);

          if (skillNames.length === 1) {
            // 单 Skill 模式
            const result = await evalSingleSkill(skillNames[0], timeoutSeconds, rubricSchema);
            process.exit(result.hasFailure ? 1 : 0);
          } else {
            // 批量评测模式
            const summary = await evalBatchSkills(skillNames, {
              concurrency,
              category: options.category,
              incremental: options.incremental ?? false,
              rubricSchema,
              timeoutSeconds,
            });

            // 根据结果设置退出码
            process.exit(summary.failCount > 0 ? 1 : 0);
          }
        } else {
          // 既没有指定 Skill 也没有 --all，提示用户
          console.error('错误: 请指定 Skill 名称或使用 --all 进行全量评测');
          console.error('用法:');
          console.error('  quick-skill eval <skill-name>          单 Skill 评测');
          console.error('  quick-skill eval skill1,skill2,...     批量评测');
          console.error('  quick-skill eval --all                 全量评测');
          process.exit(1);
        }
      } catch (error) {
        console.error(`错误: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

/**
 * 解析并发数参数
 *
 * @param concurrencyStr 并发数字符串
 * @returns 规范化后的并发数（最小 1）
 */
function parseConcurrency(concurrencyStr: string): number {
  const concurrency = parseInt(concurrencyStr, 10);
  if (isNaN(concurrency) || concurrency < 1) {
    return DEFAULT_CONCURRENCY;
  }
  return concurrency;
}

/**
 * 解析超时参数
 *
 * @param timeoutStr 超时字符串（秒）
 * @returns 规范化后的超时秒数
 */
function parseTimeout(timeoutStr: string): number {
  const seconds = parseFloat(timeoutStr);
  if (isNaN(seconds) || seconds <= 0) {
    return 10; // 默认 10 秒
  }
  // 最大不超过 30 秒
  return Math.min(seconds, 30);
}

/**
 * 从文件加载 Rubric Schema
 *
 * @param schemaPath Schema 文件路径
 * @returns 解析后的 RubricSchema
 */
function loadRubricSchema(schemaPath: string): RubricSchema {
  const resolvedPath = path.resolve(schemaPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Rubric Schema 文件不存在: ${resolvedPath}`);
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const schema = JSON.parse(content) as RubricSchema;

    // 基本校验
    if (!schema.dimensions || !Array.isArray(schema.dimensions)) {
      throw new Error('Rubric Schema 缺少 dimensions 数组');
    }
    if (typeof schema.passingThreshold !== 'number') {
      throw new Error('Rubric Schema 缺少 passingThreshold 数值');
    }

    return schema;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Rubric Schema JSON 格式错误: ${(error as Error).message}`);
    }
    throw error;
  }
}

/**
 * 单 Skill 评测结果
 */
interface EvalResult {
  /** 是否存在失败的用例 */
  hasFailure: boolean;
  /** Skill 级别打分结果 */
  skillScore: import('../../types/eval.js').SkillScore;
  /** 回归检测结果 */
  regression: RegressionResult;
  /** 归档目录路径 */
  archiveDir: string;
  /** HTML 报告路径 */
  htmlPath: string;
}

/**
 * 执行单个 Skill 的完整评测流程
 *
 * 流程:
 * 1. 查找 Skill 目录
 * 2. 加载用例
 * 3. 逐条执行评测（沙箱 → 确定性评测 → 可选 Rubric → 打分）
 * 4. 计算 Skill 级别分数
 * 5. 持久化结果
 * 6. 回归检测
 * 7. 生成 HTML 报告
 * 8. 输出汇总
 *
 * @param skillName 技能名称
 * @param timeoutSeconds 单条用例超时（秒）
 * @param rubricSchema 可选的 Rubric Schema
 * @returns 评测结果
 */
export async function evalSingleSkill(
  skillName: string,
  timeoutSeconds: number,
  rubricSchema?: RubricSchema,
  skillsRootOverride?: string,
  evalRootOverride?: string
): Promise<EvalResult> {
  // 设置评测根目录（用于持久化和回归检测）
  const originalEvalRoot = process.env.QUICK_SKILL_EVAL_ROOT;
  if (evalRootOverride) {
    process.env.QUICK_SKILL_EVAL_ROOT = evalRootOverride;
  }

  try {
    // ===== 步骤 1：查找 Skill 目录 =====
  const skillDir = findSkillDir(skillName, skillsRootOverride);
  if (!skillDir) {
    throw new Error(`未找到 Skill: ${skillName}。请确保技能存在于 ./skills/ 目录下。`);
  }

  console.log(`🎯 开始评测 Skill: ${skillName}`);
  console.log(`   目录: ${skillDir}`);
  console.log('');

  // ===== 步骤 2：解析 SKILL.md =====
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`Skill 目录下缺少 SKILL.md: ${skillDir}`);
  }

  const skillAnchor = parseSkillMd(skillMdPath);

  // ===== 步骤 3：加载用例 =====
  const loadResult = loadCases(skillDir);

  // 检查是否无用例文件
  if (loadResult.warnings.length > 0 && loadResult.cases.length === 0) {
    console.log('⚠️  未找到用例文件');
    console.log('提示: 请先执行 `quick-skill eval-gen ' + skillName + '` 生成用例');
    process.exit(0);
    // 这里的 return 不会被执行，但为了类型安全保留
    return {
      hasFailure: false,
      skillScore: { skillName: '', score: 0, positivePassRate: 0, negativePassRate: 0, rubricAvgScore: null, caseScores: [], formula: '' },
      regression: { isFirstRun: true, regressions: [], hasRegression: false, previousScore: null, scoreDelta: null },
      archiveDir: '',
      htmlPath: '',
    };
  }

  // 过滤出有效用例
  const validCases = loadResult.cases.filter(c => c.isValid);

  if (validCases.length === 0) {
    console.log('⚠️  没有有效的用例可评测');
    if (loadResult.warnings.length > 0) {
      console.log('警告:');
      for (const warning of loadResult.warnings) {
        console.log(`  - ${warning}`);
      }
    }
    process.exit(0);
    return {
      hasFailure: false,
      skillScore: { skillName: '', score: 0, positivePassRate: 0, negativePassRate: 0, rubricAvgScore: null, caseScores: [], formula: '' },
      regression: { isFirstRun: true, regressions: [], hasRegression: false, previousScore: null, scoreDelta: null },
      archiveDir: '',
      htmlPath: '',
    };
  }

  if (loadResult.skippedCount > 0) {
    console.log(`   已跳过 ${loadResult.skippedCount} 条 deprecated 用例`);
  }
  if (loadResult.warnings.length > 0) {
    console.log(`   ⚠️  ${loadResult.warnings.length} 条警告（无效用例已排除）`);
  }

  console.log(`   有效用例数: ${validCases.length}`);
  if (rubricSchema) {
    console.log(`   Rubric 评测: 已启用`);
  }
  console.log('');

  // ===== 步骤 4：逐条执行评测 =====
  const caseEvalResults: CaseEvalResult[] = [];
  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < validCases.length; i++) {
    const testCase = validCases[i];

    // 展示进度
    console.log(`[${i + 1}/${validCases.length}] 评测用例: ${testCase.id}`);

    // 创建 Trace 收集器（每条用例独立的 trace 文件）
    const traceDir = path.join(process.cwd(), '.quick-skill-eval', '.traces');
    const tracePath = path.join(traceDir, `${skillName}-${testCase.id}.jsonl`);
    const traceCollector = createTraceCollector(tracePath);

    // 记录 Skill 触发事件
    traceCollector.record({
      caseId: testCase.id,
      eventType: 'skill_trigger',
      detail: { skillName, shouldTrigger: testCase.should_trigger },
      result: 'success',
    });

    // 创建沙箱
    const sandbox = createSandbox(skillDir, { timeout: timeoutSeconds });

    try {
      // 构建检查上下文
      const checkContext: CheckContext = {
        testCase,
        sandbox,
        skillAnchor,
        traceCollector,
      };

      // 执行确定性评测
      const deterministicResult = runDeterministicEval(checkContext);

      // 可选：执行 Rubric 评测
      let rubricResult: import('../../types/rubric.js').RubricResult | undefined;
      if (rubricSchema) {
        const { runRubricEval } = await import('../../eval/rubric-engine.js');
        // 读取沙箱内的 SKILL.md 内容作为评测内容
        const sandboxSkillContent = fs.readFileSync(sandbox.skillMdPath, 'utf-8');
        rubricResult = await runRubricEval(rubricSchema, sandboxSkillContent);

        traceCollector.record({
          caseId: testCase.id,
          eventType: 'model_call',
          detail: {
            rubricScore: rubricResult.score,
            overallPass: rubricResult.overallPass,
            modelCalls: rubricResult.modelCalls,
          },
          result: rubricResult.overallPass ? 'success' : 'failure',
        });
      }

      // 构建用例评测结果
      const caseResult: CaseEvalResult = {
        caseId: testCase.id,
        shouldTrigger: testCase.should_trigger,
        deterministicResult,
        rubricResult,
      };
      caseEvalResults.push(caseResult);

      // 打分
      const caseScore = scoreCase(caseResult);

      // 判断通过/失败（确定性评测全部通过且适用）
      const isPass = deterministicResult.allPassed;
      if (isPass) {
        passCount++;
        console.log(`   ✅ 通过 (得分: ${caseScore.score}/100)`);
      } else {
        failCount++;
        const failedChecks = deterministicResult.checks
          .filter(c => !c.notApplicable && !c.pass)
          .map(c => c.checkerId)
          .join(', ');
        console.log(`   ❌ 失败 (得分: ${caseScore.score}/100, 未通过: ${failedChecks})`);
        // 输出 trace 路径
        console.log(`   📋 Trace: ${traceCollector.getTracePath()}`);
      }

      // 刷新 trace
      traceCollector.flush();
    } catch (error) {
      // 评测异常
      failCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ 异常: ${errorMessage}`);

      // 记录失败事件
      traceCollector.record({
        caseId: testCase.id,
        eventType: 'command_exec',
        detail: { error: errorMessage },
        result: 'failure',
        failureReason: errorMessage,
      });
      traceCollector.flush();

      // 创建一个标记为失败的 CaseEvalResult
      const failedResult: CaseEvalResult = {
        caseId: testCase.id,
        shouldTrigger: testCase.should_trigger,
        deterministicResult: {
          totalScore: 0,
          maxScore: 0,
          checks: [],
          allPassed: false,
          notApplicableChecks: [],
        },
      };
      caseEvalResults.push(failedResult);
    } finally {
      // 无论成功/失败都清理沙箱
      cleanupSandbox(sandbox);
    }

    console.log('');
  }

  // ===== 步骤 5：计算 Skill 级别分数 =====
  const caseScores = caseEvalResults.map(result => scoreCase(result));
  const skillScore = scoreSkill(skillName, caseScores);

  // ===== 步骤 6：持久化结果 =====
  const timestamp = new Date().toISOString();

  // 从目录路径提取分类（skills/{category}/{skill-name}）
  const category = path.basename(path.dirname(skillDir));

  // 获取最新一条用例的 trace 路径用于归档引用
  const lastTracePath = caseEvalResults.length > 0
    ? path.join(process.cwd(), '.quick-skill-eval', '.traces', `${skillName}-${caseEvalResults[caseEvalResults.length - 1].caseId}.jsonl`)
    : '';

  const persistOutput = persistResult({
    skillName,
    category,
    skillScore,
    caseResults: caseEvalResults,
    tracePath: lastTracePath,
    timestamp,
  });

  console.log('💾 结果已持久化');
  console.log(`   归档目录: ${persistOutput.resultDir}`);

  // ===== 步骤 7：回归检测 =====
  const regression = detectRegression({
    currentSkillScore: skillScore,
    skillName,
    category,
    currentTimestamp: timestamp,
  });

  if (!regression.isFirstRun && regression.hasRegression) {
    console.log('');
    console.log('⚠️  回归检测警告!');
    console.log(`   回归项数量: ${regression.regressions.length}`);
    if (regression.scoreDelta !== null && regression.scoreDelta < 0) {
      console.log(`   整体分数变化: ${regression.scoreDelta > 0 ? '+' : ''}${regression.scoreDelta}`);
    }
    for (const reg of regression.regressions.slice(0, 5)) {
      console.log(`   - ${reg.caseId}: ${reg.type} (上次: ${reg.previousScore}, 当前: ${reg.currentScore})`);
    }
    if (regression.regressions.length > 5) {
      console.log(`   ... 还有 ${regression.regressions.length - 5} 项`);
    }
  } else if (!regression.isFirstRun) {
    console.log('');
    console.log('✅ 无回归');
  } else {
    console.log('');
    console.log('📝 首次评测，无历史数据对比');
  }

  // ===== 步骤 8：生成 HTML 报告 =====
  const htmlPath = path.join(persistOutput.resultDir, 'report.html');
  generateHtmlReport({
    skillName,
    category,
    skillScore,
    caseResults: caseEvalResults,
    regression,
    traceRelativePath: 'trace.jsonl',
    timestamp,
  }, htmlPath);

  console.log(`📊 HTML 报告: ${htmlPath}`);

  // ===== 步骤 9：输出汇总 =====
  console.log('');
  console.log('='.repeat(50));
  console.log('📊 评测汇总');
  console.log('='.repeat(50));
  console.log(`  Skill: ${skillName}`);
  console.log(`  综合得分: ${skillScore.score}/100`);
  console.log(`  用例通过率: ${passCount}/${validCases.length} (${((passCount / validCases.length) * 100).toFixed(1)}%)`);
  console.log(`  正例通过率: ${(skillScore.positivePassRate * 100).toFixed(1)}%`);
  console.log(`  负例准确率: ${(skillScore.negativePassRate * 100).toFixed(1)}%`);
  if (skillScore.rubricAvgScore !== null) {
    console.log(`  Rubric 均分: ${skillScore.rubricAvgScore.toFixed(1)}`);
  }
  console.log(`  打分公式: ${skillScore.formula}`);
  if (regression.hasRegression) {
    console.log(`  ⚠️  回归项: ${regression.regressions.length} 项`);
  }
  console.log('='.repeat(50));

    return {
      hasFailure: failCount > 0,
      skillScore,
      regression,
      archiveDir: persistOutput.resultDir,
      htmlPath,
    };
  } finally {
    // 恢复原始评测根目录
    if (originalEvalRoot !== undefined) {
      process.env.QUICK_SKILL_EVAL_ROOT = originalEvalRoot;
    } else {
      delete process.env.QUICK_SKILL_EVAL_ROOT;
    }
  }
}

// ==================== 批量评测核心函数 ====================

/**
 * 批量评测指定的多个 Skill
 *
 * 使用 Promise.allSettled 实现并发，单个 Skill 失败不阻塞其他。
 *
 * @param skillNames 要评测的 Skill 名称列表
 * @param options 批量评测选项
 * @returns 批量评测汇总
 */
export async function evalBatchSkills(
  skillNames: string[],
  options: BatchEvalOptions = {}
): Promise<BatchEvalSummary> {
  if (skillNames.length === 0) {
    return createEmptySummary();
  }

  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const timeoutSeconds = options.timeoutSeconds ?? 10;

  // 构建并发任务
  const tasks = skillNames.map(name => () =>
    evalSingleSkillForBatch(name, {
      skillsRoot: options.skillsRoot,
      evalRoot: options.evalRoot,
      category: options.category,
      incremental: options.incremental ?? false,
      rubricSchema: options.rubricSchema,
      timeoutSeconds,
    })
  );

  // 使用 Promise.allSettled 实现并发，单个失败不阻塞其他
  const results = await runWithConcurrency(tasks, concurrency);

  return buildSummary(results);
}

/**
 * 全量评测 ./skills/ 下所有 Skill
 *
 * @param options 批量评测选项
 * @returns 批量评测汇总
 */
export async function evalAllSkills(
  options: BatchEvalOptions = {}
): Promise<BatchEvalSummary> {
  const skillsRoot = options.skillsRoot || path.join(process.cwd(), 'skills');

  // 扫描所有 Skill
  const allSkills = scanAllSkillsDetailed(skillsRoot);
  if (allSkills.length === 0) {
    return createEmptySummary();
  }

  // 按 category 筛选
  let filteredSkills = allSkills;
  if (options.category) {
    filteredSkills = allSkills.filter(s => s.category === options.category);
  }

  if (filteredSkills.length === 0) {
    return createEmptySummary();
  }

  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const timeoutSeconds = options.timeoutSeconds ?? 10;

  // 构建并发任务
  const tasks = filteredSkills.map(skill => () =>
    evalSingleSkillForBatch(skill.name, {
      skillsRoot,
      evalRoot: options.evalRoot,
      category: options.category,
      incremental: options.incremental ?? false,
      rubricSchema: options.rubricSchema,
      timeoutSeconds,
    })
  );

  // 使用 Promise.allSettled 实现并发
  const results = await runWithConcurrency(tasks, concurrency);

  return buildSummary(results);
}

/**
 * 并发执行任务队列
 *
 * 使用 Promise.allSettled 确保单个任务失败不影响其他任务。
 * 通过分批执行实现并发控制。
 *
 * @param tasks 任务函数列表
 * @param concurrency 并发数
 * @returns 所有任务的执行结果
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  // 确保并发数至少为 1
  const effectiveConcurrency = Math.max(1, concurrency);

  /**
   * 执行下一个任务
   */
  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      const task = tasks[currentIndex];
      const result = await task();
      results[currentIndex] = result;
    }
  }

  // 启动并发任务
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(effectiveConcurrency, tasks.length); i++) {
    workers.push(runNext());
  }

  await Promise.allSettled(workers);

  return results;
}

/**
 * 批量评测单个 Skill（内部函数，捕获异常不抛出）
 *
 * @param skillName Skill 名称
 * @param options 评测选项
 * @returns 单个 Skill 的批量评测结果
 */
async function evalSingleSkillForBatch(
  skillName: string,
  options: BatchEvalOptions
): Promise<BatchSkillResult> {
  const skillsRoot = options.skillsRoot || path.join(process.cwd(), 'skills');

  // 增量评测：检查文件是否变更
  if (options.incremental) {
    const skillDir = findSkillDir(skillName, skillsRoot);
    if (skillDir) {
      const changed = hasSkillChanged(skillDir);
      if (!changed) {
        // 文件未变更，跳过（不计入 totalSkills）
        return {
          skillName,
          category: getCategoryFromDir(skillDir),
          success: true,
          error: undefined,
          skillScore: undefined,
          regression: undefined,
          _skipped: true,
        };
      }
    }
  }

  // 按 category 筛选：检查 Skill 是否在指定分类中
  if (options.category) {
    const skillDir = findSkillDir(skillName, skillsRoot);
    if (skillDir) {
      const actualCategory = getCategoryFromDir(skillDir);
      if (actualCategory !== options.category) {
        // Skill 不在指定分类中，标记为失败
        return {
          skillName,
          category: actualCategory,
          success: false,
          error: `Skill "${skillName}" 不在分类 "${options.category}" 中（实际分类: ${actualCategory}）`,
          skillScore: {
            skillName,
            score: 0,
            positivePassRate: 0,
            negativePassRate: 0,
            rubricAvgScore: null,
            caseScores: [],
            formula: '',
          },
        };
      }
    } else {
      // Skill 不存在，标记为失败
      return {
        skillName,
        category: '',
        success: false,
        error: `未找到 Skill: ${skillName}`,
        skillScore: {
          skillName,
          score: 0,
          positivePassRate: 0,
          negativePassRate: 0,
          rubricAvgScore: null,
          caseScores: [],
          formula: '',
        },
      };
    }
  }

  try {
    const result = await evalSingleSkillQuiet(
      skillName,
      options.timeoutSeconds ?? 10,
      options.rubricSchema,
      options.skillsRoot,
      options.evalRoot
    );

    // 评测完成（无论 skill 内部用例是否通过），标记为成功
    // hasFailure 表示有用例未通过，但不影响批量评测的 success 状态
    return {
      skillName,
      category: getCategoryFromSkillResult(result),
      success: true,
      skillScore: result.skillScore,
      regression: result.regression,
    };
  } catch (error) {
    return {
      skillName,
      category: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      skillScore: {
        skillName,
        score: 0,
        positivePassRate: 0,
        negativePassRate: 0,
        rubricAvgScore: null,
        caseScores: [],
        formula: '',
      },
    };
  }
}

/**
 * 批量评测结果内部标记（用于区分跳过和实际评测）
 */
interface InternalBatchSkillResult extends BatchSkillResult {
  _skipped?: boolean;
}

/**
 * 检查 Skill 是否有变更（对比快照哈希）
 *
 * @param skillDir Skill 目录路径
 * @returns 是否有变更
 */
function hasSkillChanged(skillDir: string): boolean {
  const snapshotPath = path.join(skillDir, '.skill-snapshot.json');
  const snapshot = readSnapshot(snapshotPath);

  if (!snapshot) {
    // 无快照，视为有变更（需要评测）
    return true;
  }

  // 读取当前 SKILL.md 内容并计算哈希
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return true; // 文件不存在，视为变更
  }

  const currentContent = fs.readFileSync(skillMdPath, 'utf-8');
  const currentHash = createHash('sha256').update(currentContent, 'utf-8').digest('hex');

  return currentHash !== snapshot.hash;
}

/**
 * 从目录路径提取分类名
 *
 * @param skillDir Skill 目录路径
 * @returns 分类名
 */
function getCategoryFromDir(skillDir: string): string {
  return path.basename(path.dirname(skillDir));
}

/**
 * 从评测结果中提取分类名
 *
 * @param result 评测结果
 * @returns 分类名
 */
function getCategoryFromSkillResult(result: EvalResult): string {
  // 从 archiveDir 提取分类（格式: .quick-skill-eval/{time}/{category}/{skill-name}/）
  if (result.archiveDir) {
    const parts = result.archiveDir.split(path.sep);
    // 倒数第二个是分类名
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
  }
  return '';
}

/**
 * 创建空汇总结果
 */
function createEmptySummary(): BatchEvalSummary {
  return {
    totalSkills: 0,
    successCount: 0,
    failCount: 0,
    skippedCount: 0,
    averageScore: 0,
    topRiskSkills: [],
    regressionCount: 0,
    results: [],
  };
}

/**
 * 从批量评测结果构建汇总
 *
 * @param results 批量评测结果列表
 * @returns 批量评测汇总
 */
function buildSummary(results: BatchSkillResult[]): BatchEvalSummary {
  const internalResults = results as InternalBatchSkillResult[];

  // 跳过的 Skill（增量模式未变更，或 category 不匹配）
  const skippedResults = internalResults.filter(r => r._skipped);
  // 实际参与评测的 Skill
  const evaluatedResults = internalResults.filter(r => !r._skipped);

  const totalSkills = evaluatedResults.length;
  const successResults = evaluatedResults.filter(r => r.success && r.skillScore !== undefined);
  const failedResults = evaluatedResults.filter(r => !r.success);
  const skippedCount = skippedResults.length;

  const successCount = successResults.length;
  const failCount = failedResults.length;

  // 计算平均分（仅统计成功评测且有分数的）
  const successfulScores = successResults
    .map(r => r.skillScore!)
    .filter(s => s.score > 0 || s.caseScores.length > 0);

  const averageScore = successfulScores.length > 0
    ? Math.round((successfulScores.reduce((sum, s) => sum + s.score, 0) / successfulScores.length) * 100) / 100
    : 0;

  // Top 3 高风险 Skill（分数最低的 3 个）
  const sortedByScore = [...successfulScores].sort((a, b) => a.score - b.score);
  const topRiskSkills = sortedByScore.slice(0, Math.min(3, sortedByScore.length));

  // 回归项总数
  const regressionCount = successResults.reduce((sum, r) => {
    return sum + (r.regression?.regressions.length ?? 0);
  }, 0);

  return {
    totalSkills,
    successCount,
    failCount,
    skippedCount,
    averageScore,
    topRiskSkills,
    regressionCount,
    results,
  };
}

/**
 * 打印批量评测汇总到终端
 *
 * @param summary 批量评测汇总
 */
function printBatchSummary(summary: BatchEvalSummary): void {
  console.log('');
  console.log('='.repeat(50));
  console.log('📊 批量评测汇总');
  console.log('='.repeat(50));
  console.log(`  总 Skill 数: ${summary.totalSkills}`);
  console.log(`  成功: ${summary.successCount}`);
  console.log(`  失败: ${summary.failCount}`);
  if (summary.skippedCount > 0) {
    console.log(`  跳过（未变更）: ${summary.skippedCount}`);
  }
  console.log(`  通过率: ${summary.totalSkills > 0 ? ((summary.successCount / summary.totalSkills) * 100).toFixed(1) : 0}%`);
  console.log(`  平均分: ${summary.averageScore.toFixed(1)}/100`);

  if (summary.topRiskSkills.length > 0) {
    console.log('  Top 3 高风险 Skill:');
    for (const skill of summary.topRiskSkills) {
      console.log(`    - ${skill.skillName}: ${skill.score}/100`);
    }
  }

  if (summary.regressionCount > 0) {
    console.log(`  回归项: ${summary.regressionCount} 项`);
  }

  console.log('='.repeat(50));
}

/**
 * 静默版单 Skill 评测（不输出终端信息，供批量模式使用）
 *
 * 与 evalSingleSkill 逻辑相同，但不输出终端进度信息。
 */
async function evalSingleSkillQuiet(
  skillName: string,
  timeoutSeconds: number,
  rubricSchema?: RubricSchema,
  skillsRootOverride?: string,
  evalRootOverride?: string
): Promise<EvalResult> {
  // 设置评测根目录（用于持久化和回归检测）
  const originalEvalRoot = process.env.QUICK_SKILL_EVAL_ROOT;
  const effectiveEvalRoot = evalRootOverride || originalEvalRoot || path.join(process.cwd(), '.quick-skill-eval');
  if (evalRootOverride) {
    process.env.QUICK_SKILL_EVAL_ROOT = evalRootOverride;
  }

  try {
    // ===== 步骤 1：查找 Skill 目录 =====
    const skillDir = findSkillDir(skillName, skillsRootOverride);
    if (!skillDir) {
      throw new Error(`未找到 Skill: ${skillName}。请确保技能存在于 ./skills/ 目录下。`);
    }

    // ===== 步骤 2：解析 SKILL.md =====
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`Skill 目录下缺少 SKILL.md: ${skillDir}`);
    }

    const skillAnchor = parseSkillMd(skillMdPath);

    // ===== 步骤 3：加载用例 =====
    const loadResult = loadCases(skillDir);

    // 检查是否无用例文件
    if (loadResult.warnings.length > 0 && loadResult.cases.length === 0) {
      return {
        hasFailure: false,
        skillScore: { skillName, score: 0, positivePassRate: 0, negativePassRate: 0, rubricAvgScore: null, caseScores: [], formula: '' },
        regression: { isFirstRun: true, regressions: [], hasRegression: false, previousScore: null, scoreDelta: null },
        archiveDir: '',
        htmlPath: '',
      };
    }

    // 过滤出有效用例
    const validCases = loadResult.cases.filter(c => c.isValid);

    if (validCases.length === 0) {
      return {
        hasFailure: false,
        skillScore: { skillName, score: 0, positivePassRate: 0, negativePassRate: 0, rubricAvgScore: null, caseScores: [], formula: '' },
        regression: { isFirstRun: true, regressions: [], hasRegression: false, previousScore: null, scoreDelta: null },
        archiveDir: '',
        htmlPath: '',
      };
    }

    // ===== 步骤 4：逐条执行评测 =====
    const caseEvalResults: CaseEvalResult[] = [];
    let failCount = 0;

    for (const testCase of validCases) {
      try {
        // 创建 Trace 收集器
        const traceDir = path.join(effectiveEvalRoot, '.traces');
        if (!fs.existsSync(traceDir)) {
          fs.mkdirSync(traceDir, { recursive: true });
        }
        const tracePath = path.join(traceDir, `${skillName}-${testCase.id}.jsonl`);
        const traceCollector = createTraceCollector(tracePath);

        // 记录 Skill 触发事件
        traceCollector.record({
          caseId: testCase.id,
          eventType: 'skill_trigger',
          detail: { skillName, shouldTrigger: testCase.should_trigger },
          result: 'success',
        });

        // 创建沙箱
        const sandbox = createSandbox(skillDir, { timeout: timeoutSeconds });

        try {
          // 构建检查上下文
          const checkContext: CheckContext = {
            testCase,
            sandbox,
            skillAnchor,
            traceCollector,
          };

          // 执行确定性评测
          const deterministicResult = runDeterministicEval(checkContext);

          // 可选：执行 Rubric 评测
          let rubricResult: import('../../types/rubric.js').RubricResult | undefined;
          if (rubricSchema) {
            const { runRubricEval } = await import('../../eval/rubric-engine.js');
            const sandboxSkillContent = fs.readFileSync(sandbox.skillMdPath, 'utf-8');
            rubricResult = await runRubricEval(rubricSchema, sandboxSkillContent);

            traceCollector.record({
              caseId: testCase.id,
              eventType: 'model_call',
              detail: {
                rubricScore: rubricResult.score,
                overallPass: rubricResult.overallPass,
                modelCalls: rubricResult.modelCalls,
              },
              result: rubricResult.overallPass ? 'success' : 'failure',
            });
          }

          // 构建用例评测结果
          const caseResult: CaseEvalResult = {
            caseId: testCase.id,
            shouldTrigger: testCase.should_trigger,
            deterministicResult,
            rubricResult,
          };
          caseEvalResults.push(caseResult);

          // 判断通过/失败
          if (!deterministicResult.allPassed) {
            failCount++;
          }

          // 刷新 trace
          traceCollector.flush();
        } catch (error) {
          // 评测异常
          failCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 记录失败事件
          traceCollector.record({
            caseId: testCase.id,
            eventType: 'command_exec',
            detail: { error: errorMessage },
            result: 'failure',
            failureReason: errorMessage,
          });
          traceCollector.flush();

          // 创建一个标记为失败的 CaseEvalResult
          const failedResult: CaseEvalResult = {
            caseId: testCase.id,
            shouldTrigger: testCase.should_trigger,
            deterministicResult: {
              totalScore: 0,
              maxScore: 0,
              checks: [],
              allPassed: false,
              notApplicableChecks: [],
            },
          };
          caseEvalResults.push(failedResult);
        } finally {
          // 无论成功/失败都清理沙箱
          cleanupSandbox(sandbox);
        }
      } catch (error) {
        // 单条用例评测异常（如 trace 创建失败），记录为失败
        failCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        const failedResult: CaseEvalResult = {
          caseId: testCase.id,
          shouldTrigger: testCase.should_trigger,
          deterministicResult: {
            totalScore: 0,
            maxScore: 0,
            checks: [],
            allPassed: false,
            notApplicableChecks: [],
          },
        };
        caseEvalResults.push(failedResult);
      }
    }

    // ===== 步骤 5：计算 Skill 级别分数 =====
    let skillScore: import('../../types/eval.js').SkillScore;
    try {
      const caseScores = caseEvalResults.map(result => scoreCase(result));
      skillScore = scoreSkill(skillName, caseScores);
    } catch {
      // 打分失败时使用默认值
      skillScore = { skillName, score: 0, positivePassRate: 0, negativePassRate: 0, rubricAvgScore: null, caseScores: [], formula: '' };
    }

    // ===== 步骤 6：持久化结果 =====
    const timestamp = new Date().toISOString();
    const category = path.basename(path.dirname(skillDir));

    let archiveDir = '';
    let htmlPath = '';
    try {
      const lastTracePath = caseEvalResults.length > 0
        ? path.join(effectiveEvalRoot, '.traces', `${skillName}-${caseEvalResults[caseEvalResults.length - 1].caseId}.jsonl`)
        : '';

      const persistOutput = persistResult({
        skillName,
        category,
        skillScore,
        caseResults: caseEvalResults,
        tracePath: lastTracePath,
        timestamp,
      });

      archiveDir = persistOutput.resultDir;

      // ===== 步骤 7：回归检测 =====
      const regression = detectRegression({
        currentSkillScore: skillScore,
        skillName,
        category,
        currentTimestamp: timestamp,
      });

      // ===== 步骤 8：生成 HTML 报告 =====
      htmlPath = path.join(persistOutput.resultDir, 'report.html');
      generateHtmlReport({
        skillName,
        category,
        skillScore,
        caseResults: caseEvalResults,
        regression,
        traceRelativePath: 'trace.jsonl',
        timestamp,
      }, htmlPath);
    } catch {
      // 持久化或报告生成失败，使用默认值
      archiveDir = '';
      htmlPath = '';
    }

    return {
      hasFailure: failCount > 0,
      skillScore,
      regression: { isFirstRun: true, regressions: [], hasRegression: false, previousScore: null, scoreDelta: null },
      archiveDir,
      htmlPath,
    };
  } catch (error) {
    // 整体评测失败（如 Skill 不存在、缺少 SKILL.md 等）
    // 重新抛出异常，让调用方处理
    throw error;
  } finally {
    // 恢复原始评测根目录
    if (originalEvalRoot !== undefined) {
      process.env.QUICK_SKILL_EVAL_ROOT = originalEvalRoot;
    } else {
      delete process.env.QUICK_SKILL_EVAL_ROOT;
    }
  }
}

export default registerEvalCommand;
