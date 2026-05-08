import * as fs from 'fs/promises';
import * as path from 'path';
import type { SkillFormData } from './types.js';

const DRAFT_FILE_NAME = '.create-draft.json';

export interface DraftData {
  formData: Partial<SkillFormData>;
  completedSteps: string[];
  nextStep: string;
  savedAt: string;
}

export interface DraftManager {
  save(draft: DraftData): Promise<void>;
  load(): Promise<DraftData | null>;
  clear(): Promise<void>;
  exists(): Promise<boolean>;
}

export class FileDraftManager implements DraftManager {
  private skillPath: string;

  constructor(skillPath: string) {
    this.skillPath = skillPath;
  }

  private getDraftFilePath(): string {
    return path.join(this.skillPath, DRAFT_FILE_NAME);
  }

  async save(draft: DraftData): Promise<void> {
    const draftPath = this.getDraftFilePath();
    const content = JSON.stringify(draft, null, 2);
    await fs.writeFile(draftPath, content, 'utf-8');
  }

  async load(): Promise<DraftData | null> {
    const draftPath = this.getDraftFilePath();
    try {
      const content = await fs.readFile(draftPath, 'utf-8');
      return JSON.parse(content) as DraftData;
    } catch {
      // 文件不存在或解析失败时返回 null
      return null;
    }
  }

  async clear(): Promise<void> {
    const draftPath = this.getDraftFilePath();
    try {
      await fs.unlink(draftPath);
    } catch {
      // 文件不存在时忽略错误
    }
  }

  async exists(): Promise<boolean> {
    const draftPath = this.getDraftFilePath();
    try {
      await fs.access(draftPath);
      return true;
    } catch {
      return false;
    }
  }
}
