import * as fs from 'fs';
import * as path from 'path';
import type { SkillEntry } from './skill-scanner.js';
import { deploySkills, type DeployResult } from './skill-deployer.js';

export interface OverwriteResult {
  overwritten: boolean;
  skipped: boolean;
  reason?: string;
}

export async function overwriteSkill(skillName: string, targetDir: string): Promise<OverwriteResult> {
  const targetPath = path.join(targetDir, skillName);

  if (!fs.existsSync(targetPath)) {
    return { overwritten: false, skipped: false };
  }

  try {
    await fs.promises.rm(targetPath, { recursive: true, force: true });
    return { overwritten: true, skipped: false };
  } catch (error) {
    if (error instanceof Error) {
      return { overwritten: false, skipped: true, reason: error.message };
    }
    return { overwritten: false, skipped: true, reason: '未知错误' };
  }
}

export async function deployWithOverwrite(entries: SkillEntry[], targetDir: string): Promise<DeployResult> {
  const result: DeployResult = {
    deployed: [],
    skipped: [],
    errors: [],
  };

  for (const entry of entries) {
    const overwriteResult = await overwriteSkill(entry.name, targetDir);

    if (overwriteResult.skipped) {
      result.skipped.push(entry.name);
      result.errors.push({
        skillName: entry.name,
        reason: `删除失败: ${overwriteResult.reason}`,
      });
      continue;
    }

    const deployEntries = [entry];
    const deployResult = await deploySkills(deployEntries, targetDir);

    result.deployed.push(...deployResult.deployed);
    result.errors.push(...deployResult.errors);
  }

  return result;
}