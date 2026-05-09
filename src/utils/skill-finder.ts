import fs from 'fs';
import path from 'path';

export interface SkillScanResult {
  name: string;
  category: string;
  dirPath: string;
  hasExistingCases: boolean;
}

/**
 * 在 ./skills/ 下所有业务分类子目录中精确匹配技能名
 * 找到返回目录绝对路径，未找到返回 null
 */
export function findSkillDir(skillName: string, skillsRoot?: string): string | null {
  const rootDir = skillsRoot || path.join(process.cwd(), 'skills');

  if (!fs.existsSync(rootDir)) {
    return null;
  }

  // 扫描所有业务分类子目录
  const categories = fs.readdirSync(rootDir).filter(dir => {
    const fullPath = path.join(rootDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  // 在每个分类目录下查找匹配的技能
  for (const category of categories) {
    const categoryDir = path.join(rootDir, category);
    const skillDir = path.join(categoryDir, skillName);

    if (fs.existsSync(skillDir) && fs.statSync(skillDir).isDirectory()) {
      return skillDir;
    }
  }

  return null;
}

/**
 * 扫描 ./skills/ 下所有技能
 * 返回技能名列表（向后兼容）
 */
export function scanAllSkills(skillsRoot?: string): string[] {
  const results = scanAllSkillsDetailed(skillsRoot);
  return results.map(r => r.name);
}

/**
 * 扫描 ./skills/ 下所有技能，返回详细信息
 * 包括技能名、分类、目录路径、是否已有用例
 */
export function scanAllSkillsDetailed(skillsRoot?: string): SkillScanResult[] {
  const rootDir = skillsRoot || path.join(process.cwd(), 'skills');
  const results: SkillScanResult[] = [];

  if (!fs.existsSync(rootDir)) {
    return results;
  }

  const categories = fs.readdirSync(rootDir).filter(dir => {
    const fullPath = path.join(rootDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const category of categories) {
    const categoryDir = path.join(rootDir, category);
    const skillDirs = fs.readdirSync(categoryDir).filter(dir => {
      const fullPath = path.join(categoryDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const skillName of skillDirs) {
      const skillDir = path.join(categoryDir, skillName);
      const evalsDir = path.join(skillDir, 'evals');
      const casesFile = path.join(evalsDir, 'test-cases.csv');

      results.push({
        name: skillName,
        category,
        dirPath: skillDir,
        hasExistingCases: fs.existsSync(casesFile),
      });
    }
  }

  return results;
}
