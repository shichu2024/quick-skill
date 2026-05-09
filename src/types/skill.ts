export interface SkillAnchor {
  name: string;
  description: string;
  whenToUse: string;
  whenNotToUse: string;
  definitionOfDone: string;
  whatToBuild: string;
}

export class SkillParseError extends Error {
  missingFields: string[];

  constructor(message: string, missingFields: string[]) {
    super(message);
    this.name = 'SkillParseError';
    this.missingFields = missingFields;
  }
}
