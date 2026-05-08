import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { PermissionError, SkillSourceEmptyError, DeployIoError, UserCancelledError, InitError } from '../../src/utils/errors.js';

describe('error handling', () => {
  describe('InitError', () => {
    it('should create InitError with code and userMessage', () => {
      const error = new InitError('TEST_CODE', '测试错误消息');
      
      expect(error.code).toBe('TEST_CODE');
      expect(error.userMessage).toBe('测试错误消息');
      expect(error.name).toBe('InitError');
      expect(error.message).toBe('测试错误消息');
    });
  });

  describe('PermissionError', () => {
    it('should create PermissionError with default message', () => {
      const error = new PermissionError();
      
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.userMessage).toBe('当前工作目录无读写权限，请检查目录权限');
      expect(error.name).toBe('PermissionError');
    });

    it('should create PermissionError with custom message', () => {
      const customMessage = '无法写入目录 /custom/path';
      const error = new PermissionError(customMessage);
      
      expect(error.userMessage).toBe(customMessage);
    });
  });

  describe('SkillSourceEmptyError', () => {
    it('should create SkillSourceEmptyError with default message', () => {
      const error = new SkillSourceEmptyError();
      
      expect(error.code).toBe('SKILL_SOURCE_EMPTY');
      expect(error.userMessage).toBe('CLI内部Skill源为空，请联系维护者');
      expect(error.name).toBe('SkillSourceEmptyError');
    });

    it('should create SkillSourceEmptyError with custom message', () => {
      const customMessage = 'Skills 目录不存在';
      const error = new SkillSourceEmptyError(customMessage);
      
      expect(error.userMessage).toBe(customMessage);
    });
  });

  describe('DeployIoError', () => {
    it('should create DeployIoError with message', () => {
      const error = new DeployIoError('复制文件失败');
      
      expect(error.code).toBe('DEPLOY_IO_ERROR');
      expect(error.userMessage).toBe('复制文件失败');
      expect(error.name).toBe('DeployIoError');
    });

    it('should preserve original error stack', () => {
      const originalError = new Error('原始IO错误');
      const error = new DeployIoError('复制失败', originalError);
      
      expect(error.stack).toBe(originalError.stack);
    });
  });

  describe('UserCancelledError', () => {
    it('should create UserCancelledError with default message', () => {
      const error = new UserCancelledError();
      
      expect(error.code).toBe('USER_CANCELLED');
      expect(error.userMessage).toBe('用户取消操作');
      expect(error.name).toBe('UserCancelledError');
    });

    it('should create UserCancelledError with custom message', () => {
      const customMessage = '用户按 Ctrl+C 中断';
      const error = new UserCancelledError(customMessage);
      
      expect(error.userMessage).toBe(customMessage);
    });
  });

  describe('error inheritance', () => {
    it('should all extend InitError', () => {
      const permissionError = new PermissionError();
      const skillSourceError = new SkillSourceEmptyError();
      const deployError = new DeployIoError('test');
      const cancelError = new UserCancelledError();

      expect(permissionError).toBeInstanceOf(InitError);
      expect(skillSourceError).toBeInstanceOf(InitError);
      expect(deployError).toBeInstanceOf(InitError);
      expect(cancelError).toBeInstanceOf(InitError);

      expect(permissionError).toBeInstanceOf(Error);
      expect(skillSourceError).toBeInstanceOf(Error);
      expect(deployError).toBeInstanceOf(Error);
      expect(cancelError).toBeInstanceOf(Error);
    });
  });
});