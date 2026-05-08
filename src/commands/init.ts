import inquirer from 'inquirer';
import * as fs from 'fs';
import type { AgentName } from '../constants/agents.js';
import { getAgentTargetDir } from '../constants/agents.js';
import { resolveAgentSkillDir, getSkillSourcePath } from '../utils/paths.js';
import { PermissionError, SkillSourceEmptyError, DeployIoError, UserCancelledError } from '../utils/errors.js';
import { scanSkills } from '../services/skill-scanner.js';
import { deployWithOverwrite } from '../services/skill-overwriter.js';
import { printDeployReport, getExitCode } from '../utils/reporter.js';

interface InitResult {
  agent: AgentName;
  targetDir: string;
}

export async function runInit(): Promise<InitResult | null> {
  const answer = await inquirer.prompt<{
    agent: AgentName;
  }>([
    {
      type: 'list',
      name: 'agent',
      message: '选择目标 AI Agent:',
      choices: [
        { name: 'Claude', value: 'claude' },
        { name: 'OpenCode', value: 'opencode' },
        { name: 'Relay', value: 'relay' },
      ],
    },
  ]);

  const agent = answer.agent;
  const relativePath = getAgentTargetDir(agent);
  const targetDir = resolveAgentSkillDir(agent);

  console.log(`\n目标目录: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`✓ 已创建目录: ${targetDir}`);
  }

  return { agent, targetDir };
}

export default async function initCommand() {
  process.on('SIGINT', () => {
    console.log('\n\n用户中断，初始化已取消');
    process.exit(0);
  });

  try {
    const result = await runInit();
    
    if (!result) {
      throw new UserCancelledError('未选择目标Agent，初始化已取消');
    }

    console.log(`\n✓ 已选择 Agent: ${result.agent}`);
    console.log(`✓ 目标目录: ${result.targetDir}`);

    const skillSourcePath = getSkillSourcePath();
    console.log(`\n正在扫描 Skill 源...`);
    
    const skillEntries = scanSkills(skillSourcePath);
    console.log(`✓ 发现 ${skillEntries.length} 个 Skill`);

    console.log(`\n正在部署 Skill...`);
    const deployResult = await deployWithOverwrite(skillEntries, result.targetDir);

    printDeployReport(deployResult, result.targetDir);
    
    const exitCode = getExitCode(deployResult);
    
    if (exitCode === 0) {
      console.log(`✓ 初始化完成！`);
    } else {
      console.log(`✗ 初始化失败，请检查错误信息`);
    }
    
    process.exit(exitCode);
  } catch (error) {
    if (error instanceof UserCancelledError) {
      console.log(`\n${error.userMessage}`);
      process.exit(0);
    }
    
    if (error instanceof PermissionError) {
      console.error(`\n✗ ${error.userMessage}`);
      process.exit(1);
    }

    if (error instanceof SkillSourceEmptyError) {
      console.error(`\n✗ ${error.userMessage}`);
      process.exit(1);
    }

    if (error instanceof DeployIoError) {
      console.error(`\n✗ ${error.userMessage}`);
      process.exit(1);
    }

    if (error instanceof Error && error.message.includes('User force closed')) {
      console.log('\n未选择目标Agent，初始化已取消');
      process.exit(0);
    }
    
    console.error('\n✗ 初始化失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}