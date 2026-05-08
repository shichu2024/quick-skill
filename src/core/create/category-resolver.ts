import * as fs from 'fs';
import * as path from 'path';

export class CategoryResolver {
  private skillsPath: string;

  constructor(skillsPath: string = './skills') {
    this.skillsPath = skillsPath;
  }

  getExistingCategories(): string[] {
    if (!fs.existsSync(this.skillsPath)) {
      return [];
    }

    const categories = fs.readdirSync(this.skillsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    return categories;
  }

  validateCategoryName(name: string): boolean {
    const kebabCaseRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return kebabCaseRegex.test(name);
  }

  convertToKebabCase(name: string): string {
    return name
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '');
  }
}