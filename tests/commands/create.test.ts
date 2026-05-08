import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock process.exit to prevent tests from terminating
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock console methods
const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock all step classes to avoid complex inquirer mocking
vi.mock('../../src/core/create/steps/category-step.js', () => ({
  CategoryStep: class {
    name = '业务分类选择';
    isRequired = true;
    async execute(formData: any) {
      return {
        stepName: this.name,
        completed: true,
        skipped: !!formData.category,
        data: { category: formData.category || 'test-category' },
      };
    }
  },
}));

vi.mock('../../src/core/create/steps/mission-step.js', () => ({
  MissionStep: class {
    name = 'Skill 使命定义';
    isRequired = true;
    async execute() {
      return {
        stepName: this.name,
        completed: true,
        skipped: false,
        data: { name: 'test-skill', description: 'A test skill' },
      };
    }
  },
}));

vi.mock('../../src/core/create/steps/boundary-step.js', () => ({
  BoundaryStep: class {
    name = '触发边界定义';
    isRequired = true;
    async execute() {
      return {
        stepName: this.name,
        completed: true,
        skipped: false,
        data: { whenToUse: 'When testing', whenNotToUse: 'Not for production' },
      };
    }
  },
  StandardStep: class {
    name = '成功标准定义';
    isRequired = true;
    async execute() {
      return {
        stepName: this.name,
        completed: true,
        skipped: false,
        data: { whatToBuild: 'Test artifacts', definitionOfDone: 'All pass' },
      };
    }
  },
}));

vi.mock('../../src/core/create/steps/steps-step.js', () => ({
  StepsStep: class {
    name = '执行步骤定义';
    isRequired = false;
    async execute() {
      return {
        stepName: this.name,
        completed: true,
        skipped: false,
        data: { steps: '1. Test\n2. Verify' },
      };
    }
  },
}));

describe('create command', () => {
  let skillsPath: string;
  let draftPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use the default ./skills path that SkillMdWriter uses
    skillsPath = path.join(process.cwd(), 'skills');
    draftPath = path.join(process.cwd(), '.create-draft.json');

    // Clean up and create fresh skills directory
    try {
      if (fs.existsSync(skillsPath)) {
        fs.rmSync(skillsPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors (e.g., junction symlinks on Windows)
    }
    try {
      fs.mkdirSync(skillsPath, { recursive: true });
    } catch {
      // Directory might already exist from another test, that's OK
    }

    // Clean up draft file
    if (fs.existsSync(draftPath)) {
      try {
        fs.unlinkSync(draftPath);
      } catch {
        // Ignore
      }
    }
  });

  afterEach(() => {
    // Clean up skills directory
    try {
      if (fs.existsSync(skillsPath)) {
        fs.rmSync(skillsPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
    // Clean up draft file
    try {
      if (fs.existsSync(draftPath)) {
        fs.unlinkSync(draftPath);
      }
    } catch {
      // Ignore
    }
  });

  describe('创建模式 (create mode)', () => {
    it('should run create flow and generate SKILL.md', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      // EvalSyncTrigger prompt
      mockInquirer.prompt.mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({});

      expect(mockExit).toHaveBeenCalledWith(0);
      // Verify SKILL.md was created in default ./skills path
      const skillMdPath = path.join(skillsPath, 'test-category', 'test-skill', 'SKILL.md');
      expect(fs.existsSync(skillMdPath)).toBe(true);

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      expect(content).toContain('name: test-skill');
      expect(content).toContain('description: A test skill');
    });

    it('should use --category parameter to skip category step', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      mockInquirer.prompt.mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({ category: 'pre-set-category' });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('已指定分类'));
      expect(mockExit).toHaveBeenCalledWith(0);

      // Verify skill was created in the specified category
      const skillMdPath = path.join(skillsPath, 'pre-set-category', 'test-skill', 'SKILL.md');
      expect(fs.existsSync(skillMdPath)).toBe(true);
    });

    it('should detect draft and prompt resume/restart', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      // Create a draft file
      const draftData = {
        formData: {
          category: 'draft-category',
          name: 'draft-skill',
          description: 'Draft description',
        },
        completedSteps: ['业务分类选择', 'Skill 使命定义'],
        nextStep: '触发边界定义',
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(draftPath, JSON.stringify(draftData, null, 2));

      // Draft prompt + EvalSyncTrigger prompt
      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'resume' })
        .mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({});

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('发现未完成的草稿'));
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should clear draft and restart when user chooses restart', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      // Create draft
      const draftData = {
        formData: { category: 'old-category' },
        completedSteps: ['业务分类选择'],
        nextStep: 'Skill 使命定义',
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(draftPath, JSON.stringify(draftData, null, 2));

      // Draft prompt + all step prompts + EvalSyncTrigger prompt
      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'restart' })
        .mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({});

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('已清除草稿'));
      // Draft file should be cleared
      expect(fs.existsSync(draftPath)).toBe(false);
    });

    it('should clear draft after successful creation', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      // Create draft before creation
      const draftData = {
        formData: { category: 'test-category' },
        completedSteps: [],
        nextStep: '业务分类选择',
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(draftPath, JSON.stringify(draftData, null, 2));

      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'restart' })
        .mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({});

      // Draft should be cleared after successful creation
      expect(fs.existsSync(draftPath)).toBe(false);
    });
  });

  describe('编辑模式 (edit mode)', () => {
    it('should require skill name in edit mode', async () => {
      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({ edit: true });

      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('编辑模式需要指定 Skill 名称')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should show error when skill not found', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      mockInquirer.prompt.mockResolvedValueOnce({});

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({ edit: true, name: 'non-existent-skill' });

      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('编辑流程失败')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should enter edit mode and update SKILL.md', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);
      mockInquirer.prompt.mockClear();

      // Create a real Skill file for editing in ./skills
      const skillDir = path.join(skillsPath, 'test-cat', 'existing-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const skillMdContent = `---
name: existing-skill
description: An existing skill for editing
---

# When to use this
Use when testing

# When NOT to use this
Not for production

# What to build
Test artifacts

# Steps
1. Test
2. Verify

# Definition of done
All tests pass
`;
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMdContent);

      // Edit mode prompts: 8 fields + eval-sync
      // Note: EditMode iterates through EDITABLE_FIELDS in order:
      // category, name, description, whenToUse, whenNotToUse, whatToBuild, steps, definitionOfDone
      mockInquirer.prompt
        .mockResolvedValueOnce({ value: '' }) // category - keep
        .mockResolvedValueOnce({ value: '' }) // name - keep
        .mockResolvedValueOnce({ value: 'Updated description' }) // description - update
        .mockResolvedValueOnce({ value: 'Updated when to use' }) // whenToUse - update
        .mockResolvedValueOnce({ value: '' }) // whenNotToUse - keep
        .mockResolvedValueOnce({ value: '' }) // whatToBuild - keep
        .mockResolvedValueOnce({ value: '' }) // steps - keep
        .mockResolvedValueOnce({ value: '' }) // definitionOfDone - keep
        .mockResolvedValueOnce({ confirmed: false }); // eval-sync - decline

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({ edit: true, name: 'existing-skill' });

      expect(mockExit).toHaveBeenCalledWith(0);

      // Verify backup was created
      const backupPath = path.join(skillDir, 'SKILL.md.bak');
      expect(fs.existsSync(backupPath)).toBe(true);

      // Verify the file was modified (content changed from original)
      const updatedContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
      // The update should contain the new values somewhere in the file
      expect(updatedContent).toContain('Updated description');
      expect(updatedContent).toContain('Updated when to use');
      // The file structure should be valid SKILL.md format
      expect(updatedContent).toContain('---');
      expect(updatedContent).toContain('name:');
      expect(updatedContent).toContain('description:');
      // Should have section headers
      expect(updatedContent).toContain('# When to use this');
      expect(updatedContent).toContain('# When NOT to use this');
    });
  });

  describe('mode 区分', () => {
    it('should show 创建模式 in create mode log', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      mockInquirer.prompt.mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({});

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('创建模式')
      );
    });

    it('should show 编辑模式 in edit mode log', async () => {
      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({ edit: true });

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('编辑模式')
      );
    });
  });

  describe('eval-sync 联动', () => {
    it('should prompt for eval-gen in create mode', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);

      // EvalSyncTrigger prompt
      mockInquirer.prompt.mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({});

      // Should have called inquirer for eval-gen prompt
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          message: '是否立即生成测试用例？',
        })
      );
    });

    it('should prompt for eval-sync in edit mode', async () => {
      const inquirer = await import('inquirer');
      const mockInquirer = vi.mocked(inquirer.default);
      mockInquirer.prompt.mockClear();

      // Create a skill for editing
      const skillDir = path.join(skillsPath, 'test-cat', 'edit-sync-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: edit-sync-skill
description: Test skill
---

# When to use this
Testing
`);

      // Edit prompts (8 fields) + eval-sync prompt
      for (let i = 0; i < 8; i++) {
        mockInquirer.prompt.mockResolvedValueOnce({ value: 'updated' });
      }
      mockInquirer.prompt.mockResolvedValueOnce({ confirmed: false });

      const { default: createCommand } = await import('../../src/commands/create.js');

      await createCommand({ edit: true, name: 'edit-sync-skill' });

      // Should have called inquirer for eval-sync prompt
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          message: '是否同步更新测试用例？',
        })
      );
    });
  });
});
