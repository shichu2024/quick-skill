export interface SkillAnchor {
  name: string;
  description: string;
  whenToUse: string;
  whenNotToUse: string;
  definitionOfDone: string;
  whatToBuild: string;
  /** SKILL.md 中 "Steps" 章节内容（流程目标检查用） */
  steps?: string;
}

export class SkillParseError extends Error {
  missingFields: string[];

  constructor(message: string, missingFields: string[]) {
    super(message);
    this.name = 'SkillParseError';
    this.missingFields = missingFields;
  }
}
