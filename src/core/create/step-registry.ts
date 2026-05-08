import type { CreateStep } from './types.js';

export class StepRegistry {
  private steps: CreateStep[] = [];

  register(step: CreateStep): void {
    this.steps.push(step);
  }

  getSteps(): CreateStep[] {
    return [...this.steps];
  }

  getStepByName(name: string): CreateStep | undefined {
    return this.steps.find(s => s.name === name);
  }

  clear(): void {
    this.steps = [];
  }
}