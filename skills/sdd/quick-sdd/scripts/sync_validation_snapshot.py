#!/usr/bin/env python3
"""Sync the latest QA decision from validation-report.md into state.json."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from resolve_dispatch import ResolutionError


VALIDATION_SECTION_RE = re.compile(
    r"^##\s+(?P<title>[^\n]+)\n(?P<body>.*?)(?=^##\s+[^\n]+|\Z)", re.M | re.S
)
STORY_ID_PREFIX_RE = re.compile(r"^(ST-\d+)")
FIELD_SEPARATOR_RE = re.compile(r"[：:]")
FIELD_LABEL_ALIASES = {
    "status": ["status", "当前轮次状态"],
    "decision": ["decision", "裁决"],
    "root_cause_type": ["root_cause_type", "根因分类"],
    "reroute_to": ["reroute_to", "回流角色"],
    "reroute_action": ["reroute_action", "回流动作"],
    "summary": ["summary", "摘要"],
}


def normalize_scalar(value: Any) -> str:
    return str(value or "").strip().strip("`")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def file_time_iso(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(
        timespec="seconds"
    ).replace("+00:00", "Z")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(read_text(path))
    except FileNotFoundError as exc:
        raise ResolutionError("missing_state", str(path)) from exc
    except json.JSONDecodeError as exc:
        raise ResolutionError("invalid_state", str(exc)) from exc


def dump_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8-sig")


def line_matches_field(stripped: str, field_key: str) -> bool:
    aliases = FIELD_LABEL_ALIASES.get(field_key, [field_key])
    return any(alias in stripped for alias in aliases)


def extract_story_section_field(body: str, field_key: str) -> str:
    for raw_line in body.splitlines():
        stripped = raw_line.strip()
        if not stripped.startswith("- ") or not line_matches_field(stripped, field_key):
            continue
        parts = FIELD_SEPARATOR_RE.split(stripped, maxsplit=1)
        if len(parts) != 2:
            return ""
        return normalize_scalar(parts[1])
    return ""


def extract_story_section_multiline(body: str, field_key: str) -> str:
    lines = body.splitlines()
    for index, raw_line in enumerate(lines):
        stripped = raw_line.strip()
        if not stripped.startswith("- ") or not line_matches_field(stripped, field_key):
            continue
        items: list[str] = []
        cursor = index + 1
        while cursor < len(lines):
            current = lines[cursor]
            stripped = current.strip()
            if current.startswith("  - "):
                item = current[4:].strip()
                if item and item != "无":
                    items.append(item)
                cursor += 1
                continue
            if stripped.startswith("- ") or stripped.startswith("## "):
                break
            if stripped:
                break
            cursor += 1
        return " ".join(items)
    return ""


def available_validation_story_ids(validation_path: Path) -> list[str]:
    story_ids: list[str] = []
    for match in VALIDATION_SECTION_RE.finditer(read_text(validation_path)):
        title = match.group("title").strip()
        story_match = STORY_ID_PREFIX_RE.match(title)
        if story_match:
            story_ids.append(story_match.group(1))
    return story_ids


def parse_validation_report_story(validation_path: Path, story_id: str) -> dict[str, str]:
    if not validation_path.exists() or not story_id:
        return {}
    text = read_text(validation_path)
    for match in VALIDATION_SECTION_RE.finditer(text):
        title = match.group("title").strip()
        story_match = STORY_ID_PREFIX_RE.match(title)
        if not story_match or story_match.group(1) != story_id:
            continue
        body = match.group("body")
        reroute_action = extract_story_section_multiline(body, "reroute_action")
        if not reroute_action:
            reroute_action = extract_story_section_field(body, "reroute_action")
        summary = extract_story_section_multiline(body, "summary")
        if not summary:
            summary = extract_story_section_field(body, "summary")
        return {
            "status": extract_story_section_field(body, "status"),
            "decision": extract_story_section_field(body, "decision"),
            "root_cause_type": extract_story_section_field(body, "root_cause_type"),
            "reroute_to": extract_story_section_field(body, "reroute_to"),
            "reroute_action": reroute_action,
            "summary": summary,
        }
    return {}


def resolve_validation_report_path(
    repo_root: Path, state: dict[str, Any], override_path: str = ""
) -> Path | None:
    if override_path:
        candidate = repo_root / Path(override_path)
        if not candidate.exists():
            raise ResolutionError("missing_validation_report", str(candidate))
        return candidate
    latest = state.get("latest_validation", {}) or {}
    report_ref = normalize_scalar(latest.get("report_ref", ""))
    report_path = report_ref.split("#", 1)[0] if report_ref else ""
    if report_path:
        candidate = repo_root / Path(report_path)
        if candidate.exists():
            return candidate
    active_feature = normalize_scalar(state.get("active_feature", ""))
    if not active_feature:
        return None
    candidate = repo_root / "codespec" / "specs" / active_feature / "validation-report.md"
    if candidate.exists():
        return candidate
    return None


def resolve_target_story_id(
    validation_path: Path, state: dict[str, Any], requested_story: str = ""
) -> str:
    candidates = [
        normalize_scalar(requested_story),
        normalize_scalar((state.get("active_dispatch", {}) or {}).get("story", "")),
        normalize_scalar((state.get("latest_validation", {}) or {}).get("story", "")),
    ]
    available = available_validation_story_ids(validation_path)
    for candidate in candidates:
        if candidate and candidate in available:
            return candidate
    if len(available) == 1:
        return available[0]
    if len(available) > 1:
        raise ResolutionError(
            "missing_active_story",
            "validation-report.md 包含多个 story 段落，必须显式指定 story_id 或 active_dispatch.story。",
        )
    raise ResolutionError("validation_story_not_found", str(validation_path))


def build_report_ref(repo_root: Path, validation_path: Path, story_id: str) -> str:
    try:
        relative = validation_path.relative_to(repo_root).as_posix()
    except ValueError:
        relative = validation_path.as_posix()
    return f"{relative}#{story_id.lower()}"


def build_validation_summary(story_id: str, snapshot: dict[str, str]) -> str:
    summary = normalize_scalar(snapshot.get("summary", ""))
    if summary:
        return summary
    decision = normalize_scalar(snapshot.get("decision", ""))
    status = normalize_scalar(snapshot.get("status", ""))
    reroute_to = normalize_scalar(snapshot.get("reroute_to", ""))
    root_cause_type = normalize_scalar(snapshot.get("root_cause_type", ""))
    parts: list[str] = []
    if story_id and decision:
        parts.append(f"{story_id} 验证裁决为 {decision}")
    elif story_id and status:
        parts.append(f"{story_id} 当前轮次状态为 {status}")
    if root_cause_type and decision in {"fail", "conditional_pass"}:
        parts.append(f"根因为 {root_cause_type}")
    if reroute_to and decision in {"fail", "conditional_pass"}:
        parts.append(f"建议回流给 {reroute_to}")
    return "；".join(parts)


def build_validation_snapshot(
    repo_root: Path,
    state: dict[str, Any],
    validation_path: Path | None = None,
    target_story: str = "",
    target_task: str = "",
    updated_at: str = "",
) -> dict[str, str]:
    resolved_path = validation_path or resolve_validation_report_path(repo_root, state)
    if resolved_path is None or not resolved_path.exists():
        raise ResolutionError("missing_validation_report", str(validation_path or ""))
    story_id = resolve_target_story_id(resolved_path, state, requested_story=target_story)
    parsed = parse_validation_report_story(resolved_path, story_id)
    if not parsed:
        raise ResolutionError("validation_story_not_found", story_id)
    decision = normalize_scalar(parsed.get("decision", ""))
    if not decision:
        raise ResolutionError("missing_validation_decision", story_id)
    active_dispatch = state.get("active_dispatch", {}) or {}
    snapshot = {
        "story": story_id,
        "task": normalize_scalar(
            target_task
            or active_dispatch.get("task", "")
            or (state.get("latest_validation", {}) or {}).get("task", "")
        ),
        "status": normalize_scalar(parsed.get("status", "")),
        "decision": decision,
        "root_cause_type": normalize_scalar(parsed.get("root_cause_type", "")),
        "reroute_to": normalize_scalar(parsed.get("reroute_to", "")),
        "reroute_action": normalize_scalar(parsed.get("reroute_action", "")),
        "summary": "",
        "report_ref": build_report_ref(repo_root, resolved_path, story_id),
        "updated_at": normalize_scalar(updated_at) or file_time_iso(resolved_path),
    }
    snapshot["summary"] = build_validation_summary(story_id, {**parsed, **snapshot})
    return snapshot


def routing_requires_report_fallback(routing: dict[str, str]) -> bool:
    for key in ("status", "decision", "summary", "report_ref"):
        if not normalize_scalar(routing.get(key, "")):
            return True
    decision = normalize_scalar(routing.get("decision", ""))
    if decision in {"fail", "conditional_pass"}:
        for key in ("root_cause_type", "reroute_to", "reroute_action"):
            if not normalize_scalar(routing.get(key, "")):
                return True
    return False


def has_snapshot_signal(latest: dict[str, Any]) -> bool:
    fields = (
        "story",
        "task",
        "status",
        "decision",
        "root_cause_type",
        "reroute_to",
        "reroute_action",
        "summary",
        "report_ref",
        "updated_at",
    )
    return any(normalize_scalar(latest.get(field, "")) for field in fields)


def resolve_validation_routing(
    repo_root: Path,
    state: dict[str, Any],
    validation_path: Path | None = None,
    target_story: str = "",
    target_task: str = "",
) -> dict[str, str]:
    latest = state.get("latest_validation", {}) or {}
    routing = {
        "status": normalize_scalar(latest.get("status", "")),
        "decision": normalize_scalar(latest.get("decision", "")),
        "root_cause_type": normalize_scalar(latest.get("root_cause_type", "")),
        "reroute_to": normalize_scalar(latest.get("reroute_to", "")),
        "reroute_action": normalize_scalar(latest.get("reroute_action", "")),
        "summary": normalize_scalar(latest.get("summary", "")),
        "report_ref": normalize_scalar(latest.get("report_ref", "")),
        "updated_at": normalize_scalar(latest.get("updated_at", "")),
        "source": "state_snapshot" if has_snapshot_signal(latest) else "",
    }
    if not routing_requires_report_fallback(routing):
        return routing
    resolved_path = validation_path or resolve_validation_report_path(repo_root, state)
    if resolved_path is None:
        return routing
    resolved_story = normalize_scalar(target_story)
    if not resolved_story:
        try:
            resolved_story = resolve_target_story_id(resolved_path, state)
        except ResolutionError:
            return routing
    try:
        snapshot = build_validation_snapshot(
            repo_root=repo_root,
            state=state,
            validation_path=resolved_path,
            target_story=resolved_story,
            target_task=target_task,
            updated_at=routing.get("updated_at", ""),
        )
    except ResolutionError:
        return routing
    used_fallback = False
    for key in ("status", "decision", "root_cause_type", "reroute_to", "reroute_action", "summary", "report_ref"):
        if snapshot.get(key) and not routing.get(key):
            routing[key] = snapshot[key]
            used_fallback = True
    if not routing.get("updated_at"):
        routing["updated_at"] = snapshot["updated_at"]
        used_fallback = True
    if used_fallback:
        if routing["source"] == "state_snapshot":
            routing["source"] = "state_snapshot+validation_report_fallback"
        else:
            routing["source"] = "validation_report_fallback"
    return routing


def apply_snapshot(state_path: Path, state: dict[str, Any], snapshot: dict[str, str]) -> None:
    state["latest_validation"] = snapshot
    state["last_updated"] = snapshot["updated_at"]
    dump_json(state_path, state)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Sync the latest QA decision from validation-report.md into state.json."
    )
    parser.add_argument("--repo-root", required=True, help="项目根目录")
    parser.add_argument(
        "--state",
        default="codespec/runtime/state.json",
        help="相对项目根目录的 state.json 路径",
    )
    parser.add_argument(
        "--validation-report",
        default="",
        help="相对项目根目录的 validation-report.md 路径；为空时自动推断",
    )
    parser.add_argument("--story-id", default="", help="要同步的 story ID；为空时按 state 推断")
    parser.add_argument("--task-id", default="", help="要写入快照的 task ID；为空时按 state 推断")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="将快照写回 state.json",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    repo_root = Path(args.repo_root).resolve()
    if not repo_root.exists() or not repo_root.is_dir():
        print(
            json.dumps(
                {
                    "status": "BLOCKED",
                    "reason": "invalid_repo_root",
                    "details": str(repo_root),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    state_path = repo_root / args.state
    try:
        state = load_json(state_path)
        validation_path = resolve_validation_report_path(
            repo_root=repo_root,
            state=state,
            override_path=args.validation_report,
        )
        snapshot = build_validation_snapshot(
            repo_root=repo_root,
            state=state,
            validation_path=validation_path,
            target_story=args.story_id,
            target_task=args.task_id,
        )
        if args.apply:
            apply_snapshot(state_path, state, snapshot)
        payload = {
            "status": "DONE",
            "repo_root": str(repo_root),
            "validation_report": str(validation_path) if validation_path else "",
            "snapshot": snapshot,
            "applied": bool(args.apply),
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    except ResolutionError as exc:
        print(
            json.dumps(
                {
                    "status": "BLOCKED",
                    "reason": exc.reason,
                    "details": exc.details,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
