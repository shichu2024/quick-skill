#!/usr/bin/env node
/**
 * 本地功能验证脚本
 * 用于测试 quick-skill 的核心功能
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const projectRoot = path.resolve(process.cwd());
const distCli = path.join(projectRoot, 'dist', 'cli.js');

console.log('=== Quick Skill 本地功能验证 ===\n');

// 测试 1: CLI 编译检查
console.log('测试 1: 检查 CLI 编译...');
if (fs.existsSync(distCli)) {
  console.log('✓ dist/cli.js 存在');
} else {
  console.log('✗ dist/cli.js 不存在，请先运行 npm run build');
  process.exit(1);
}

// 测试 2: --help 命令
console.log('\n测试 2: 检查 --help 输出...');
const helpProcess = spawn('node', [distCli, '--help'], { cwd: projectRoot });

helpProcess.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('quick-skill') && output.includes('init') && output.includes('create')) {
    console.log('✓ --help 输出正常');
    console.log('  包含命令: init, create');
  }
});

helpProcess.stderr.on('data', (data) => {
  console.log('✗ --help 错误:', data.toString());
});

// 测试 3: 检查 skills 目录
console.log('\n测试 3: 检查 skills 源目录...');
const skillsPath = path.join(projectRoot, 'skills');
if (fs.existsSync(skillsPath)) {
  const categories = fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`✓ skills 目录存在`);
  console.log(`  分类数量: ${categories.length}`);
  console.log(`  分类列表: ${categories.join(', ')}`);
} else {
  console.log('⚠ skills 目录不存在，init 命令将提示 Skill 源为空');
}

// 测试 4: 检查测试覆盖
console.log('\n测试 4: 检查测试覆盖...');
const testProcess = spawn('npm', ['test', '--', '--run'], { 
  cwd: projectRoot,
  shell: true
});

let testOutput = '';
testProcess.stdout.on('data', (data) => {
  testOutput += data.toString();
});

testProcess.on('close', (code) => {
  if (code === 0) {
    const passedMatch = testOutput.match(/Tests\s+(\d+)\s+passed/);
    if (passedMatch) {
      console.log(`✓ 所有测试通过 (${passedMatch[1]} tests)`);
    }
  } else {
    console.log('✗ 测试失败');
  }
  
  console.log('\n=== 验证完成 ===');
  console.log('\n下一步测试建议:');
  console.log('1. 运行交互式测试: quick-skill init');
  console.log('2. 运行创建测试: quick-skill create --category public');
  console.log('3. 查看生成文件: skills/{category}/{skill-name}/SKILL.md');
});

// 测试 5: 检查关键文件
console.log('\n测试 5: 检查关键模块文件...');
const criticalFiles = [
  'dist/cli.js',
  'dist/commands/init.js',
  'dist/commands/create.js',
  'dist/core/create/step-runner.js',
  'dist/services/skill-scanner.js',
];

let allFilesExist = true;
for (const file of criticalFiles) {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} 不存在`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('✓ 所有关键模块已编译');
} else {
  console.log('✗ 有文件缺失，请重新编译');
}