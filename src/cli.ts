#!/usr/bin/env node
import { Command } from 'commander';
import initCommand from './commands/init.js';
import { registerEvalGenCommand } from './commands/eval-gen.js';

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

program
  .command('diagnose')
  .description('对指定路径的存量技能执行合规性诊断')
  .argument('<path>', '技能目录路径')
  .option('--output <path>', '诊断报告输出路径')
  .option('--fix-auto', '自动修复可标准化的问题')
  .option('--batch', '批量诊断模式下扫描目录')
  .option('--filter <type>', '按技能文件类型筛选')
  .action(async (skillPath, options) => {
    const diagnoseCommand = await import('./commands/diagnose.js');
    await diagnoseCommand.default(skillPath, options);
  });

// 注册 eval-gen 命令
registerEvalGenCommand(program);

program.parse(process.argv);