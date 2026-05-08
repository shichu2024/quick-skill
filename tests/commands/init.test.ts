import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runInit } from '../../src/commands/init.js';
import type { AgentName } from '../../src/constants/agents.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('init command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

it('should return claude agent and target directory when user selects Claude', async () => {
    const mockFs = vi.mocked(fs);
    const mockInquirer = vi.mocked(await import('inquirer'));

    mockInquirer.default.prompt.mockResolvedValueOnce({ agent: 'claude' as AgentName });
    mockFs.existsSync.mockReturnValue(true);

    const result = await runInit();

    expect(result).not.toBeNull();
    expect(result!.agent).toBe('claude');
    expect(result!.targetDir).toMatch(/claude[\/\\]skills$/);
  });

  it('should return opencode agent and target directory when user selects OpenCode', async () => {
    const mockFs = vi.mocked(fs);
    const mockInquirer = vi.mocked(await import('inquirer'));

    mockInquirer.default.prompt.mockResolvedValueOnce({ agent: 'opencode' as AgentName });
    mockFs.existsSync.mockReturnValue(false);

    const result = await runInit();

    expect(result).not.toBeNull();
    expect(result!.agent).toBe('opencode');
    expect(result!.targetDir).toMatch(/opencode[\/\\]skills$/);
  });

  it('should return relay agent and target directory when user selects Relay', async () => {
    const mockFs = vi.mocked(fs);
    const mockInquirer = vi.mocked(await import('inquirer'));

    mockInquirer.default.prompt.mockResolvedValueOnce({ agent: 'relay' as AgentName });
    mockFs.existsSync.mockReturnValue(false);

    const result = await runInit();

    expect(result).not.toBeNull();
    expect(result!.agent).toBe('relay');
    expect(result!.targetDir).toMatch(/[\/\\]\.relay[\/\\]skills$/);
  });

  it('should create directory if it does not exist', async () => {
    const mockFs = vi.mocked(fs);
    const mockInquirer = vi.mocked(await import('inquirer'));

    mockInquirer.default.prompt.mockResolvedValueOnce({ agent: 'claude' as AgentName });
    mockFs.existsSync.mockReturnValue(false);

    await runInit();

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringMatching(/claude[\/\\]skills$/),
      { recursive: true }
    );
  });

  it('should not create directory if it already exists', async () => {
    const mockFs = vi.mocked(fs);
    const mockInquirer = vi.mocked(await import('inquirer'));

    mockInquirer.default.prompt.mockResolvedValueOnce({ agent: 'claude' as AgentName });
    mockFs.existsSync.mockReturnValue(true);

    await runInit();

    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
  });
});