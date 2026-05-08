import type { DeployResult } from '../services/skill-deployer.js';

export function formatDeployReport(result: DeployResult, targetDir: string): string {
  const lines: string[] = [];

  lines.push('\n=== 部署汇总 ===');
  lines.push(`目标目录: ${targetDir}`);
  
  if (result.deployed.length > 0) {
    lines.push(`\n✓ 成功部署: ${result.deployed.length} 个 Skill`);
    result.deployed.forEach(name => lines.push(`  - ${name}`));
  }

  if (result.skipped.length > 0) {
    lines.push(`\n⚠ 已跳过: ${result.skipped.length} 个 Skill`);
    result.skipped.forEach(name => lines.push(`  - ${name}`));
  }

  if (result.errors.length > 0) {
    lines.push(`\n✗ 部署失败: ${result.errors.length} 个 Skill`);
    result.errors.forEach(err => {
      lines.push(`  - ${err.skillName}: ${err.reason}`);
    });
  }

  lines.push('\n');
  return lines.join('\n');
}

export function printDeployReport(result: DeployResult, targetDir: string): void {
  console.log(formatDeployReport(result, targetDir));
}

export function getExitCode(result: DeployResult): number {
  if (result.deployed.length === 0 && result.errors.length > 0) {
    return 1;
  }
  
  return 0;
}