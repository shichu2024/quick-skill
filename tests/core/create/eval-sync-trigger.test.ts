import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  EvalSyncTriggerImpl,
  defaultHasSkillChanged,
  type EvalSyncTriggerHandlers,
  type HasSkillChangedFn,
} from '../../../src/core/create/eval-sync-trigger.js';

// Mock inquirer to avoid interactive prompts in tests
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';

const mockPrompt = vi.mocked(inquirer.prompt);

/** 辅助函数：模拟用户确认（true）或拒绝（false） */
function mockConfirm(confirmed: boolean) {
  mockPrompt.mockResolvedValueOnce({ confirmed });
}

describe('eval-sync-trigger', () => {
  let tempSkillPath: string;
  let handlers: EvalSyncTriggerHandlers;
  let mockHasChanged: HasSkillChangedFn;
  let trigger: EvalSyncTriggerImpl;

  beforeEach(() => {
    tempSkillPath = path.join(
      process.cwd(),
      'temp-test-skills-trigger'
    );
    fs.mkdirSync(tempSkillPath, { recursive: true });

    handlers = {
      onGenerateCases: vi.fn().mockResolvedValue(undefined),
      onSyncCases: vi.fn().mockResolvedValue(undefined),
    };

    mockHasChanged = vi.fn().mockReturnValue(true);

    trigger = new EvalSyncTriggerImpl(handlers, mockHasChanged);
    mockPrompt.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tempSkillPath, { recursive: true, force: true });
  });

  describe('defaultHasSkillChanged', () => {
    it('should return false when SKILL.md does not exist', () => {
      const result = defaultHasSkillChanged(tempSkillPath);
      expect(result).toBe(false);
    });

    it('should return false when SKILL.md is empty', () => {
      const skillMdPath = path.join(tempSkillPath, 'SKILL.md');
      fs.writeFileSync(skillMdPath, '', 'utf-8');

      const result = defaultHasSkillChanged(tempSkillPath);
      expect(result).toBe(false);
    });

    it('should return false when SKILL.md contains only whitespace', () => {
      const skillMdPath = path.join(tempSkillPath, 'SKILL.md');
      fs.writeFileSync(skillMdPath, '   \n\t  ', 'utf-8');

      const result = defaultHasSkillChanged(tempSkillPath);
      expect(result).toBe(false);
    });

    it('should return true when SKILL.md has content', () => {
      const skillMdPath = path.join(tempSkillPath, 'SKILL.md');
      fs.writeFileSync(skillMdPath, '# Test Skill\n', 'utf-8');

      const result = defaultHasSkillChanged(tempSkillPath);
      expect(result).toBe(true);
    });
  });

  describe('promptGenerateCases', () => {
    it('should skip prompt when SKILL.md has not changed', async () => {
      const noChangeTrigger = new EvalSyncTriggerImpl(
        handlers,
        () => false
      );

      await noChangeTrigger.promptGenerateCases(tempSkillPath);

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(handlers.onGenerateCases).not.toHaveBeenCalled();
    });

    it('should skip execution when user declines', async () => {
      mockConfirm(false);

      await trigger.promptGenerateCases(tempSkillPath);

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirmed',
        message: '是否立即生成测试用例？',
        default: false,
      });
      expect(handlers.onGenerateCases).not.toHaveBeenCalled();
    });

    it('should call onGenerateCases when user confirms', async () => {
      mockConfirm(true);

      await trigger.promptGenerateCases(tempSkillPath);

      expect(handlers.onGenerateCases).toHaveBeenCalledWith(tempSkillPath);
    });

    it('should show degradation message when handler is not available', async () => {
      const consoleSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const noHandlerTrigger = new EvalSyncTriggerImpl(
        {},
        () => true
      );
      mockConfirm(true);

      await noHandlerTrigger.promptGenerateCases(tempSkillPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[降级]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('eval-gen')
      );
      consoleSpy.mockRestore();
    });

    it('should not block main flow when handler throws error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      handlers.onGenerateCases = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));
      mockConfirm(true);

      await trigger.promptGenerateCases(tempSkillPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[eval-gen]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      );
      consoleSpy.mockRestore();
    });

    it('should not block main flow when handler throws non-Error value', async () => {
      const consoleSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      handlers.onGenerateCases = vi.fn().mockRejectedValue('string error');
      mockConfirm(true);

      await trigger.promptGenerateCases(tempSkillPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[eval-gen]')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('promptSyncCases', () => {
    it('should skip prompt when SKILL.md has not changed', async () => {
      const noChangeTrigger = new EvalSyncTriggerImpl(
        handlers,
        () => false
      );

      await noChangeTrigger.promptSyncCases(tempSkillPath);

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(handlers.onSyncCases).not.toHaveBeenCalled();
    });

    it('should skip execution when user declines', async () => {
      mockConfirm(false);

      await trigger.promptSyncCases(tempSkillPath);

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirmed',
        message: '是否同步更新测试用例？',
        default: false,
      });
      expect(handlers.onSyncCases).not.toHaveBeenCalled();
    });

    it('should call onSyncCases when user confirms', async () => {
      mockConfirm(true);

      await trigger.promptSyncCases(tempSkillPath);

      expect(handlers.onSyncCases).toHaveBeenCalledWith(tempSkillPath);
    });

    it('should show degradation message when handler is not available', async () => {
      const consoleSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const noHandlerTrigger = new EvalSyncTriggerImpl(
        {},
        () => true
      );
      mockConfirm(true);

      await noHandlerTrigger.promptSyncCases(tempSkillPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[降级]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('eval-sync')
      );
      consoleSpy.mockRestore();
    });

    it('should not block main flow when handler throws error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      handlers.onSyncCases = vi
        .fn()
        .mockRejectedValue(new Error('Sync failed'));
      mockConfirm(true);

      await trigger.promptSyncCases(tempSkillPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[eval-sync]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('integration with defaultHasSkillChanged', () => {
    it('should use defaultHasSkillChanged when no custom function provided', async () => {
      const consoleSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const defaultTrigger = new EvalSyncTriggerImpl(handlers);
      mockConfirm(true);

      // SKILL.md 不存在时应跳过
      await defaultTrigger.promptGenerateCases(tempSkillPath);
      expect(mockPrompt).not.toHaveBeenCalled();

      // 创建 SKILL.md 后应触发提示
      const skillMdPath = path.join(tempSkillPath, 'SKILL.md');
      fs.writeFileSync(skillMdPath, '# Test\n', 'utf-8');
      mockConfirm(true);

      await defaultTrigger.promptGenerateCases(tempSkillPath);
      expect(mockPrompt).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
