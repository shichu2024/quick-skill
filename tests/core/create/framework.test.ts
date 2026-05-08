import { describe, it, expect } from 'vitest';
import { StepRegistry } from '../../../dist/core/create/step-registry.js';
import { StepRunner } from '../../../dist/core/create/step-runner.js';
import type { CreateStep, SkillFormData, StepResult } from '../../../dist/core/create/types.js';

describe('create framework', () => {
  describe('StepRegistry', () => {
    it('should register and retrieve steps', () => {
      const registry = new StepRegistry();
      const mockStep: CreateStep = {
        name: 'test-step',
        isRequired: true,
        execute: async () => ({ stepName: 'test-step', completed: true, skipped: false, data: {} }),
      };

      registry.register(mockStep);
      const steps = registry.getSteps();

      expect(steps).toHaveLength(1);
      expect(steps[0].name).toBe('test-step');
    });

    it('should find step by name', () => {
      const registry = new StepRegistry();
      const mockStep: CreateStep = {
        name: 'category-step',
        isRequired: false,
        execute: async () => ({ stepName: 'category-step', completed: true, skipped: false, data: {} }),
      };

      registry.register(mockStep);
      const found = registry.getStepByName('category-step');

      expect(found).toBeDefined();
      expect(found?.name).toBe('category-step');
    });

    it('should return undefined for non-existent step', () => {
      const registry = new StepRegistry();
      const found = registry.getStepByName('non-existent');

      expect(found).toBeUndefined();
    });

    it('should clear all steps', () => {
      const registry = new StepRegistry();
      registry.register({
        name: 'step1',
        isRequired: true,
        execute: async () => ({ stepName: 'step1', completed: true, skipped: false, data: {} }),
      });

      registry.clear();
      expect(registry.getSteps()).toHaveLength(0);
    });
  });

  describe('StepRunner', () => {
    it('should run all steps in sequence', async () => {
      const registry = new StepRegistry();
      const step1: CreateStep = {
        name: 'step1',
        isRequired: true,
        execute: async (formData) => ({
          stepName: 'step1',
          completed: true,
          skipped: false,
          data: { category: 'test' },
        }),
      };
      const step2: CreateStep = {
        name: 'step2',
        isRequired: false,
        execute: async (formData) => ({
          stepName: 'step2',
          completed: true,
          skipped: false,
          data: { name: 'test-skill' },
        }),
      };

      registry.register(step1);
      registry.register(step2);

      const runner = new StepRunner(registry);
      const formData: SkillFormData = {};
      const result = await runner.runAll(formData);

      expect(result.category).toBe('test');
      expect(result.name).toBe('test-skill');
    });

    it('should skip optional steps when skipped', async () => {
      const registry = new StepRegistry();
      const optionalStep: CreateStep = {
        name: 'optional-step',
        isRequired: false,
        execute: async (formData) => ({
          stepName: 'optional-step',
          completed: false,
          skipped: true,
          data: {},
        }),
      };

      registry.register(optionalStep);

      const runner = new StepRunner(registry);
      const formData: SkillFormData = {};
      const result = await runner.runAll(formData);

      expect(result).toBeDefined();
    });

    it('should throw error when required step not completed', async () => {
      const registry = new StepRegistry();
      const requiredStep: CreateStep = {
        name: 'required-step',
        isRequired: true,
        execute: async (formData) => ({
          stepName: 'required-step',
          completed: false,
          skipped: false,
          data: {},
        }),
      };

      registry.register(requiredStep);

      const runner = new StepRunner(registry);
      const formData: SkillFormData = {};

      await expect(runner.runAll(formData)).rejects.toThrow('必要步骤 required-step 未完成');
    });
  });
});