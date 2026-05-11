import type { SkillScore, CaseEvalResult } from '../../types/eval.js';
import type { RegressionResult, RegressionItem } from '../regression-detector.js';

/**
 * 报告数据接口
 */
export interface ReportData {
  /** Skill 名称 */
  skillName: string;
  /** 业务分类 */
  category: string;
  /** Skill 级别打分结果 */
  skillScore: SkillScore;
  /** 用例评测原始结果列表 */
  caseResults: CaseEvalResult[];
  /** 回归检测结果 */
  regression: RegressionResult;
  /** Trace 日志相对路径 */
  traceRelativePath: string;
  /** 评测时间戳（ISO 8601） */
  timestamp: string;
}

/**
 * 根据分数获取颜色
 * 90-100: 绿色（优秀）
 * 70-89: 蓝色（良好）
 * 50-69: 橙色（及格）
 * 0-49: 红色（不及格）
 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#2e7d32'; // 深绿
  if (score >= 70) return '#1565c0'; // 深蓝
  if (score >= 50) return '#ef6c00'; // 深橙
  return '#c62828'; // 深红
}

/**
 * 根据分数获取背景色（浅色版本）
 */
function getScoreBgColor(score: number): string {
  if (score >= 90) return '#e8f5e9';
  if (score >= 70) return '#e3f2fd';
  if (score >= 50) return '#fff3e0';
  return '#ffebee';
}

/**
 * 格式化时间戳为可读字符串
 */
function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

/**
 * 将百分比转换为显示字符串
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * 生成 HTML 转义字符串（防止 XSS）
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 生成得分概览区域 HTML
 */
function renderScoreOverview(data: ReportData): string {
  const { skillScore, timestamp } = data;
  const scoreColor = getScoreColor(skillScore.score);
  const scoreBg = getScoreBgColor(skillScore.score);

  return `
  <section class="section score-overview">
    <h2>得分概览</h2>
    <div class="score-card" style="background-color: ${scoreBg}; border-left-color: ${scoreColor};">
      <div class="score-main">
        <span class="score-value" style="color: ${scoreColor};">${skillScore.score}</span>
        <span class="score-label">综合得分</span>
      </div>
      <div class="score-details">
        <div class="score-detail-item">
          <span class="detail-label">正例通过率</span>
          <span class="detail-value">${formatPercent(skillScore.positivePassRate)}</span>
        </div>
        <div class="score-detail-item">
          <span class="detail-label">负例准确率</span>
          <span class="detail-value">${formatPercent(skillScore.negativePassRate)}</span>
        </div>
        ${skillScore.rubricAvgScore !== null ? `
        <div class="score-detail-item">
          <span class="detail-label">Rubric 均分</span>
          <span class="detail-value">${skillScore.rubricAvgScore.toFixed(1)}</span>
        </div>
        ` : ''}
      </div>
      <div class="score-formula">
        <span class="formula-label">计算公式：</span>
        <span class="formula-value">${escapeHtml(skillScore.formula)}</span>
      </div>
    </div>
    <div class="timestamp">评测时间：${escapeHtml(formatTimestamp(timestamp))}</div>
  </section>
  `;
}

/**
 * 生成回归提示区域 HTML
 */
function renderRegressionSection(data: ReportData): string {
  const { regression } = data;

  // 首次评测不显示回归信息
  if (regression.isFirstRun) {
    return `
  <section class="section regression-section">
    <h2>回归检测</h2>
    <div class="regression-info first-run">
      <span class="info-icon">ℹ️</span>
      <span class="info-text">首次评测，无历史结果可对比</span>
    </div>
  </section>
    `;
  }

  // 无回归
  if (!regression.hasRegression) {
    const deltaText = regression.scoreDelta !== null
      ? `（得分变化：${regression.scoreDelta >= 0 ? '+' : ''}${regression.scoreDelta}）`
      : '';
    return `
  <section class="section regression-section">
    <h2>回归检测</h2>
    <div class="regression-info no-regression">
      <span class="info-icon">✅</span>
      <span class="info-text">未发现回归${escapeHtml(deltaText)}</span>
    </div>
    ${regression.previousScore !== null ? `
    <div class="regression-history">
      上次得分：<strong>${regression.previousScore}</strong>
    </div>
    ` : ''}
  </section>
    `;
  }

  // 有回归
  const deltaText = regression.scoreDelta !== null
    ? `<span class="delta ${regression.scoreDelta < 0 ? 'negative' : 'positive'}">${regression.scoreDelta >= 0 ? '+' : ''}${regression.scoreDelta}</span>`
    : '';

  const regressionItemsHtml = regression.regressions.map((item: RegressionItem) => {
    const typeLabel = item.type === 'new_failure' ? '新增失败' : '得分下降';
    const typeClass = item.type === 'new_failure' ? 'type-new-failure' : 'type-score-drop';
    return `
    <div class="regression-item ${typeClass}" data-type="${escapeHtml(item.type)}">
      <span class="regression-case-id">${escapeHtml(item.caseId)}</span>
      <span class="regression-type-badge">${typeLabel}</span>
      <span class="regression-scores">
        ${item.previousScore} → ${item.currentScore}
        ${item.dropAmount !== undefined ? `（↓${item.dropAmount}）` : ''}
      </span>
    </div>
    `;
  }).join('');

  return `
  <section class="section regression-section">
    <h2>回归检测 ⚠️</h2>
    <div class="regression-alert">
      <span class="alert-icon">🔴</span>
      <span class="alert-text">检测到回归！</span>
      ${deltaText ? `<span class="delta-summary">Skill 得分变化：${deltaText}</span>` : ''}
    </div>
    <div class="regression-list">
      ${regressionItemsHtml}
    </div>
    ${regression.previousScore !== null ? `
    <div class="regression-history">
      上次得分：<strong>${regression.previousScore}</strong>
    </div>
    ` : ''}
  </section>
  `;
}

/**
 * 生成失败用例详情区域 HTML
 */
function renderFailureDetails(data: ReportData): string {
  const { caseResults, traceRelativePath, skillScore } = data;

  // 从 caseResults 中筛选失败的用例（确定性评测未全部通过）
  const failedCases = caseResults.filter(cr => !cr.deterministicResult.allPassed);

  if (failedCases.length === 0) {
    return `
  <section class="section failure-section">
    <h2>失败用例详情</h2>
    <div class="no-failures">
      <span class="info-icon">✅</span>
      <span class="info-text">所有用例均通过</span>
    </div>
  </section>
    `;
  }

  const failedCasesHtml = failedCases.map(cr => {
    const scoreColor = getScoreColor(cr.deterministicResult.totalScore);
    // 构建失败检查项列表
    const failedChecks = cr.deterministicResult.checks
      .filter(c => !c.pass && !c.notApplicable)
      .map(c => `<li class="check-fail">[${escapeHtml(c.checkerId)}] ${escapeHtml(c.details.join('; '))}</li>`)
      .join('');

    return `
    <div class="failure-case">
      <div class="failure-header">
        <span class="case-id">${escapeHtml(cr.caseId)}</span>
        <span class="case-type">${cr.shouldTrigger ? '正例' : '负例'}</span>
        <span class="case-score" style="color: ${scoreColor};">${cr.deterministicResult.totalScore}/100</span>
      </div>
      <div class="failure-details">
        <h4>失败检查项</h4>
        <ul class="check-list">
          ${failedChecks}
        </ul>
        <div class="trace-link">
          <a href="${escapeHtml(traceRelativePath)}" target="_blank" rel="noopener">
            📋 查看 Trace 日志
          </a>
        </div>
      </div>
    </div>
    `;
  }).join('');

  return `
  <section class="section failure-section">
    <h2>失败用例详情（${failedCases.length} 条）</h2>
    <div class="failure-list">
      ${failedCasesHtml}
    </div>
  </section>
  `;
}

/**
 * 生成用例总览表格 HTML
 */
function renderCaseSummary(data: ReportData): string {
  const { caseResults, traceRelativePath } = data;

  if (caseResults.length === 0) {
    return `
  <section class="section case-summary">
    <h2>用例总览</h2>
    <div class="no-cases">暂无用例数据</div>
  </section>
    `;
  }

  const totalCases = caseResults.length;
  const passedCases = caseResults.filter(cr => cr.deterministicResult.allPassed).length;
  const failedCases = totalCases - passedCases;
  const positiveCases = caseResults.filter(cr => cr.shouldTrigger).length;
  const negativeCases = totalCases - positiveCases;

  const rowsHtml = caseResults.map(cr => {
    const passed = cr.deterministicResult.allPassed;
    const rowClass = passed ? 'row-pass' : 'row-fail';
    const statusText = passed ? '通过' : '失败';
    const statusClass = passed ? 'status-pass' : 'status-fail';
    const scoreColor = getScoreColor(cr.deterministicResult.totalScore);

    return `
    <tr class="${rowClass}">
      <td>${escapeHtml(cr.caseId)}</td>
      <td>${cr.shouldTrigger ? '正例' : '负例'}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td><span style="color: ${scoreColor}; font-weight: bold;">${cr.deterministicResult.totalScore}</span></td>
      <td>
        <a href="${escapeHtml(traceRelativePath)}" target="_blank" rel="noopener" class="trace-link-small">
          Trace
        </a>
      </td>
    </tr>
    `;
  }).join('');

  return `
  <section class="section case-summary">
    <h2>用例总览</h2>
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-value">${totalCases}</span>
        <span class="stat-label">总用例数</span>
      </div>
      <div class="stat-item stat-pass">
        <span class="stat-value">${passedCases}</span>
        <span class="stat-label">通过</span>
      </div>
      <div class="stat-item stat-fail">
        <span class="stat-value">${failedCases}</span>
        <span class="stat-label">失败</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${positiveCases}</span>
        <span class="stat-label">正例</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${negativeCases}</span>
        <span class="stat-label">负例</span>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="case-table">
        <thead>
          <tr>
            <th>用例 ID</th>
            <th>类型</th>
            <th>状态</th>
            <th>得分</th>
            <th>Trace</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </section>
  `;
}

/**
 * 生成 Trace 链接区域 HTML
 */
function renderTraceLink(data: ReportData): string {
  const { traceRelativePath } = data;

  return `
  <section class="section trace-section">
    <h2>Trace 日志</h2>
    <div class="trace-link-container">
      <a href="${escapeHtml(traceRelativePath)}" target="_blank" rel="noopener" class="trace-link-btn">
        📋 打开 Trace 日志文件
      </a>
      <div class="trace-path">${escapeHtml(traceRelativePath)}</div>
    </div>
  </section>
  `;
}

/**
 * 生成完整的 HTML 报告模板字符串
 *
 * @param data 报告数据
 * @returns 完整的 HTML 字符串
 */
export function generateReportHtml(data: ReportData): string {
  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333;
      line-height: 1.6;
      padding: 20px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #1a237e, #283593);
      color: white;
      padding: 24px 32px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.85; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 {
      font-size: 18px;
      color: #1a237e;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e8eaf6;
    }
    /* 得分概览 */
    .score-card {
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid;
    }
    .score-main {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 12px;
    }
    .score-value { font-size: 48px; font-weight: bold; }
    .score-label { font-size: 14px; color: #666; }
    .score-details {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .score-detail-item {
      display: flex;
      flex-direction: column;
    }
    .detail-label { font-size: 12px; color: #888; }
    .detail-value { font-size: 16px; font-weight: 600; }
    .score-formula {
      font-size: 13px;
      color: #555;
      background: rgba(0,0,0,0.04);
      padding: 8px 12px;
      border-radius: 4px;
    }
    .formula-label { color: #888; }
    .timestamp {
      margin-top: 12px;
      font-size: 13px;
      color: #888;
    }
    /* 回归检测 */
    .regression-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 6px;
    }
    .regression-info.first-run {
      background-color: #e3f2fd;
      color: #1565c0;
    }
    .regression-info.no-regression {
      background-color: #e8f5e9;
      color: #2e7d32;
    }
    .regression-alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: #ffebee;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .alert-text { font-weight: 600; color: #c62828; }
    .delta-summary { font-size: 14px; color: #666; }
    .delta { font-weight: bold; }
    .delta.negative { color: #c62828; }
    .delta.positive { color: #2e7d32; }
    .regression-list { margin-top: 12px; }
    .regression-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .regression-item.type-new-failure {
      background-color: #ffebee;
      border-left: 3px solid #c62828;
    }
    .regression-item.type-score-drop {
      background-color: #fff3e0;
      border-left: 3px solid #ef6c00;
    }
    .regression-case-id { font-weight: 600; font-family: monospace; }
    .regression-type-badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 3px;
      background: rgba(0,0,0,0.08);
    }
    .regression-scores { color: #666; }
    .regression-history {
      margin-top: 12px;
      font-size: 13px;
      color: #888;
    }
    /* 失败用例 */
    .no-failures {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: #e8f5e9;
      border-radius: 6px;
      color: #2e7d32;
    }
    .failure-case {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .failure-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: #fafafa;
      border-bottom: 1px solid #e0e0e0;
    }
    .case-id { font-weight: 600; font-family: monospace; }
    .case-type {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 3px;
      background: #e3f2fd;
      color: #1565c0;
    }
    .case-score { font-weight: bold; margin-left: auto; }
    .failure-details { padding: 12px 16px; }
    .failure-details h4 { font-size: 14px; margin-bottom: 8px; color: #555; }
    .check-list { list-style: none; padding: 0; }
    .check-fail {
      padding: 4px 0;
      font-size: 13px;
      color: #c62828;
      border-bottom: 1px dashed #eee;
    }
    .check-fail:last-child { border-bottom: none; }
    .trace-link { margin-top: 12px; }
    .trace-link a {
      display: inline-block;
      padding: 6px 14px;
      background-color: #1a237e;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 13px;
    }
    .trace-link a:hover { background-color: #283593; }
    /* 用例总览 */
    .summary-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 20px;
      background: #f5f5f5;
      border-radius: 6px;
      min-width: 80px;
    }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; color: #888; }
    .stat-pass .stat-value { color: #2e7d32; }
    .stat-fail .stat-value { color: #c62828; }
    .table-wrapper { overflow-x: auto; }
    .case-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .case-table th {
      background-color: #f5f5f5;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e0e0e0;
    }
    .case-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
    }
    .row-fail { background-color: #fff8f8; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-pass { background-color: #e8f5e9; color: #2e7d32; }
    .status-fail { background-color: #ffebee; color: #c62828; }
    .trace-link-small {
      color: #1a237e;
      text-decoration: none;
      font-size: 13px;
    }
    .trace-link-small:hover { text-decoration: underline; }
    .no-cases {
      padding: 20px;
      text-align: center;
      color: #888;
      font-size: 14px;
    }
    /* Trace 链接 */
    .trace-link-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .trace-link-btn {
      display: inline-block;
      padding: 10px 20px;
      background-color: #1a237e;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
    }
    .trace-link-btn:hover { background-color: #283593; }
    .trace-path {
      font-size: 12px;
      color: #888;
      font-family: monospace;
    }
    /* Footer */
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 12px;
      color: #888;
    }
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill 评测报告 - ${escapeHtml(data.skillName)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Skill 评测报告</h1>
      <div class="subtitle">${escapeHtml(data.skillName)} | 分类：${escapeHtml(data.category)}</div>
    </div>

    ${renderScoreOverview(data)}
    ${renderRegressionSection(data)}
    ${renderCaseSummary(data)}
    ${renderFailureDetails(data)}
    ${renderTraceLink(data)}

    <div class="footer">
      由 quick-skill 评测引擎自动生成 | ${escapeHtml(formatTimestamp(data.timestamp))}
    </div>
  </div>
</body>
</html>`;
}
