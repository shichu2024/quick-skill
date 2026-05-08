import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NameValidator } from '../../../dist/core/create/name-validator.js';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('name-validator', () => {
  describe('NameValidator', () => {
    let validator: NameValidator;
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
      validator = new NameValidator('./skills');
      vi.clearAllMocks();
    });

    it('should validate kebab-case name format', () => {
      expect(validator.validateNameFormat('my-skill')).toBe(true);
      expect(validator.validateNameFormat('skill-name')).toBe(true);
      expect(validator.validateNameFormat('MySkill')).toBe(false);
      expect(validator.validateNameFormat('my_skill')).toBe(false);
      expect(validator.validateNameFormat('my skill')).toBe(false);
    });

    it('should convert to kebab-case', () => {
      expect(validator.convertToKebabCase('MySkill')).toBe('myskill');
      expect(validator.convertToKebabCase('my_skill')).toBe('my-skill');
      expect(validator.convertToKebabCase('my skill')).toBe('my-skill');
      expect(validator.convertToKebabCase('SkillName123')).toBe('skillname123');
    });

    it('should check if name exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      const exists = validator.checkNameExists('public', 'existing-skill');
      expect(exists).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should validate unique name', () => {
      mockFs.existsSync.mockReturnValue(false);
      const isUnique = validator.validateUniqueName('public', 'new-skill');
      expect(isUnique).toBe(true);
    });
  });
});