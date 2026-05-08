#!/usr/bin/env node
/**
 * 快速验证脚本 - 不依赖编译
 */

import fs from 'fs';
import { execSync } from 'child_process';

console.log('\n=== Quick Skill 快速验证 ===\n');

// 1. 检查项目结构
const checks = [
  { name: 'package.json', path: './package.json' },
  { name: 'tsconfig.json', path: './tsconfig.json' },
  { name: 'vitest.config.ts', path: './vitest.config.ts' },
  { name: 'src/cli.ts', path: './src/cli.ts' },
  { name: 'dist目录', path: './dist' },
];

console.log('1. 项目结构检查:');
checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  console.log(`   ${exists ? '✓' : '✗'} ${check.name}`);
});

// 2. 检查 npm link
console.log('\n2. npm link 状态:');
try {
  const result = execSync('npm list -g quick-skill', { encoding: 'utf8' });
  if (result.includes('quick-skill')) {
    console.log('   ✓ quick-skill 已链接到全局');
    console.log('   可以直接使用: quick-skill init');
  }
} catch (e) {
  console.log('   ⚠ 未链接，请运行: npm link');
}

// 3. 提供测试命令
console.log('\n3. 可用的测试命令:');
console.log('   • 查看帮助: node dist/cli.js --help');
console.log('   • 测试 init: quick-skill init');
console.log('   • 测试 create: quick-skill create --category public');
console.log('   • 运行测试: npm test');

console.log('\n=== 验证完成 ===\n');