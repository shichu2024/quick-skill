/**
 * 改造清单生成器 - 基于诊断结果生成改造清单
 */

import {
  DiagnosticResult,
  CheckResult,
  FixLevel,
  DiagnosticDimension,
} from './types.js';

/** 改造项 */
export interface RemediationItem {
  /** 问题描述 */
  description: string;
  /** 涉及维度 */
  dimension: DiagnosticDimension;
  /** 修复等级 */
  fixLevel: FixLevel;
  /** 是否可自动修复 */
  autoFixable: boolean;
  /** 预期效果 */
  expectedEffect: string;
  /** 修复动作描述 */
  fixAction?: string;
}

/** 改造清单 */
export interface RemediationPlan {
  /** 可自动修复项 */
  autoFixableItems: RemediationItem[];
  /** 需人工确认项 */
  manualItems: RemediationItem[];
}

export class RemediationPlanGenerator {
  /**
   * 基于诊断结果生成改造清单
   * @param result 诊断结果
   * @returns 改造清单
   */
  generate(result: DiagnosticResult): RemediationPlan {
    const autoFixableItems: RemediationItem[] = [];
    const manualItems: RemediationItem[] = [];

    for (const check of result.checks) {
      if (check.status === 'pass' || check.status === 'not_applicable') {
        continue;
      }

      const item = this.checkToRemediationItem(check);
      if (item) {
        if (check.autoFixable) {
          autoFixableItems.push(item);
        } else {
          manualItems.push(item);
        }
      }
    }

    return {
      autoFixableItems,
      manualItems,
    };
  }

  /**
   * 将检查结果转换为改造项
   */
  private checkToRemediationItem(check: CheckResult): RemediationItem | null {
    if (check.status === 'pass' || check.status === 'not_applicable') {
      return null;
    }

    const fixLevel = check.fixLevel || 'recommended';

    return {
      description: check.message + (check.details ? ` - ${check.details}` : ''),
      dimension: check.dimension,
      fixLevel,
      autoFixable: check.autoFixable,
      expectedEffect: this.getExpectedEffect(check),
      fixAction: check.fixAction,
    };
  }

  /**
   * 获取预期效果描述
   */
  private getExpectedEffect(check: CheckResult): string {
    const dimension = check.dimension;

    switch (dimension) {
      case DiagnosticDimension.structure:
        return '提升技能目录结构的规范性和可维护性';
      case DiagnosticDimension.metadata:
        return '确保技能元数据完整，便于识别和管理';
      case DiagnosticDimension.boundary:
        return '明确技能使用边界，避免误用';
      case DiagnosticDimension.standard:
        return '建立可量化的完成标准，提升质量可控性';
      case DiagnosticDimension.format:
        return '统一命名规范，提升代码库一致性';
      case DiagnosticDimension.evaluation:
        return '完善测试用例覆盖，提升技能可靠性';
      case DiagnosticDimension.compatibility:
        return '消除 Agent 绑定，提升技能通用性';
      default:
        return '提升技能合规性';
    }
  }

  /**
   * 生成改造清单的 Markdown 格式输出
   */
  toMarkdown(plan: RemediationPlan): string {
    const lines: string[] = [];

    lines.push('## 改造清单\n');

    if (plan.autoFixableItems.length === 0 && plan.manualItems.length === 0) {
      lines.push('✅ 无需改造\n');
      return lines.join('\n');
    }

    // 可自动修复项
    if (plan.autoFixableItems.length > 0) {
      lines.push('### 🔧 可自动修复项\n');
      for (const [index, item] of plan.autoFixableItems.entries()) {
        lines.push(
          `${index + 1}. **[${item.dimension}]** ${item.description}`
        );
        if (item.fixAction) {
          lines.push(`   - 修复动作: ${item.fixAction}`);
        }
        lines.push(`   - 修复等级: ${item.fixLevel}`);
        lines.push(`   - 预期效果: ${item.expectedEffect}`);
      }
      lines.push('');
    }

    // 需人工确认项
    if (plan.manualItems.length > 0) {
      lines.push('### ⚠️ 需人工确认项\n');
      for (const [index, item] of plan.manualItems.entries()) {
        lines.push(
          `${index + 1}. **[${item.dimension}]** ${item.description}`
        );
        lines.push(`   - 修复等级: ${item.fixLevel}`);
        lines.push(`   - 预期效果: ${item.expectedEffect}`);
        lines.push(`   - 处理建议: 请根据技能业务逻辑手动调整`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// 导出单例实例
export const defaultRemediationPlanGenerator =
  new RemediationPlanGenerator();
