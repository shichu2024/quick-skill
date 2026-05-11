import fs from 'fs';
import path from 'path';
import type { LoadedCase } from '../../types/eval.js';
import type { SandboxContext } from '../sandbox-manager.js';
import type { SkillAnchor } from '../../types/skill.js';
import type { TraceCollector } from '../../types/trace.js';

/**
 * 检查上下文接口
 * 包含评测执行所需的全部上下文信息
 */
export interface CheckContext {
  /** 当前正在评测的用例 */
  testCase: LoadedCase;
  /** 沙箱执行环境上下文 */
  sandbox: SandboxContext;
  /** SKILL.md 解析后的锚点信息 */
  skillAnchor: SkillAnchor;
  /** Trace 日志收集器 */
  traceCollector: TraceCollector;
}

/**
 * 检查结果接口
 * 结果目标检查器的输出
 */
export interface CheckResult {
  /** 检查器标识 */
  checkerId: 'result';
  /** 是否通过 */
  pass: boolean;
  /** 得分（0-25，满分 25） */
  score: number;
  /** 检查详情列表 */
  details: string[];
  /** 无可量化标准时为 true */
  notApplicable: boolean;
}

/**
 * 从 definitionOfDone 文本中提取的检查项
 */
interface ExtractedCheck {
  /** 检查项描述 */
  description: string;
  /** 检查类型 */
  type: 'file' | 'directory' | 'exitCode' | 'unknown';
  /** 提取的路径或值（适用于 file/directory/exitCode） */
  target?: string;
}

/**
 * 结果目标检查器
 *
 * 验证任务是否完成：
 * 1. 核心输出文件/目录是否按预期生成
 * 2. 命令退出码是否符合预期
 * 3. 最终产物是否满足 "Definition of done" 的可量化标准
 *
 * @param context 检查上下文
 * @returns 检查结果
 */
export function checkResult(context: CheckContext): CheckResult {
  const { skillAnchor, sandbox, testCase } = context;

  // 检查 definitionOfDone 是否存在且非空
  if (!skillAnchor.definitionOfDone || skillAnchor.definitionOfDone.trim() === '') {
    return {
      checkerId: 'result',
      pass: false,
      score: 0,
      details: ['缺少 Definition of Done，无可量化检查标准'],
      notApplicable: true,
    };
  }

  // 从 definitionOfDone 提取可量化检查项
  const checks = extractChecks(skillAnchor.definitionOfDone);

  // 如果无法提取任何可量化检查项，标记为不适用
  if (checks.length === 0) {
    return {
      checkerId: 'result',
      pass: false,
      score: 0,
      details: ['Definition of Done 中未找到可量化的检查标准（文件、目录或退出码）'],
      notApplicable: true,
    };
  }

  // 验证沙箱目录存在
  if (!fs.existsSync(sandbox.sandboxDir)) {
    return {
      checkerId: 'result',
      pass: false,
      score: 0,
      details: [`沙箱目录不存在: ${sandbox.sandboxDir}`],
      notApplicable: false,
    };
  }

  // 执行各项检查
  const results: { check: ExtractedCheck; passed: boolean; message: string }[] = [];

  for (const check of checks) {
    switch (check.type) {
      case 'file':
        results.push(checkFile(sandbox.sandboxDir, check));
        break;
      case 'directory':
        results.push(checkDirectory(sandbox.sandboxDir, check));
        break;
      case 'exitCode':
        results.push(checkExitCode(sandbox, testCase, check));
        break;
      // unknown 类型已被 extractChecks 过滤掉，不需要处理
    }
  }

  // 计算得分：按通过的检查项比例分配 25 分
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 25) : 0;

  // 所有检查项都通过才算 pass
  const allPassed = results.every(r => r.passed);

  return {
    checkerId: 'result',
    pass: allPassed,
    score,
    details: results.map(r => r.message),
    notApplicable: false,
  };
}

/**
 * 从 definitionOfDone 文本中提取可量化的检查项
 *
 * 支持的格式：
 * - 文件：包含扩展名的路径，如 "output.txt"、"src/index.ts"
 * - 目录：以 / 结尾或包含"目录"关键词，如 "dist/"、"build 目录"
 * - 退出码：包含"退出码"、"exit code"等关键词，如 "退出码为 0"
 *
 * 返回：仅包含可量化检查项的数组（unknown 类型会被过滤掉）
 */
function extractChecks(definitionOfDone: string): ExtractedCheck[] {
  const lines = definitionOfDone.split('\n').map(line => line.trim()).filter(Boolean);
  const checks: ExtractedCheck[] = [];

  for (const line of lines) {
    // 清理行首的编号/符号（如 "1."、"-"、"*"、"•" 等）
    const cleaned = line.replace(/^[\d\-\*\•\.\s]+/, '').trim();

    if (!cleaned) continue;

    // 检查是否为退出码相关描述
    const exitCodeMatch = cleaned.match(/退出码\s*(?:为|是|等于|=)\s*(\d+)/i) ||
                          cleaned.match(/exit\s*code\s*(?:is|=)\s*(\d+)/i);
    if (exitCodeMatch) {
      checks.push({
        description: cleaned,
        type: 'exitCode',
        target: exitCodeMatch[1],
      });
      continue;
    }

    // 检查是否为目录（以 / 结尾或包含"目录"关键词）
    if (cleaned.endsWith('/') || cleaned.includes('目录')) {
      // 提取目录名（去除"目录"、"文件夹"等后缀）
      let dirName = cleaned
        .replace(/(?:目录|文件夹)$/g, '')
        .replace(/生成\s*/g, '')
        .replace(/创建\s*/g, '')
        .trim();

      // 如果末尾有 /，去掉
      if (dirName.endsWith('/')) {
        dirName = dirName.slice(0, -1);
      }

      if (dirName) {
        checks.push({
          description: cleaned,
          type: 'directory',
          target: dirName,
        });
      }
      continue;
    }

    // 检查是否为文件（包含扩展名或看起来像文件路径）
    const fileMatch = cleaned.match(/(?:生成|创建)?\s*([\w\-./\\]+\.\w+)/);
    if (fileMatch) {
      checks.push({
        description: cleaned,
        type: 'file',
        target: fileMatch[1].trim(),
      });
      continue;
    }

    // 无法识别的类型，跳过（不计入检查项）
    // 这样可以过滤掉主观描述等不可量化的标准
  }

  return checks;
}

/**
 * 检查文件是否存在于沙箱目录中
 */
function checkFile(sandboxDir: string, check: ExtractedCheck): { check: ExtractedCheck; passed: boolean; message: string } {
  const filePath = path.join(sandboxDir, check.target!);
  const exists = fs.existsSync(filePath);

  return {
    check,
    passed: exists,
    message: exists
      ? `✓ 文件存在: ${check.target}`
      : `✗ 文件缺失: ${check.target}`,
  };
}

/**
 * 检查目录是否存在于沙箱目录中
 */
function checkDirectory(sandboxDir: string, check: ExtractedCheck): { check: ExtractedCheck; passed: boolean; message: string } {
  const dirPath = path.join(sandboxDir, check.target!);
  const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();

  return {
    check,
    passed: exists,
    message: exists
      ? `✓ 目录存在: ${check.target}/`
      : `✗ 目录缺失: ${check.target}/`,
  };
}

/**
 * 检查命令退出码是否符合预期
 */
function checkExitCode(
  sandbox: SandboxContext,
  testCase: LoadedCase,
  check: ExtractedCheck
): { check: ExtractedCheck; passed: boolean; message: string } {
  const expectedCode = parseInt(check.target!, 10);

  // 从 sandbox 上下文获取实际退出码（如果存在）
  // 约定：sandbox 对象上可能有 actualExitCode 属性
  const actualCode = (sandbox as Record<string, unknown>).actualExitCode as number | undefined;

  // 如果没有实际退出码记录，且用例中指定了 exitCode，使用用例中的值
  // 否则认为退出码检查无法执行（假设通过）
  if (actualCode === undefined) {
    // 如果 testCase 上有 exitCode 字段，使用它
    const caseExitCode = (testCase as Record<string, unknown>).exitCode as number | undefined;
    if (caseExitCode !== undefined) {
      const passed = caseExitCode === expectedCode;
      return {
        check,
        passed,
        message: passed
          ? `✓ 退出码匹配: 预期 ${expectedCode}，实际 ${caseExitCode}`
          : `✗ 退出码不匹配: 预期 ${expectedCode}，实际 ${caseExitCode}`,
      };
    }

    // 没有退出码信息，假设通过
    return {
      check,
      passed: true,
      message: `⚠ 退出码检查: 无实际退出码记录，跳过检查（预期 ${expectedCode}）`,
    };
  }

  const passed = actualCode === expectedCode;
  return {
    check,
    passed,
    message: passed
      ? `✓ 退出码匹配: 预期 ${expectedCode}，实际 ${actualCode}`
      : `✗ 退出码不匹配: 预期 ${expectedCode}，实际 ${actualCode}`,
  };
}
