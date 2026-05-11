# Validation Report — FEAT-005-eval-sync

## Status

| Field | Value |
|-------|-------|
| **Decision** | `pass` |
| **Root Cause Type** | `implementation` (resolved) |
| **Reroute To** | — |
| **Reroute Action** | — |
| **Date** | 2026-05-11 |

---

## Summary

FEAT-005 (eval-sync) defect fix verified. The previously reported Defect #1 (snapshot written on no-change) has been resolved. All acceptance criteria are now met across all 8 stories.

The fix addressed two root causes:
1. **`change-detector.ts` — `buildSkillMdContent()`**: Now only appends the `## Steps` section when `anchor.steps` has actual content, preventing false hash mismatches when SKILL.md has no Steps section.
2. **`skill-parser.ts` — `steps` field extraction**: Added extraction of the `Steps` section from SKILL.md, ensuring the parsed `SkillAnchor.steps` field is populated for accurate content reconstruction and hash comparison.

---

## Evidence

| Category | Result |
|----------|--------|
| Unit tests (6 files) | 121/121 pass |
| Integration tests (3 files) | 44/44 pass (0 failures) |
| Total tests | 165/165 pass (100%) |

**Detailed test results:**

| Test File | Tests | Status | AC Coverage |
|-----------|-------|--------|-------------|
| `change-detector.test.ts` | 11/11 | Pass | AC-001-1, AC-001-8, AC-001-9 |
| `impact-mapper.test.ts` | 20/20 | Pass | AC-001-2 ~ AC-001-7 |
| `constraint-parser.test.ts` | 44/44 | Pass | AC-005-1 ~ AC-005-7 |
| `conflict-detector.test.ts` | 13/13 | Pass | AC-003-1, AC-003-2 |
| `case-deprecator.test.ts` | 14/14 | Pass | AC-004-1 ~ AC-004-5 |
| `constraint-applier.test.ts` | 19/19 | Pass | AC-006-1 ~ AC-006-9 |
| `sync-engine.test.ts` | 18/18 | Pass | AC-002-1 ~ AC-002-7, AC-003, AC-004 |
| `eval-sync.test.ts` | 18/18 | Pass | ST-002, ST-003, ST-007 |
| `eval-sync-batch.test.ts` | 8/8 | Pass | AC-008-1 ~ AC-008-6 |

**Key verification — AC-002-1 "无变更时直接返回，不修改任何文件":**

```
[eval-sync] 无变更，无需同步
✓ CSV file content unchanged
✓ Snapshot file content unchanged
✓ No backup directory created
✓ result.added = 0, result.modified = 0, result.deprecated = 0, result.conflicts = 0
```

---

## Defect Resolution

### Defect #1 — Snapshot written on no-change (RESOLVED)

| Field | Value |
|-------|-------|
| **Severity** | `important` → **Fixed** |
| **Impact** | AC-002-1 was violated: snapshot file modified when no SKILL.md changes detected |
| **Root Cause** | Two-part issue: (1) `buildSkillMdContent()` in `change-detector.ts` always appended an empty `## Steps` section, causing hash mismatch even when SKILL.md had no changes; (2) `skill-parser.ts` did not extract the `steps` field, so `SkillAnchor.steps` was always empty |
| **Fix Applied** | (1) `change-detector.ts` line 142-148: conditional `if (anchor.steps)` before appending Steps section; (2) `skill-parser.ts` line 38, 94, 115-116: added `steps` field extraction |
| **Verification** | `sync-engine.test.ts` AC-002-1 test passes; `sync-engine.ts` early return at line 86-89 correctly triggers with `hasChanges=false`, preventing all file writes |

---

## Acceptance Criteria Coverage

| Story | Status | Notes |
|-------|--------|-------|
| ST-001 (变更检测与影响映射) | **Pass** | AC-001-1 ~ AC-001-9 covered |
| ST-002 (增量用例同步) | **Pass** | AC-002-1 now passes; AC-002-2 ~ AC-002-7 pass |
| ST-003 (自定义用例保护与冲突) | **Pass** | AC-003-1 ~ AC-003-7 covered |
| ST-004 (用例停用与快照更新) | **Pass** | AC-004-1 ~ AC-004-5 covered |
| ST-005 (用户约束解析与分类) | **Pass** | AC-005-1 ~ AC-005-7 covered |
| ST-006 (约束驱动的 SKILL.md 更新) | **Pass** | AC-006-1 ~ AC-006-9 covered |
| ST-007 (全量覆盖同步与备份) | **Pass** | AC-007-1 ~ AC-007-6 covered |
| ST-008 (批量同步所有 Skill) | **Pass** | AC-008-1 ~ AC-008-6 covered |

---

## Architecture Consistency

- Incremental sync pipeline correctly implemented: change detection → impact mapping → conflict detection → case adjustment → backup → CSV write → snapshot update
- Cross-feature dependencies (FEAT-004 types) correctly referenced
- Command registration in `src/cli.ts` properly wires `eval-sync` command with `--override`, `--constraint`, and `--all` modes
- `buildSkillMdContent()` reconstruction logic matches the original SKILL.md format (including conditional Steps section)
- `parseSkillMdFromContent()` in `change-detector.ts` and `parseSkillMd()` in `skill-parser.ts` both correctly extract all 7 fields including `steps`

---

## Security & Risk Review

| Risk | Assessment |
|------|------------|
| Custom case protection | `custom=true` cases correctly skipped in all sync operations |
| Backup protection | Both eval-sync and constraint-applier create backups before modifications |
| Override confirmation | `--override` requires user confirmation before proceeding |
| Snapshot integrity | **Resolved**: snapshot is no longer modified when `hasChanges=false` |
| Hash consistency | **Resolved**: `buildSkillMdContent()` now produces content matching original SKILL.md format |

---

## Next Action

**Recommendation:** `pass` — ready for `done` status.

1. All 165 tests pass (100%)
2. Defect #1 is resolved with verified fix
3. No regressions detected in any related test files
4. All 8 stories' acceptance criteria are met
5. **PM can proceed to mark FEAT-005-eval-sync as `done`**
