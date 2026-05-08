#!/usr/bin/env node
/**
 * Gitignore 验证脚本
 * 检查 gitignore 配置是否正确生效
 */

import fs from 'fs';
import { execSync } from 'child_process';

console.log('\n=== .gitignore 配置验证 ===\n');

// 1. 检查 .gitignore 文件
console.log('1. 检查 .gitignore 文件:');
if (fs.existsSync('.gitignore')) {
  const content = fs.readFileSync('.gitignore', 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  console.log(`   ✓ .gitignore 存在，包含 ${lines.length} 条规则`);
  
  // 显示关键规则
  const keyRules = [
    'node_modules/',
    'dist/',
    'claude/',
    'opencode/',
    '.relay/',
    'coverage/',
    '*.log',
  ];
  
  console.log('\n   关键忽略规则:');
  keyRules.forEach(rule => {
    const hasRule = content.includes(rule);
    console.log(`     ${hasRule ? '✓' : '✗'} ${rule}`);
  });
} else {
  console.log('   ✗ .gitignore 不存在');
}

// 2. 检查应该被忽略的目录
console.log('\n2. 检查应该被忽略的目录:');
const shouldIgnore = [
  { name: 'node_modules/', exists: fs.existsSync('node_modules') },
  { name: 'dist/', exists: fs.existsSync('dist') },
];

shouldIgnore.forEach(item => {
  if (item.exists) {
    try {
      const result = execSync(`git check-ignore -v ${item.name}`, { encoding: 'utf8' });
      console.log(`   ✓ ${item.name} 已被 gitignore (${result.trim()})`);
    } catch (e) {
      console.log(`   ⚠ ${item.name} 存在但未被忽略`);
    }
  } else {
    console.log(`   - ${item.name} 不存在`);
  }
});

// 3. 检查测试生成的临时目录
console.log('\n3. 检查测试生成的临时目录:');
const tempDirs = [
  'claude/',
  'opencode/',
  '.relay/',
  'temp-test-skills/',
];

tempDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    try {
      const result = execSync(`git check-ignore -v ${dir}`, { encoding: 'utf8' });
      console.log(`   ✓ ${dir} 存在且已被忽略`);
    } catch (e) {
      console.log(`   ⚠ ${dir} 存在但未被忽略，建议清理`);
    }
  } else {
    console.log(`   ✓ ${dir} 不存在`);
  }
});

// 4. 检查 git status
console.log('\n4. 检查 git status:');
try {
  const status = execSync('git status --short', { encoding: 'utf8' });
  const lines = status.split('\n').filter(l => l.trim());
  
  console.log(`   未跟踪文件数: ${lines.length}`);
  
  // 检查是否有应该被忽略的文件出现在 status 中
  const problematicFiles = lines.filter(line => {
    const file = line.replace(/^\?\?\s*/, '').trim();
    return file.includes('node_modules') || 
           file.includes('dist') ||
           file.includes('claude') ||
           file.includes('opencode') ||
           file.includes('.relay') ||
           file.includes('temp');
  });
  
  if (problematicFiles.length > 0) {
    console.log('   ⚠ 以下文件应该被忽略但出现在 git status:');
    problematicFiles.forEach(f => console.log(`     ${f}`));
  } else {
    console.log('   ✓ 所有应该忽略的文件都已正确忽略');
  }
} catch (e) {
  console.log('   ⚠ 无法获取 git status');
}

// 5. 提供清理建议
console.log('\n5. 清理建议:');
const toClean = [];
tempDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    toClean.push(dir);
  }
});

if (toClean.length > 0) {
  console.log('   建议清理以下测试生成的目录:');
  toClean.forEach(dir => console.log(`     rm -rf ${dir}`));
} else {
  console.log('   ✓ 无需清理临时目录');
}

console.log('\n=== 验证完成 ===\n');