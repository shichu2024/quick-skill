import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileDraftManager, type DraftData } from '../../../dist/core/create/draft-manager.js';

// 模拟 fs/promises 模块
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
}));

describe('draft-manager', () => {
  describe('FileDraftManager', () => {
    let manager: FileDraftManager;
    const mockSkillPath = '/tmp/test-skill';
    const expectedDraftPath = path.join(mockSkillPath, '.create-draft.json');
    const mockFs = vi.mocked(fs);

    beforeEach(() => {
      manager = new FileDraftManager(mockSkillPath);
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    describe('save', () => {
      it('should save draft data to file', async () => {
        const draftData: DraftData = {
          formData: { name: 'test-skill', description: 'A test skill' },
          completedSteps: ['category', 'name', 'description'],
          nextStep: 'whenToUse',
          savedAt: '2026-05-08T10:00:00.000Z',
        };

        await manager.save(draftData);

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expectedDraftPath,
          expect.stringContaining('"name": "test-skill"'),
          'utf-8'
        );
      });

      it('should save draft with formatted JSON', async () => {
        const draftData: DraftData = {
          formData: { category: 'backend' },
          completedSteps: ['category'],
          nextStep: 'name',
          savedAt: '2026-05-08T10:00:00.000Z',
        };

        await manager.save(draftData);

        const callArgs = mockFs.writeFile.mock.calls[0];
        const content = callArgs[1] as string;
        // 验证格式化的 JSON（包含缩进）
        expect(content).toContain('\n');
        expect(content).toContain('"formData"');
        expect(content).toContain('"completedSteps"');
        expect(content).toContain('"nextStep"');
        expect(content).toContain('"savedAt"');
      });

      it('should save draft with correct file path', async () => {
        const draftData: DraftData = {
          formData: {},
          completedSteps: [],
          nextStep: 'category',
          savedAt: '2026-05-08T10:00:00.000Z',
        };

        await manager.save(draftData);

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expectedDraftPath,
          expect.any(String),
          'utf-8'
        );
      });
    });

    describe('load', () => {
      it('should load existing draft data', async () => {
        const draftContent = JSON.stringify({
          formData: { name: 'existing-skill' },
          completedSteps: ['category', 'name'],
          nextStep: 'description',
          savedAt: '2026-05-08T09:00:00.000Z',
        });
        mockFs.readFile.mockResolvedValue(draftContent);

        const result = await manager.load();

        expect(result).toEqual({
          formData: { name: 'existing-skill' },
          completedSteps: ['category', 'name'],
          nextStep: 'description',
          savedAt: '2026-05-08T09:00:00.000Z',
        });
        expect(mockFs.readFile).toHaveBeenCalledWith(
          expectedDraftPath,
          'utf-8'
        );
      });

      it('should return null when draft file does not exist', async () => {
        mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

        const result = await manager.load();

        expect(result).toBeNull();
      });

      it('should return null when draft file content is invalid JSON', async () => {
        mockFs.readFile.mockResolvedValue('invalid json content');

        const result = await manager.load();

        expect(result).toBeNull();
      });
    });

    describe('clear', () => {
      it('should delete draft file', async () => {
        await manager.clear();

        expect(mockFs.unlink).toHaveBeenCalledWith(expectedDraftPath);
      });

      it('should not throw when draft file does not exist', async () => {
        mockFs.unlink.mockRejectedValue(new Error('ENOENT: no such file'));

        // 不应抛出异常
        await expect(manager.clear()).resolves.not.toThrow();
      });
    });

    describe('exists', () => {
      it('should return true when draft file exists', async () => {
        mockFs.access.mockResolvedValue(undefined);

        const result = await manager.exists();

        expect(result).toBe(true);
        expect(mockFs.access).toHaveBeenCalledWith(expectedDraftPath);
      });

      it('should return false when draft file does not exist', async () => {
        mockFs.access.mockRejectedValue(new Error('ENOENT: no such file'));

        const result = await manager.exists();

        expect(result).toBe(false);
      });
    });

    describe('integration scenarios', () => {
      it('should support save -> load cycle', async () => {
        const draftData: DraftData = {
          formData: {
            category: 'frontend',
            name: 'ui-component',
            description: 'A UI component skill',
          },
          completedSteps: ['category', 'name', 'description'],
          nextStep: 'whenToUse',
          savedAt: '2026-05-08T12:00:00.000Z',
        };

        // 模拟 save 写入后，load 能读取到相同内容
        let savedContent: string | undefined;
        mockFs.writeFile.mockImplementation(async (_path, content) => {
          savedContent = content as string;
        });
        mockFs.readFile.mockImplementation(async () => {
          if (savedContent) return savedContent;
          throw new Error('ENOENT');
        });

        await manager.save(draftData);
        const loaded = await manager.load();

        expect(loaded).toEqual(draftData);
      });

      it('should support exists -> clear -> exists cycle', async () => {
        mockFs.access.mockResolvedValue(undefined);
        expect(await manager.exists()).toBe(true);

        mockFs.unlink.mockResolvedValue(undefined);
        await manager.clear();

        mockFs.access.mockRejectedValue(new Error('ENOENT'));
        expect(await manager.exists()).toBe(false);
      });
    });
  });
});
