import { describe, it, expect } from 'vitest';
import { formatDeployReport, printDeployReport, getExitCode } from '../../src/utils/reporter.js';
import type { DeployResult } from '../../src/services/skill-deployer.js';

describe('init reporter', () => {
  describe('formatDeployReport', () => {
    it('should format successful deployment', () => {
      const result: DeployResult = {
        deployed: ['skill-a', 'skill-b'],
        skipped: [],
        errors: [],
      };
      const targetDir = '/test/skills';

      const report = formatDeployReport(result, targetDir);

      expect(report).toContain('目标目录: /test/skills');
      expect(report).toContain('成功部署: 2 个 Skill');
      expect(report).toContain('skill-a');
      expect(report).toContain('skill-b');
    });

    it('should format skipped skills', () => {
      const result: DeployResult = {
        deployed: ['skill-a'],
        skipped: ['skill-x', 'skill-y'],
        errors: [],
      };
      const targetDir = '/test/skills';

      const report = formatDeployReport(result, targetDir);

      expect(report).toContain('已跳过: 2 个 Skill');
      expect(report).toContain('skill-x');
      expect(report).toContain('skill-y');
    });

    it('should format errors', () => {
      const result: DeployResult = {
        deployed: [],
        skipped: [],
        errors: [
          { skillName: 'skill-z', reason: 'IO错误' },
        ],
      };
      const targetDir = '/test/skills';

      const report = formatDeployReport(result, targetDir);

      expect(report).toContain('部署失败: 1 个 Skill');
      expect(report).toContain('skill-z: IO错误');
    });

    it('should format mixed results', () => {
      const result: DeployResult = {
        deployed: ['skill-a'],
        skipped: ['skill-x'],
        errors: [{ skillName: 'skill-z', reason: '失败' }],
      };
      const targetDir = '/test/skills';

      const report = formatDeployReport(result, targetDir);

      expect(report).toContain('成功部署: 1 个 Skill');
      expect(report).toContain('已跳过: 1 个 Skill');
      expect(report).toContain('部署失败: 1 个 Skill');
    });
  });

  describe('getExitCode', () => {
    it('should return 0 when all skills deployed successfully', () => {
      const result: DeployResult = {
        deployed: ['skill-a', 'skill-b'],
        skipped: [],
        errors: [],
      };

      expect(getExitCode(result)).toBe(0);
    });

    it('should return 0 when partially successful', () => {
      const result: DeployResult = {
        deployed: ['skill-a'],
        skipped: ['skill-x'],
        errors: [],
      };

      expect(getExitCode(result)).toBe(0);
    });

    it('should return 1 when all failed', () => {
      const result: DeployResult = {
        deployed: [],
        skipped: [],
        errors: [{ skillName: 'skill-z', reason: '失败' }],
      };

      expect(getExitCode(result)).toBe(1);
    });

    it('should return 0 when some deployed and some failed', () => {
      const result: DeployResult = {
        deployed: ['skill-a'],
        skipped: [],
        errors: [{ skillName: 'skill-z', reason: '失败' }],
      };

      expect(getExitCode(result)).toBe(0);
    });
  });
});