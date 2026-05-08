#!/usr/bin/env node
import { Command } from 'commander';
import initCommand from './commands/init.js';

const program = new Command();

program
  .name('quick-skill')
  .description('AI Skill 全生命周期管理 CLI 工具')
  .version('0.1.0');

program
  .command('init')
  .description('初始化项目并部署 Skill 到目标 Agent')
  .action(async () => {
    await initCommand();
  });

program
  .command('create')
  .description('交互式创建或编辑 Skill')
  .option('--edit', '编辑已有的 Skill')
  .option('--category <name>', '指定业务分类，跳过分类选择步骤')
  .option('--name <name>', 'Skill 名称（仅用于编辑模式）')
  .action(async (options) => {
    const createCommand = await import('./commands/create.js');
    await createCommand.default(options);
  });

program.parse(process.argv);