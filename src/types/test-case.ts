export interface TestCase {
  id: string;
  should_trigger: boolean;
  prompt: string;
  pass_criteria: string;
  custom: boolean;
  deprecated: boolean;
}
