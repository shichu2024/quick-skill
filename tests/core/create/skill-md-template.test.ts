import { describe, it, expect } from 'vitest';
import { generateSkillMdTemplate } from '../../../dist/core/create/templates/skill-md-template.js';

describe('skill-md-template', () => {
  describe('generateSkillMdTemplate', () => {
    it('should generate complete SKILL.md with all sections', () => {
      const formData = {
        name: 'test-skill',
        description: 'A test skill',
        whenToUse: 'Use when testing',
        whenNotToUse: 'Do not use in production',
        whatToBuild: 'Build test artifacts',
        steps: '1. Run tests\n2. Check results',
        definitionOfDone: 'All tests pass',
      };

      const content = generateSkillMdTemplate(formData);

      expect(content).toContain('name: test-skill');
      expect(content).toContain('description: A test skill');
      expect(content).toContain('# When to use this');
      expect(content).toContain('Use when testing');
      expect(content).toContain('# When NOT to use this');
      expect(content).toContain('Do not use in production');
      expect(content).toContain('# What to build');
      expect(content).toContain('Build test artifacts');
      expect(content).toContain('# Steps');
      expect(content).toContain('1. Run tests');
      expect(content).toContain('# Definition of done');
      expect(content).toContain('All tests pass');
    });

    it('should generate minimal SKILL.md with only required fields', () => {
      const formData = {
        name: 'minimal-skill',
        description: 'Minimal description',
      };

      const content = generateSkillMdTemplate(formData);

      expect(content).toContain('name: minimal-skill');
      expect(content).toContain('description: Minimal description');
      expect(content).not.toContain('# When to use this');
      expect(content).not.toContain('# Steps');
    });

    it('should handle partial sections', () => {
      const formData = {
        name: 'partial-skill',
        description: 'Partial description',
        whenToUse: 'Only when needed',
        definitionOfDone: 'Complete when done',
      };

      const content = generateSkillMdTemplate(formData);

      expect(content).toContain('# When to use this');
      expect(content).toContain('Only when needed');
      expect(content).toContain('# Definition of done');
      expect(content).toContain('Complete when done');
      expect(content).not.toContain('# When NOT to use this');
      expect(content).not.toContain('# Steps');
    });
  });
});