/**
 * 检查器注册表 - 管理诊断检查器的注册与执行
 */

import { DiagnosticChecker, CheckerRegistration, CheckResult, DiagnosticDimension } from './types.js';

export class CheckerRegistry {
  private registrations: CheckerRegistration[] = [];

  /**
   * 注册一个检查器
   * @param checker 检查器实例
   * @param order 执行顺序（数字越小越先执行）
   */
  register(checker: DiagnosticChecker, order: number = 0): void {
    // 检查是否已注册同维度检查器
    const existing = this.registrations.find(
      (reg) => reg.checker.dimension === checker.dimension
    );
    if (existing) {
      throw new Error(
        `Checker for dimension "${checker.dimension}" is already registered`
      );
    }

    this.registrations.push({ checker, order });
    // 按 order 排序
    this.registrations.sort((a, b) => a.order - b.order);
  }

  /**
   * 注销指定维度的检查器
   * @param dimension 诊断维度
   */
  unregister(dimension: DiagnosticDimension): void {
    this.registrations = this.registrations.filter(
      (reg) => reg.checker.dimension !== dimension
    );
  }

  /**
   * 获取已注册的检查器列表（按执行顺序排序）
   */
  getCheckers(): DiagnosticChecker[] {
    return this.registrations.map((reg) => reg.checker);
  }

  /**
   * 获取指定维度的检查器
   * @param dimension 诊断维度
   */
  getChecker(dimension: DiagnosticDimension): DiagnosticChecker | undefined {
    return this.registrations.find(
      (reg) => reg.checker.dimension === dimension
    )?.checker;
  }

  /**
   * 检查是否已注册指定维度的检查器
   */
  hasChecker(dimension: DiagnosticDimension): boolean {
    return this.registrations.some(
      (reg) => reg.checker.dimension === dimension
    );
  }

  /**
   * 按序执行所有已注册的检查器
   * @param skillPath 技能目录路径
   * @returns 所有检查结果
   */
  async executeAll(skillPath: string): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    for (const registration of this.registrations) {
      try {
        const result = await registration.checker.check(skillPath);
        results.push(result);
      } catch (error) {
        // 单个检查器失败不阻塞其他检查器
        results.push({
          dimension: registration.checker.dimension,
          status: 'fail',
          fixLevel: 'required',
          message: `Checker execution failed: ${error instanceof Error ? error.message : String(error)}`,
          autoFixable: false,
        });
      }
    }

    return results;
  }

  /**
   * 获取已注册检查器的数量
   */
  get size(): number {
    return this.registrations.length;
  }

  /**
   * 清空所有注册的检查器
   */
  clear(): void {
    this.registrations = [];
  }
}

// 导出默认注册表实例
export const defaultRegistry = new CheckerRegistry();
