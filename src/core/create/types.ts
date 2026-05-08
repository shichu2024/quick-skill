export type CreateMode = 'create' | 'edit';

export interface SkillFormData {
  category?: string;
  name?: string;
  description?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  whatToBuild?: string;
  steps?: string;
  definitionOfDone?: string;
}

export interface StepResult {
  stepName: string;
  completed: boolean;
  skipped: boolean;
  data: Partial<SkillFormData>;
}

export interface CreateStep {
  name: string;
  isRequired: boolean;
  execute(formData: SkillFormData): Promise<StepResult>;
}

export interface CreateContext {
  mode: CreateMode;
  formData: SkillFormData;
  skillPath?: string;
}