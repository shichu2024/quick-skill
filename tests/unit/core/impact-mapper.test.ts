import { describe, it, expect } from 'vitest';
import { mapChangesToImpacts } from '../../../src/core/impact-mapper.js';
import { SectionChange } from '../../../src/types/change.js';

describe('mapChangesToImpacts', () => {
  // 辅助函数：创建 SectionChange 测试数据
  function makeChange(
    section: SectionChange['section'],
    changeType: SectionChange['changeType'],
    previousContent = '',
    currentContent = ''
  ): SectionChange {
    return {
      section,
      changeType,
      previousContent,
      currentContent,
    };
  }

  // ============================================================
  // 规则 1: name/description 变更 -> 所有显式用例 update
  // ============================================================
  describe('规则1: name/description 变更', () => {
    it('AC-001-2: name 变更时应标记显式用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('name', 'modified', 'old-name', 'new-name'),
      ];

      const result = mapChangesToImpacts(changes);

      const explicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'explicit' && i.action === 'update'
      );
      expect(explicitUpdate).toBeDefined();
      expect(explicitUpdate!.relatedSection).toBe('name');
    });

    it('AC-001-2: description 变更时应标记显式用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('description', 'modified', 'old desc', 'new desc'),
      ];

      const result = mapChangesToImpacts(changes);

      const explicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'explicit' && i.action === 'update'
      );
      expect(explicitUpdate).toBeDefined();
      expect(explicitUpdate!.relatedSection).toBe('description');
    });

    it('name 和 description 同时变更时只产生一条显式用例 update', () => {
      const changes: SectionChange[] = [
        makeChange('name', 'modified', 'old-name', 'new-name'),
        makeChange('description', 'modified', 'old desc', 'new desc'),
      ];

      const result = mapChangesToImpacts(changes);

      const explicitUpdates = result.impacts.filter(
        (i) => i.affectedCaseType === 'explicit' && i.action === 'update'
      );
      expect(explicitUpdates).toHaveLength(2);
    });
  });

  // ============================================================
  // 规则 2: whenToUse 新增 -> 新增隐式/上下文用例 add
  // ============================================================
  describe('规则2: whenToUse 新增', () => {
    it('AC-001-3: whenToUse 新增时应标记隐式用例为 add', () => {
      const changes: SectionChange[] = [
        makeChange('whenToUse', 'added', '', 'New scenario A'),
      ];

      const result = mapChangesToImpacts(changes);

      const implicitAdd = result.impacts.find(
        (i) => i.affectedCaseType === 'implicit' && i.action === 'add'
      );
      expect(implicitAdd).toBeDefined();
      expect(implicitAdd!.relatedSection).toBe('whenToUse');
    });

    it('AC-001-3: whenToUse 新增时应标记上下文用例为 add', () => {
      const changes: SectionChange[] = [
        makeChange('whenToUse', 'added', '', 'New scenario A'),
      ];

      const result = mapChangesToImpacts(changes);

      const contextAdd = result.impacts.find(
        (i) => i.affectedCaseType === 'context' && i.action === 'add'
      );
      expect(contextAdd).toBeDefined();
      expect(contextAdd!.relatedSection).toBe('whenToUse');
    });
  });

  // ============================================================
  // 规则 3: whenToUse 删除 -> 对应场景用例 deprecate
  // ============================================================
  describe('规则3: whenToUse 删除', () => {
    it('AC-001-4: whenToUse 删除时应标记隐式用例为 deprecate', () => {
      const changes: SectionChange[] = [
        makeChange('whenToUse', 'removed', 'Old scenario', ''),
      ];

      const result = mapChangesToImpacts(changes);

      const implicitDeprecate = result.impacts.find(
        (i) => i.affectedCaseType === 'implicit' && i.action === 'deprecate'
      );
      expect(implicitDeprecate).toBeDefined();
      expect(implicitDeprecate!.relatedSection).toBe('whenToUse');
    });

    it('AC-001-4: whenToUse 删除时应标记上下文用例为 deprecate', () => {
      const changes: SectionChange[] = [
        makeChange('whenToUse', 'removed', 'Old scenario', ''),
      ];

      const result = mapChangesToImpacts(changes);

      const contextDeprecate = result.impacts.find(
        (i) => i.affectedCaseType === 'context' && i.action === 'deprecate'
      );
      expect(contextDeprecate).toBeDefined();
      expect(contextDeprecate!.relatedSection).toBe('whenToUse');
    });
  });

  // ============================================================
  // 规则 4: whenNotToUse 新增 -> 新增负例用例 add
  // ============================================================
  describe('规则4: whenNotToUse 新增', () => {
    it('AC-001-5: whenNotToUse 新增时应标记负例用例为 add', () => {
      const changes: SectionChange[] = [
        makeChange('whenNotToUse', 'added', '', 'New prohibition'),
      ];

      const result = mapChangesToImpacts(changes);

      const negativeAdd = result.impacts.find(
        (i) => i.affectedCaseType === 'negative' && i.action === 'add'
      );
      expect(negativeAdd).toBeDefined();
      expect(negativeAdd!.relatedSection).toBe('whenNotToUse');
    });
  });

  // ============================================================
  // 规则 5: definitionOfDone 变更 -> 所有正向用例 update
  // ============================================================
  describe('规则5: definitionOfDone 变更', () => {
    it('AC-001-6: definitionOfDone 变更时应标记显式用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('definitionOfDone', 'modified', 'old criteria', 'new criteria'),
      ];

      const result = mapChangesToImpacts(changes);

      const explicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'explicit' && i.action === 'update'
      );
      expect(explicitUpdate).toBeDefined();
      expect(explicitUpdate!.relatedSection).toBe('definitionOfDone');
    });

    it('AC-001-6: definitionOfDone 变更时应标记隐式用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('definitionOfDone', 'modified', 'old criteria', 'new criteria'),
      ];

      const result = mapChangesToImpacts(changes);

      const implicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'implicit' && i.action === 'update'
      );
      expect(implicitUpdate).toBeDefined();
      expect(implicitUpdate!.relatedSection).toBe('definitionOfDone');
    });

    it('AC-001-6: definitionOfDone 变更时应标记上下文用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('definitionOfDone', 'modified', 'old criteria', 'new criteria'),
      ];

      const result = mapChangesToImpacts(changes);

      const contextUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'context' && i.action === 'update'
      );
      expect(contextUpdate).toBeDefined();
      expect(contextUpdate!.relatedSection).toBe('definitionOfDone');
    });
  });

  // ============================================================
  // 规则 6: whatToBuild 变更 -> 相关用例 update
  // ============================================================
  describe('规则6: whatToBuild 变更', () => {
    it('AC-001-7: whatToBuild 变更时应标记显式用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('whatToBuild', 'modified', 'old instructions', 'new instructions'),
      ];

      const result = mapChangesToImpacts(changes);

      const explicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'explicit' && i.action === 'update'
      );
      expect(explicitUpdate).toBeDefined();
      expect(explicitUpdate!.relatedSection).toBe('whatToBuild');
    });

    it('AC-001-7: whatToBuild 变更时应标记隐式用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('whatToBuild', 'modified', 'old instructions', 'new instructions'),
      ];

      const result = mapChangesToImpacts(changes);

      const implicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'implicit' && i.action === 'update'
      );
      expect(implicitUpdate).toBeDefined();
      expect(implicitUpdate!.relatedSection).toBe('whatToBuild');
    });

    it('AC-001-7: whatToBuild 变更时应标记上下文用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('whatToBuild', 'modified', 'old instructions', 'new instructions'),
      ];

      const result = mapChangesToImpacts(changes);

      const contextUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'context' && i.action === 'update'
      );
      expect(contextUpdate).toBeDefined();
      expect(contextUpdate!.relatedSection).toBe('whatToBuild');
    });
  });

  // ============================================================
  // 综合场景
  // ============================================================
  describe('综合场景', () => {
    it('多章节同时变更时应合并所有影响', () => {
      const changes: SectionChange[] = [
        makeChange('name', 'modified', 'old', 'new'),
        makeChange('whenToUse', 'added', '', 'New scenario'),
        makeChange('whenNotToUse', 'added', '', 'New prohibition'),
      ];

      const result = mapChangesToImpacts(changes);

      // name 变更 -> explicit update
      expect(
        result.impacts.some(
          (i) => i.affectedCaseType === 'explicit' && i.action === 'update' && i.relatedSection === 'name'
        )
      ).toBe(true);
      // whenToUse 新增 -> implicit/context add
      expect(
        result.impacts.some(
          (i) => i.affectedCaseType === 'implicit' && i.action === 'add' && i.relatedSection === 'whenToUse'
        )
      ).toBe(true);
      expect(
        result.impacts.some(
          (i) => i.affectedCaseType === 'context' && i.action === 'add' && i.relatedSection === 'whenToUse'
        )
      ).toBe(true);
      // whenNotToUse 新增 -> negative add
      expect(
        result.impacts.some(
          (i) => i.affectedCaseType === 'negative' && i.action === 'add' && i.relatedSection === 'whenNotToUse'
        )
      ).toBe(true);
    });

    it('空变更列表应返回空影响', () => {
      const result = mapChangesToImpacts([]);

      expect(result.impacts).toHaveLength(0);
    });

    it('whenToUse modified 应同时触发 update 和 deprecate 之外的逻辑', () => {
      // modified 类型的 whenToUse 变更意味着内容被修改
      // 按照映射规则，modified 的 whenToUse 应触发正向用例的 update
      const changes: SectionChange[] = [
        makeChange('whenToUse', 'modified', 'old scenario', 'new scenario'),
      ];

      const result = mapChangesToImpacts(changes);

      // modified 场景下，隐式和上下文用例需要更新
      const implicitUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'implicit' && i.action === 'update'
      );
      expect(implicitUpdate).toBeDefined();

      const contextUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'context' && i.action === 'update'
      );
      expect(contextUpdate).toBeDefined();
    });

    it('whenNotToUse removed 应标记负例用例为 deprecate', () => {
      const changes: SectionChange[] = [
        makeChange('whenNotToUse', 'removed', 'Old prohibition', ''),
      ];

      const result = mapChangesToImpacts(changes);

      const negativeDeprecate = result.impacts.find(
        (i) => i.affectedCaseType === 'negative' && i.action === 'deprecate'
      );
      expect(negativeDeprecate).toBeDefined();
      expect(negativeDeprecate!.relatedSection).toBe('whenNotToUse');
    });

    it('whenNotToUse modified 应标记负例用例为 update', () => {
      const changes: SectionChange[] = [
        makeChange('whenNotToUse', 'modified', 'old prohibition', 'new prohibition'),
      ];

      const result = mapChangesToImpacts(changes);

      const negativeUpdate = result.impacts.find(
        (i) => i.affectedCaseType === 'negative' && i.action === 'update'
      );
      expect(negativeUpdate).toBeDefined();
      expect(negativeUpdate!.relatedSection).toBe('whenNotToUse');
    });

    it('每条影响都应包含 reason 字段', () => {
      const changes: SectionChange[] = [
        makeChange('name', 'modified', 'old', 'new'),
        makeChange('definitionOfDone', 'modified', 'old', 'new'),
      ];

      const result = mapChangesToImpacts(changes);

      expect(result.impacts.every((i) => i.reason.length > 0)).toBe(true);
    });
  });
});
