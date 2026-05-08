#!/usr/bin/env python3
"""Resolve Quick SDD role scopes from state.json and tasks.md."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


class ResolutionError(Exception):
    """Raised when the dispatcher cannot resolve the requested scope."""

    def __init__(self, reason: str, details: str = "") -> None:
        super().__init__(reason)
        self.reason = reason
        self.details = details


def strip_yaml_comments(line: str) -> str:
    in_single = False
    in_double = False
    escaped = False
    for index, char in enumerate(line):
        if char == "\\" and not escaped:
            escaped = True
            continue
        if char == "'" and not in_double and not escaped:
            in_single = not in_single
        elif char == '"' and not in_single and not escaped:
            in_double = not in_double
        elif char == "#" and not in_single and not in_double:
            if index == 0 or line[index - 1].isspace():
                return line[:index].rstrip()
        escaped = False
    return line.rstrip()


def split_inline_items(content: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    in_single = False
    in_double = False
    for char in content:
        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double
        if char == "," and not in_single and not in_double:
            item = "".join(current).strip()
            if item:
                items.append(item)
            current = []
            continue
        current.append(char)
    item = "".join(current).strip()
    if item:
        items.append(item)
    return items


def parse_scalar(value: str) -> Any:
    value = value.strip()
    if value == "":
        return ""
    if value in {"null", "~"}:
        return None
    if value == "true":
        return True
    if value == "false":
        return False
    if value == "[]":
        return []
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [parse_scalar(item) for item in split_inline_items(inner)]
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    return value


def prepare_yaml_lines(text: str) -> list[tuple[int, str]]:
    prepared: list[tuple[int, str]] = []
    for raw in text.replace("\ufeff", "").splitlines():
        cleaned = strip_yaml_comments(raw)
        if not cleaned.strip():
            continue
        indent = len(cleaned) - len(cleaned.lstrip(" "))
        prepared.append((indent, cleaned.lstrip(" ")))
    return prepared


def parse_yaml(text: str) -> Any:
    lines = prepare_yaml_lines(text)
    if not lines:
        return {}
    node, index = parse_yaml_block(lines, 0, lines[0][0])
    if index != len(lines):
        raise ResolutionError("invalid_yaml", "unexpected trailing yaml content")
    return node


def parse_yaml_block(
    lines: list[tuple[int, str]], start: int, indent: int
) -> tuple[Any, int]:
    if lines[start][1].startswith("- "):
        return parse_yaml_list(lines, start, indent)
    return parse_yaml_map(lines, start, indent)


def parse_yaml_map(
    lines: list[tuple[int, str]], start: int, indent: int
) -> tuple[dict[str, Any], int]:
    mapping: dict[str, Any] = {}
    index = start
    while index < len(lines):
        current_indent, content = lines[index]
        if current_indent < indent:
            break
        if current_indent > indent:
            raise ResolutionError(
                "invalid_yaml", f"unexpected nested mapping at line index {index}"
            )
        if content.startswith("- "):
            break
        if ":" not in content:
            raise ResolutionError("invalid_yaml", f"missing ':' in '{content}'")
        key, rest = content.split(":", 1)
        key = key.strip()
        rest = rest.strip()
        index += 1
        if rest:
            mapping[key] = parse_scalar(rest)
            continue
        if index < len(lines) and lines[index][0] > indent:
            child_indent = lines[index][0]
            value, index = parse_yaml_block(lines, index, child_indent)
            mapping[key] = value
        else:
            mapping[key] = None
    return mapping, index


def parse_yaml_list(
    lines: list[tuple[int, str]], start: int, indent: int
) -> tuple[list[Any], int]:
    items: list[Any] = []
    index = start
    while index < len(lines):
        current_indent, content = lines[index]
        if current_indent < indent:
            break
        if current_indent != indent or not content.startswith("- "):
            break
        body = content[2:].strip()
        index += 1
        if not body:
            if index < len(lines) and lines[index][0] > indent:
                child_indent = lines[index][0]
                value, index = parse_yaml_block(lines, index, child_indent)
                items.append(value)
            else:
                items.append(None)
            continue
        if ":" in body:
            key, rest = body.split(":", 1)
            item: dict[str, Any] = {}
            key = key.strip()
            rest = rest.strip()
            if rest:
                item[key] = parse_scalar(rest)
            elif index < len(lines) and lines[index][0] > indent:
                child_indent = lines[index][0]
                value, index = parse_yaml_block(lines, index, child_indent)
                item[key] = value
            else:
                item[key] = None
            if index < len(lines) and lines[index][0] > indent:
                child_indent = lines[index][0]
                extra, index = parse_yaml_block(lines, index, child_indent)
                if not isinstance(extra, dict):
                    raise ResolutionError(
                        "invalid_yaml", "list item continuation must be a mapping"
                    )
                item.update(extra)
            items.append(item)
            continue
        items.append(parse_scalar(body))
    return items, index


TASK_SECTION_RE = re.compile(r"^##\s+T-[^\n]*\n(?P<body>.*?)(?=^##\s+T-|\Z)", re.M | re.S)
YAML_FENCE_RE = re.compile(r"```yaml\s*\n(?P<yaml>.*?)\n```", re.S)


def parse_tasks_markdown(tasks_path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    if not tasks_path.exists():
        raise ResolutionError("missing_tasks_file", str(tasks_path))
    text = tasks_path.read_text(encoding="utf-8-sig")
    tasks_by_id: dict[str, dict[str, Any]] = {}
    tasks_by_story: dict[str, list[dict[str, Any]]] = {}
    for match in TASK_SECTION_RE.finditer(text):
        fence_match = YAML_FENCE_RE.search(match.group("body"))
        if not fence_match:
            continue
        task = parse_yaml(fence_match.group("yaml"))
        if not isinstance(task, dict):
            raise ResolutionError("invalid_task_yaml", "task yaml block must be a mapping")
        task_id = str(task.get("id", "")).strip()
        story_id = str(task.get("story_id", "")).strip()
        if not task_id:
            raise ResolutionError("task_field_missing:id", str(tasks_path))
        if task_id in tasks_by_id:
            raise ResolutionError(f"duplicate_task_id:{task_id}", str(tasks_path))
        for required in ("story_id", "read_paths", "write_paths"):
            if required not in task:
                raise ResolutionError(f"task_field_missing:{required}", task_id)
        if not isinstance(task["read_paths"], list) or not isinstance(task["write_paths"], list):
            raise ResolutionError("invalid_task_acl", task_id)
        tasks_by_id[task_id] = task
        tasks_by_story.setdefault(story_id, []).append(task)
    return tasks_by_id, tasks_by_story


def get_by_path(data: dict[str, Any], dotted_path: str) -> Any:
    current: Any = data
    for part in dotted_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return ""
        current = current[part]
    return current


def is_empty(value: Any) -> bool:
    return value in ("", None, [])


def stable_unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        if value in seen or value in {"", None}:
            continue
        seen.add(value)
        unique.append(value)
    return sorted(unique)


class ResolverEngine:
    def __init__(self, repo_root: Path, role_policy: dict[str, Any], state: dict[str, Any]) -> None:
        self.repo_root = repo_root
        self.role_policy = role_policy
        self.state = state
        latest_validation = state.get("latest_validation", {}) or {}
        self.context: dict[str, Any] = {
            "active_feature": str(state.get("active_feature", "") or ""),
            "active_phase": str(state.get("active_phase", "") or ""),
            "active_role": str(get_by_path(state, "active_dispatch.role") or ""),
            "active_story": str(get_by_path(state, "active_dispatch.story") or ""),
            "active_task": str(get_by_path(state, "active_dispatch.task") or ""),
            "validation_story": str(latest_validation.get("story", "") or ""),
            "validation_task": str(latest_validation.get("task", "") or ""),
            "validation_status": str(latest_validation.get("status", "") or ""),
            "validation_decision": str(latest_validation.get("decision", "") or ""),
            "validation_summary": str(latest_validation.get("summary", "") or ""),
            "validation_report_ref": str(latest_validation.get("report_ref", "") or ""),
            "validation_updated_at": str(latest_validation.get("updated_at", "") or ""),
        }
        self.scope_resolution = role_policy.get("scope_resolution", {}) or {}
        self.cache: dict[str, Any] = {}
        self.task_cache: dict[str, tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]] = {}

    def resolve_role_scope(self, target_role: str, mode: str) -> dict[str, Any]:
        roles = self.role_policy.get("roles", {}) or {}
        if target_role not in roles:
            raise ResolutionError("invalid_role", target_role)
        if mode not in {"read", "write"}:
            raise ResolutionError("invalid_mode", mode)
        entries = roles[target_role].get(mode)
        if not isinstance(entries, list):
            raise ResolutionError("invalid_role_policy", f"{target_role}.{mode} must be a list")
        resolved: list[str] = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise ResolutionError("invalid_role_policy", f"invalid scope entry for {target_role}.{mode}")
            if "literal" in entry:
                resolved.append(self.interpolate(str(entry["literal"])))
                continue
            if "resolver" in entry:
                value = self.resolve_scope(str(entry["resolver"]), set())
                if isinstance(value, list):
                    resolved.extend(str(item) for item in value if item not in {"", None})
                elif value not in {"", None}:
                    resolved.append(str(value))
                continue
            raise ResolutionError("invalid_role_policy", f"unknown scope entry for {target_role}.{mode}")
        latest_validation_hint = self.build_latest_validation_hint()
        return {
            "status": "DONE",
            "role": target_role,
            "mode": mode,
            "feature_id": self.resolve_reference("active_feature"),
            "phase": self.context["active_phase"],
            "story_id": self.resolve_reference("active_story"),
            "task_id": self.resolve_reference("active_task"),
            "resolved_paths": stable_unique(resolved),
            "latest_validation_hint": latest_validation_hint,
        }

    def resolve_reference(self, name: str) -> Any:
        if name in self.scope_resolution:
            return self.resolve_scope(name, set())
        return self.context.get(name, "")

    def resolve_scope(self, name: str, resolving: set[str]) -> Any:
        if name in self.cache:
            return self.cache[name]
        if name not in self.scope_resolution:
            raise ResolutionError("missing_resolver", name)
        if name in resolving:
            raise ResolutionError("resolver_cycle", name)
        resolving.add(name)
        try:
            definition = self.scope_resolution[name]
            result = self.execute_definition(definition, resolving)
            if is_empty(result) and "fallback" in definition:
                result = self.execute_definition(definition["fallback"], resolving)
            self.cache[name] = result
            return result
        finally:
            resolving.remove(name)

    def execute_definition(self, definition: dict[str, Any], resolving: set[str]) -> Any:
        kind = definition.get("kind")
        if kind == "state_field":
            path = str(definition.get("path", "")).strip()
            if not path:
                raise ResolutionError("invalid_role_policy", "state_field missing path")
            value = get_by_path(self.state, path)
            return "" if value is None else value
        if kind == "task_field":
            feature_id = str(self.resolve_ref_field(definition, "feature_ref", resolving))
            task_id = str(self.resolve_ref_field(definition, "task_ref", resolving))
            field = str(definition.get("field", "")).strip()
            if not feature_id:
                raise ResolutionError("missing_active_feature", "task_field requires active feature")
            if not task_id:
                raise ResolutionError("missing_active_task", "task_field requires active task")
            tasks_by_id, _ = self.load_feature_tasks(feature_id)
            if task_id not in tasks_by_id:
                raise ResolutionError("missing_task", task_id)
            task = tasks_by_id[task_id]
            if field not in task:
                raise ResolutionError(f"task_field_missing:{field}", task_id)
            return task[field]
        if kind == "story_task_union":
            feature_id = str(self.resolve_ref_field(definition, "feature_ref", resolving))
            story_id = str(self.resolve_ref_field(definition, "story_ref", resolving))
            field = str(definition.get("field", "")).strip()
            if not feature_id:
                raise ResolutionError("missing_active_feature", "story_task_union requires active feature")
            if not story_id:
                raise ResolutionError("missing_active_story", "story_task_union requires active story")
            _, tasks_by_story = self.load_feature_tasks(feature_id)
            tasks = tasks_by_story.get(story_id, [])
            values: list[str] = []
            for task in tasks:
                if field not in task:
                    raise ResolutionError(f"task_field_missing:{field}", story_id)
                current = task[field]
                if isinstance(current, list):
                    values.extend(str(item) for item in current if item not in {"", None})
                elif current not in {"", None}:
                    values.append(str(current))
            return stable_unique(values)
        raise ResolutionError("invalid_role_policy", f"unsupported resolver kind: {kind}")

    def resolve_ref_field(self, definition: dict[str, Any], key: str, resolving: set[str]) -> Any:
        ref_name = str(definition.get(key, "")).strip()
        if not ref_name:
            raise ResolutionError("invalid_role_policy", f"resolver missing {key}")
        if ref_name in self.scope_resolution:
            return self.resolve_scope(ref_name, resolving)
        return self.context.get(ref_name, "")

    def interpolate(self, template: str) -> str:
        def replace(match: re.Match[str]) -> str:
            name = match.group(1)
            value = self.resolve_reference(name)
            if is_empty(value):
                raise ResolutionError("missing_interpolation_value", name)
            if isinstance(value, list):
                raise ResolutionError("invalid_interpolation_value", name)
            return str(value)

        return re.sub(r"\$\{([^}]+)\}", replace, template)

    def load_feature_tasks(
        self, feature_id: str
    ) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
        if feature_id in self.task_cache:
            return self.task_cache[feature_id]
        tasks_path = self.repo_root / "codespec" / "specs" / feature_id / "tasks.md"
        parsed = parse_tasks_markdown(tasks_path)
        self.task_cache[feature_id] = parsed
        return parsed

    def build_latest_validation_hint(self) -> dict[str, Any]:
        decision = self.context["validation_decision"]
        root_cause_type = str(self.state.get("latest_validation", {}).get("root_cause_type", "") or "")
        reroute_to = str(self.state.get("latest_validation", {}).get("reroute_to", "") or "")
        reroute_action = str(self.state.get("latest_validation", {}).get("reroute_action", "") or "")
        story_matches = not self.context["validation_story"] or (
            self.context["validation_story"] == self.resolve_reference("active_story")
        )
        task_matches = not self.context["validation_task"] or (
            self.context["validation_task"] == self.resolve_reference("active_task")
        )
        usable = bool(
            decision
            and self.context["active_feature"]
            and story_matches
            and task_matches
        )
        preferred_next_role = ""
        preferred_resume_mode = ""
        if usable:
            if decision == "fail":
                preferred_next_role = "dev"
                preferred_resume_mode = "repair"
            elif decision == "conditional_pass":
                preferred_next_role = "pm"
                preferred_resume_mode = "validate"
            elif decision == "pass":
                preferred_next_role = "pm"
                preferred_resume_mode = "continue"
        return {
            "usable": usable,
            "status": self.context["validation_status"],
            "decision": decision,
            "root_cause_type": root_cause_type,
            "reroute_to": reroute_to,
            "reroute_action": reroute_action,
            "summary": self.context["validation_summary"],
            "report_ref": self.context["validation_report_ref"],
            "updated_at": self.context["validation_updated_at"],
            "source": "state_snapshot" if decision else "",
            "preferred_next_role": preferred_next_role,
            "preferred_resume_mode": preferred_resume_mode,
        }


def load_role_policy(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ResolutionError("missing_role_policy", str(path))
    data = parse_yaml(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ResolutionError("invalid_role_policy", str(path))
    return data


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ResolutionError("missing_state", str(path))
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ResolutionError("invalid_state", str(exc)) from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Resolve Quick SDD role scopes from state.json and tasks.md."
    )
    parser.add_argument("--repo-root", required=True, help="Project repository root")
    parser.add_argument("--target-role", required=True, help="Role to resolve, e.g. dev")
    parser.add_argument("--mode", required=True, choices=["read", "write"], help="Access mode")
    parser.add_argument(
        "--role-policy",
        default="codespec/runtime/role-policy.yaml",
        help="Relative path to role-policy.yaml from repo root",
    )
    parser.add_argument(
        "--state",
        default="codespec/runtime/state.json",
        help="Relative path to state.json from repo root",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    repo_root = Path(args.repo_root).resolve()
    role_policy_path = repo_root / args.role_policy
    state_path = repo_root / args.state
    try:
        role_policy = load_role_policy(role_policy_path)
        state = load_state(state_path)
        engine = ResolverEngine(repo_root=repo_root, role_policy=role_policy, state=state)
        result = engine.resolve_role_scope(args.target_role, args.mode)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except ResolutionError as exc:
        payload = {
            "status": "BLOCKED",
            "reason": exc.reason,
            "details": exc.details,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
