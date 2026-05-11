import { SectionChange } from '../types/change.js';
import { CaseImpact, CaseType, ImpactAction, ImpactMappingResult } from '../types/impact.js';

/**
 * 将章节变更映射到受影响的用例类型和处理动作
 *
 * 实现 6 条核心映射规则:
 * 1. name/description 变更 -> 所有显式用例 update
 * 2. whenToUse 新增 -> 新增隐式/上下文用例 add
 * 3. whenToUse 删除 -> 对应场景用例 deprecate
 * 4. whenNotToUse 新增 -> 新增负例用例 add
 * 5. definitionOfDone 变更 -> 所有正向用例 update (pass_criteria)
 * 6. whatToBuild 变更 -> 相关用例 update (pass_criteria + prompt)
 *
 * @param changes - 章节变更列表（来自 change-detector）
 * @returns 影响映射结果，供同步引擎消费
 */
export function mapChangesToImpacts(changes: SectionChange[]): ImpactMappingResult {
  const impacts: CaseImpact[] = [];

  for (const change of changes) {
    const sectionImpacts = mapSectionChange(change);
    impacts.push(...sectionImpacts);
  }

  return { impacts };
}

/**
 * 映射单个章节变更到用例影响
 */
function mapSectionChange(change: SectionChange): CaseImpact[] {
  const impacts: CaseImpact[] = [];

  switch (change.section) {
    case 'name':
    case 'description':
      // 规则1: name/description 变更 -> 所有显式用例 update
      impacts.push(makeImpact('explicit', 'update', change));
      break;

    case 'whenToUse':
      impacts.push(...mapWhenToUseChange(change));
      break;

    case 'whenNotToUse':
      impacts.push(...mapWhenNotToUseChange(change));
      break;

    case 'definitionOfDone':
      // 规则5: definitionOfDone 变更 -> 所有正向用例 update (pass_criteria)
      // 正向用例包括: explicit, implicit, context
      impacts.push(makeImpact('explicit', 'update', change, 'pass_criteria'));
      impacts.push(makeImpact('implicit', 'update', change, 'pass_criteria'));
      impacts.push(makeImpact('context', 'update', change, 'pass_criteria'));
      break;

    case 'whatToBuild':
      // 规则6: whatToBuild 变更 -> 相关用例 update (pass_criteria + prompt)
      impacts.push(makeImpact('explicit', 'update', change, 'pass_criteria + prompt'));
      impacts.push(makeImpact('implicit', 'update', change, 'pass_criteria + prompt'));
      impacts.push(makeImpact('context', 'update', change, 'pass_criteria + prompt'));
      break;
  }

  return impacts;
}

/**
 * 映射 whenToUse 章节变更
 * - 新增 -> 隐式/上下文用例 add
 * - 删除 -> 隐式/上下文用例 deprecate
 * - 修改 -> 隐式/上下文用例 update
 */
function mapWhenToUseChange(change: SectionChange): CaseImpact[] {
  const impacts: CaseImpact[] = [];
  const affectedTypes: CaseType[] = ['implicit', 'context'];

  switch (change.changeType) {
    case 'added':
      // 规则2: whenToUse 新增 -> 新增隐式/上下文用例 add
      for (const caseType of affectedTypes) {
        impacts.push(makeImpact(caseType, 'add', change));
      }
      break;

    case 'removed':
      // 规则3: whenToUse 删除 -> 对应场景用例 deprecate
      for (const caseType of affectedTypes) {
        impacts.push(makeImpact(caseType, 'deprecate', change));
      }
      break;

    case 'modified':
      // 修改时，隐式和上下文用例需要更新
      for (const caseType of affectedTypes) {
        impacts.push(makeImpact(caseType, 'update', change));
      }
      break;
  }

  return impacts;
}

/**
 * 映射 whenNotToUse 章节变更
 * - 新增 -> 负例用例 add
 * - 删除 -> 负例用例 deprecate
 * - 修改 -> 负例用例 update
 */
function mapWhenNotToUseChange(change: SectionChange): CaseImpact[] {
  const impacts: CaseImpact[] = [];

  switch (change.changeType) {
    case 'added':
      // 规则4: whenNotToUse 新增 -> 新增负例用例 add
      impacts.push(makeImpact('negative', 'add', change));
      break;

    case 'removed':
      // whenNotToUse 删除 -> 负例用例 deprecate
      impacts.push(makeImpact('negative', 'deprecate', change));
      break;

    case 'modified':
      // 修改时，负例用例需要更新
      impacts.push(makeImpact('negative', 'update', change));
      break;
  }

  return impacts;
}

/**
 * 创建单个 CaseImpact 记录
 *
 * @param caseType - 受影响的用例类型
 * @param action - 影响动作
 * @param change - 原始章节变更
 * @param scope - 影响范围说明（可选，如 'pass_criteria'、'pass_criteria + prompt'）
 */
function makeImpact(
  caseType: CaseType,
  action: ImpactAction,
  change: SectionChange,
  scope?: string
): CaseImpact {
  const scopeText = scope ? `（${scope}）` : '';
  const actionText = getActionText(action);
  const caseTypeText = getCaseTypeText(caseType);

  return {
    affectedCaseType: caseType,
    action,
    reason: `章节「${change.section}」${getChangeTypeText(change.changeType)}，${caseTypeText}需${actionText}${scopeText}`,
    relatedSection: change.section,
  };
}

/**
 * 将 ImpactAction 转换为中文描述
 */
function getActionText(action: ImpactAction): string {
  const map: Record<ImpactAction, string> = {
    add: '新增',
    update: '更新',
    deprecate: '停用',
  };
  return map[action];
}

/**
 * 将 CaseType 转换为中文描述
 */
function getCaseTypeText(caseType: CaseType): string {
  const map: Record<CaseType, string> = {
    explicit: '显式用例',
    implicit: '隐式用例',
    context: '上下文用例',
    negative: '负例用例',
  };
  return map[caseType];
}

/**
 * 将 ChangeType 转换为中文描述
 */
function getChangeTypeText(changeType: SectionChange['changeType']): string {
  const map: Record<SectionChange['changeType'], string> = {
    added: '新增',
    modified: '修改',
    removed: '删除',
  };
  return map[changeType];
}
