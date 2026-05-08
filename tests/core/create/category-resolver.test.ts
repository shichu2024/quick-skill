import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryResolver } from '../../../dist/core/create/category-resolver.js';

describe('category-resolver', () => {
  describe('CategoryResolver', () => {
    it('should get existing categories from skills directory', () => {
      const resolver = new CategoryResolver('./skills');
      const categories = resolver.getExistingCategories();

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
    });

    it('should validate kebab-case category name', () => {
      const resolver = new CategoryResolver();

      expect(resolver.validateCategoryName('public')).toBe(true);
      expect(resolver.validateCategoryName('requirements')).toBe(true);
      expect(resolver.validateCategoryName('my-category')).toBe(true);
      expect(resolver.validateCategoryName('MyCategory')).toBe(false);
      expect(resolver.validateCategoryName('my_category')).toBe(false);
      expect(resolver.validateCategoryName('my category')).toBe(false);
    });

    it('should convert to kebab-case', () => {
      const resolver = new CategoryResolver();

      expect(resolver.convertToKebabCase('MyCategory')).toBe('mycategory');
      expect(resolver.convertToKebabCase('my_category')).toBe('my-category');
      expect(resolver.convertToKebabCase('my category')).toBe('my-category');
      expect(resolver.convertToKebabCase('需求分析')).toBe('');
    });
  });
});