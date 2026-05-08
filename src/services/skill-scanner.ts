import * as fs from 'fs';
import * as path from 'path';

export interface SkillEntry {
  name: string;
  sourcePath: string;
  category: string;
}

export class SkillSourceEmptyError extends Error {
  constructor(message: string = 'CLI内部Skill源为空') {
    super(message);
    this.name = 'SkillSourceEmptyError';
  }
}

export function scanSkills(sourcePath: string): SkillEntry[] {
  if (!fs.existsSync(sourcePath)) {
    throw new SkillSourceEmptyError(`Skill源路径不存在: ${sourcePath}`);
  }

  const categories = fs.readdirSync(sourcePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  if (categories.length === 0) {
    throw new SkillSourceEmptyError('Skill源路径下无分类子目录');
  }

  const skillEntries: SkillEntry[] = [];

  for (const category of categories) {
    const categoryPath = path.join(sourcePath, category.name);
    const skills = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory());

    for (const skill of skills) {
      skillEntries.push({
        name: skill.name,
        sourcePath: path.join(categoryPath, skill.name),
        category: category.name,
      });
    }
  }

  if (skillEntries.length === 0) {
    throw new SkillSourceEmptyError('所有分类子目录下均无 Skill');
  }

  return skillEntries;
}