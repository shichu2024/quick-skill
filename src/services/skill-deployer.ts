import * as fs from 'fs';
import * as path from 'path';
import type { SkillEntry } from './skill-scanner.js';

export interface DeployError {
  skillName: string;
  reason: string;
  originalError?: Error;
}

export interface DeployResult {
  deployed: string[];
  skipped: string[];
  errors: DeployError[];
}

export async function deploySkills(entries: SkillEntry[], targetDir: string): Promise<DeployResult> {
  const result: DeployResult = {
    deployed: [],
    skipped: [],
    errors: [],
  };

  for (const entry of entries) {
    const targetPath = path.join(targetDir, entry.name);

    try {
      await fs.promises.cp(entry.sourcePath, targetPath, { recursive: true });
      result.deployed.push(entry.name);
    } catch (error) {
      if (error instanceof Error) {
        result.errors.push({
          skillName: entry.name,
          reason: error.message,
          originalError: error,
        });
      }
    }
  }

  return result;
}