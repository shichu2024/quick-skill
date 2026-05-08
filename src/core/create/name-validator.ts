import * as fs from 'fs';
import * as path from 'path';

export class NameValidator {
  private skillsPath: string;

  constructor(skillsPath: string = './skills') {
    this.skillsPath = skillsPath;
  }

  validateNameFormat(name: string): boolean {
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

  checkNameExists(category: string, name: string): boolean {
    const skillPath = path.join(this.skillsPath, category, name);
    return fs.existsSync(skillPath);
  }

  validateUniqueName(category: string, name: string): boolean {
    return !this.checkNameExists(category, name);
  }
}