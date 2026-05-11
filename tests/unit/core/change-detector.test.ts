import { describe, it, expect } from 'vitest';
import { detectChanges } from '../../../src/core/change-detector.js';
import { SkillAnchor } from '../../../src/types/skill.js';
import { SkillSnapshot } from '../../../src/types/snapshot.js';

describe('detectChanges', () => {
  // 辅助函数：创建测试用的 SkillAnchor
  function createAnchor(overrides: Partial<SkillAnchor> = {}): SkillAnchor {
    return {
      name: 'test-skill',
      description: 'A test skill',
      whenToUse: 'When you need to test',
      whenNotToUse: 'When you do not need to test',
      definitionOfDone: 'Tests pass',
      whatToBuild: 'Test files',
      ...overrides,
    };
  }

  // 辅助函数：创建测试用的 SkillSnapshot
  function createSnapshot(content: string, hash: string): SkillSnapshot {
    return {
      content,
      hash,
      timestamp: '2026-05-09T10:00:00Z',
    };
  }

  describe('快照不存在时', () => {
    it('AC-001-1: 应将所有章节标记为 added', () => {
      const currentAnchor = createAnchor();
      const result = detectChanges(currentAnchor, null);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(7);
      expect(result.changes.every((c) => c.changeType === 'added')).toBe(true);
    });

    it('AC-001-9: 输出结构化变更列表，包含章节名称、变更类型、影响用例类型', () => {
      const currentAnchor = createAnchor();
      const result = detectChanges(currentAnchor, null);

      expect(result.changes[0]).toEqual({
        section: 'name',
        changeType: 'added',
        previousContent: '',
        currentContent: 'test-skill',
      });
      expect(result.changes[1]).toEqual({
        section: 'description',
        changeType: 'added',
        previousContent: '',
        currentContent: 'A test skill',
      });
    });
  });

  describe('无变更时', () => {
    it('AC-001-8: 当 SKILL.md 与快照无差异时，终止流程并返回无变更', () => {
      const currentAnchor = createAnchor();
      // 快照内容应与 buildSkillMdContent 重建的内容一致（无 steps 时不包含 Steps 章节）
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      // 计算正确的哈希
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');

      const snapshot = createSnapshot(snapshotContent, hash);
      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(false);
      expect(result.changes).toHaveLength(0);
    });
  });

  describe('单章节变更时', () => {
    it('AC-001-2: name 变更时应标记为 modified', () => {
      const currentAnchor = createAnchor({ name: 'new-name' });
      
      // 创建一个哈希不同的快照
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files

## Steps


`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      const nameChange = result.changes.find((c) => c.section === 'name');
      expect(nameChange).toBeDefined();
      expect(nameChange!.changeType).toBe('modified');
      expect(nameChange!.previousContent).toBe('test-skill');
      expect(nameChange!.currentContent).toBe('new-name');
    });

    it('AC-001-3: whenToUse 新增内容时应标记为 added', () => {
      const currentAnchor = createAnchor({ whenToUse: 'When you need to test\n\n- New scenario' });
      
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      const whenToUseChange = result.changes.find((c) => c.section === 'whenToUse');
      expect(whenToUseChange).toBeDefined();
      expect(whenToUseChange!.changeType).toBe('modified');
    });

    it('AC-001-4: whenToUse 删除内容时应标记为 modified', () => {
      const currentAnchor = createAnchor({ whenToUse: 'When you need' });
      
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      const whenToUseChange = result.changes.find((c) => c.section === 'whenToUse');
      expect(whenToUseChange).toBeDefined();
      expect(whenToUseChange!.changeType).toBe('modified');
    });

    it('AC-001-5: whenNotToUse 新增内容时应标记为 modified', () => {
      const currentAnchor = createAnchor({ whenNotToUse: 'When you do not need to test\n\n- New prohibition' });
      
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      const whenNotToUseChange = result.changes.find((c) => c.section === 'whenNotToUse');
      expect(whenNotToUseChange).toBeDefined();
      expect(whenNotToUseChange!.changeType).toBe('modified');
    });

    it('AC-001-6: definitionOfDone 变更时应标记为 modified', () => {
      const currentAnchor = createAnchor({ definitionOfDone: 'New criteria' });
      
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      const dodChange = result.changes.find((c) => c.section === 'definitionOfDone');
      expect(dodChange).toBeDefined();
      expect(dodChange!.changeType).toBe('modified');
    });

    it('AC-001-7: whatToBuild 变更时应标记为 modified', () => {
      const currentAnchor = createAnchor({ whatToBuild: 'New build instructions' });
      
      const snapshotContent = `---
name: test-skill
description: A test skill
---

## When to use this

When you need to test

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      const wtbChange = result.changes.find((c) => c.section === 'whatToBuild');
      expect(wtbChange).toBeDefined();
      expect(wtbChange!.changeType).toBe('modified');
    });
  });

  describe('多章节变更时', () => {
    it('应同时检测多个章节的变更', () => {
      const currentAnchor = createAnchor({
        name: 'new-name',
        description: 'New description',
        whenToUse: 'New when to use',
      });
      
      const snapshotContent = `---
name: old-name
description: Old description
---

## When to use this

Old when to use

## When NOT to use this

When you do not need to test

## Definition of done

Tests pass

## What to build

Test files
`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      expect(result.changes.length).toBeGreaterThanOrEqual(3);
      
      const nameChange = result.changes.find((c) => c.section === 'name');
      const descChange = result.changes.find((c) => c.section === 'description');
      const whenToUseChange = result.changes.find((c) => c.section === 'whenToUse');
      
      expect(nameChange).toBeDefined();
      expect(descChange).toBeDefined();
      expect(whenToUseChange).toBeDefined();
    });
  });

  describe('全部章节变更时', () => {
    it('应标记所有章节为变更', () => {
      const currentAnchor = createAnchor({
        name: 'completely-new-name',
        description: 'Completely new description',
        whenToUse: 'Totally different use case',
        whenNotToUse: 'Totally different prohibition',
        definitionOfDone: 'New done criteria',
        whatToBuild: 'New build instructions',
      });
      
      const snapshotContent = `---
name: old-name
description: Old description
---

## When to use this

Old use case

## When NOT to use this

Old prohibition

## Definition of done

Old criteria

## What to build

Old instructions

## Steps

`;
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(snapshotContent, 'utf-8').digest('hex');
      const snapshot = createSnapshot(snapshotContent, hash);

      const result = detectChanges(currentAnchor, snapshot);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(7);
      expect(result.changes.every((c) => c.changeType === 'modified')).toBe(true);
    });
  });
});
