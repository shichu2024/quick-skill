#!/usr/bin/env python3
"""Initialize a Quick SDD workspace and optionally scaffold a feature."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PLACEHOLDER_RE = re.compile(r"\{\{([a-zA-Z0-9_]+)\}\}")
FEATURE_DIR_RE = re.compile(r"^FEAT-(\d+)(?:-.+)?$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8-sig", newline="\n")


def render_template(content: str, values: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, match.group(0))

    return PLACEHOLDER_RE.sub(replace, content)


def slugify(value: str) -> str:
    slug_chars: list[str] = []
    last_dash = False
    for char in value.strip().lower():
        if char.isalnum():
            slug_chars.append(char)
            last_dash = False
            continue
        if not last_dash:
            slug_chars.append("-")
            last_dash = True
    slug = "".join(slug_chars).strip("-")
    return slug or "feature"


def next_feature_id(specs_dir: Path) -> str:
    current_max = 0
    for child in specs_dir.iterdir():
        if not child.is_dir():
            continue
        match = FEATURE_DIR_RE.match(child.name)
        if not match:
            continue
        current_max = max(current_max, int(match.group(1)))
    next_number = current_max + 1
    return f"FEAT-{next_number:03d}"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(read_text(path))


def dump_json(path: Path, payload: dict[str, Any]) -> None:
    write_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def set_overview_value(text: str, label: str, value: str) -> str:
    pattern = re.compile(rf"^- {re.escape(label)}：.*$", re.M)
    replacement = f"- {label}：{value}"
    if pattern.search(text):
        return pattern.sub(replacement, text, count=1)
    return text


def extract_feature_rows(text: str) -> list[str]:
    lines = text.splitlines()
    start = find_feature_table_start(lines)
    if start is None:
        return []
    data_start = start + 2
    data_end = data_start
    while data_end < len(lines) and lines[data_end].startswith("|"):
        data_end += 1
    return lines[data_start:data_end]


def find_feature_table_start(lines: list[str]) -> int | None:
    for index, line in enumerate(lines):
        if line.strip() == "## Feature 索引":
            for cursor in range(index + 1, len(lines) - 1):
                if lines[cursor].startswith("| ID |") and lines[cursor + 1].startswith("|----"):
                    return cursor
            return None
    return None


def set_feature_rows(text: str, rows: list[str]) -> str:
    lines = text.splitlines()
    start = find_feature_table_start(lines)
    if start is None:
        raise ValueError("README 缺少 Feature 索引表格")
    data_start = start + 2
    data_end = data_start
    while data_end < len(lines) and lines[data_end].startswith("|"):
        data_end += 1
    new_lines = lines[:data_start] + rows + lines[data_end:]
    return "\n".join(new_lines) + "\n"


def sort_feature_rows(rows: list[str]) -> list[str]:
    def row_key(row: str) -> tuple[int, str]:
        cells = [cell.strip() for cell in row.strip("|").split("|")]
        feature_id = cells[0] if cells else ""
        match = re.match(r"FEAT-(\d+)", feature_id)
        if match:
            return int(match.group(1)), row
        return sys.maxsize, row

    return sorted(rows, key=row_key)


@dataclass
class InitSummary:
    created: list[str]
    updated: list[str]
    skipped: list[str]
    feature_id: str = ""
    feature_dir: str = ""


class CodeSpecInitializer:
    def __init__(self, repo_root: Path, skill_root: Path) -> None:
        self.repo_root = repo_root
        self.skill_root = skill_root
        self.templates_dir = skill_root / "templates"
        self.codespec_dir = repo_root / "codespec"
        self.runtime_dir = self.codespec_dir / "runtime"
        self.specs_dir = self.codespec_dir / "specs"
        self.summary = InitSummary(created=[], updated=[], skipped=[])
        self.timestamp = now_iso()

    def template(self, name: str) -> str:
        return read_text(self.templates_dir / name)

    def ensure_workspace(self) -> None:
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.specs_dir.mkdir(parents=True, exist_ok=True)

        agent_path = self.repo_root / "AGENT.md"
        if not agent_path.exists():
            write_text(agent_path, self.template("agent.template.md"))
            self.summary.created.append(str(agent_path))
        else:
            self.summary.skipped.append(str(agent_path))

        readme_path = self.codespec_dir / "README.md"
        if not readme_path.exists():
            rendered = render_template(
                self.template("README.template.md"),
                {
                    "feature_id": "",
                    "feature_title": "",
                    "feature_dir": "",
                },
            )
            rendered = set_feature_rows(rendered, [])
            rendered = set_overview_value(rendered, "项目", self.repo_root.name)
            rendered = set_overview_value(rendered, "负责人", "")
            rendered = set_overview_value(rendered, "当前激活的功能", "")
            rendered = set_overview_value(rendered, "最后更新时间", self.timestamp)
            write_text(readme_path, rendered)
            self.summary.created.append(str(readme_path))
        else:
            self.summary.skipped.append(str(readme_path))

        self.ensure_runtime_file("role-policy.template.yaml", self.runtime_dir / "role-policy.yaml")
        self.ensure_runtime_file("tools.template.yaml", self.runtime_dir / "tools.yaml")

        state_path = self.runtime_dir / "state.json"
        if not state_path.exists():
            state = json.loads(self.template("state.template.json"))
            state["last_updated"] = self.timestamp
            state["resume"]["next_role"] = "pm"
            state["resume"]["next_action"] = "创建或选择一个 feature"
            dump_json(state_path, state)
            self.summary.created.append(str(state_path))
        else:
            self.summary.skipped.append(str(state_path))

    def ensure_runtime_file(self, template_name: str, output_path: Path) -> None:
        if not output_path.exists():
            write_text(output_path, self.template(template_name))
            self.summary.created.append(str(output_path))
        else:
            self.summary.skipped.append(str(output_path))

    def scaffold_feature(
        self,
        feature_title: str,
        feature_type: str,
        priority: str,
        actor: str,
        capability: str,
        value: str,
    ) -> None:
        feature_id = next_feature_id(self.specs_dir)
        feature_slug = slugify(feature_title)
        feature_dir = f"{feature_id}-{feature_slug}"
        feature_path = self.specs_dir / feature_dir
        feature_path.mkdir(parents=True, exist_ok=True)

        story_id = "ST-001"
        task_id = "T-001"
        story_title = feature_title
        task_title = f"实现{feature_title}"

        values = {
            "feature_id": feature_id,
            "feature_title": feature_title,
            "feature_dir": feature_dir,
            "story_id": story_id,
            "story_title": story_title,
            "task_id": task_id,
            "task_title": task_title,
            "actor": actor,
            "capability": capability,
            "value": value,
            "feature_type": feature_type,
            "priority": priority,
        }

        proposal_path = feature_path / "proposal.md"
        proposal_content = render_template(self.template("proposal.template.md"), values)
        proposal_content = proposal_content.replace("type: feature", f"type: {feature_type}")
        proposal_content = proposal_content.replace("priority: P1", f"priority: {priority}")
        write_text(proposal_path, proposal_content)

        stories_path = feature_path / "stories.md"
        stories_content = render_template(self.template("story.template.md"), values)
        stories_content = stories_content.replace(
            f"| {story_id} | {story_title} | P1 | ready | - |",
            f"| {story_id} | {story_title} | {priority} | ready | - |",
        )
        stories_content = stories_content.replace("priority: P1", f"priority: {priority}")
        write_text(stories_path, stories_content)

        tasks_path = feature_path / "tasks.md"
        tasks_content = render_template(self.template("task.template.md"), values)
        write_text(tasks_path, tasks_content)

        validation_path = feature_path / "validation-report.md"
        validation_content = render_template(self.template("validation-report.template.md"), values)
        write_text(validation_path, validation_content)

        self.summary.created.extend(
            [
                str(proposal_path),
                str(stories_path),
                str(tasks_path),
                str(validation_path),
            ]
        )
        self.summary.feature_id = feature_id
        self.summary.feature_dir = feature_dir

        self.update_readme_with_feature(feature_id, feature_title, feature_dir, priority)
        self.update_state_for_feature(feature_dir)

    def update_readme_with_feature(
        self, feature_id: str, feature_title: str, feature_dir: str, priority: str
    ) -> None:
        readme_path = self.codespec_dir / "README.md"
        text = read_text(readme_path)
        rows = extract_feature_rows(text)
        new_row = f"| {feature_id} | {feature_title} | proposal | {priority} | specs/{feature_dir}/ |"
        if not any(row.startswith(f"| {feature_id} |") for row in rows):
            rows.append(new_row)
        rows = sort_feature_rows(rows)
        text = set_feature_rows(text, rows)
        text = set_overview_value(text, "项目", self.repo_root.name)
        text = set_overview_value(text, "当前激活的功能", feature_dir)
        text = set_overview_value(text, "最后更新时间", self.timestamp)
        write_text(readme_path, text)
        self.summary.updated.append(str(readme_path))

    def update_state_for_feature(self, feature_dir: str) -> None:
        state_path = self.runtime_dir / "state.json"
        state = load_json(state_path)
        state["active_feature"] = feature_dir
        state["active_phase"] = "proposal"
        state["active_dispatch"] = {
            "role": "ra",
            "story": "",
            "task": "",
        }
        state["resume"] = {
            "mode": "init",
            "next_role": "ra",
            "next_action": "完善 proposal.md 并补全 stories.md",
        }
        state["blocked"] = []
        state["last_updated"] = self.timestamp
        dump_json(state_path, state)
        self.summary.updated.append(str(state_path))

    def normalize_idle_state(self) -> None:
        state_path = self.runtime_dir / "state.json"
        state = load_json(state_path)
        changed = False
        if not state.get("active_feature"):
            if state.get("active_phase") != "idle":
                state["active_phase"] = "idle"
                changed = True
            if state.get("active_dispatch") != {"role": "", "story": "", "task": ""}:
                state["active_dispatch"] = {"role": "", "story": "", "task": ""}
                changed = True
            resume = state.get("resume", {})
            expected_resume = {
                "mode": "init",
                "next_role": "pm",
                "next_action": "创建或选择一个 feature",
            }
            if resume != expected_resume:
                state["resume"] = expected_resume
                changed = True
        if changed:
            state["last_updated"] = self.timestamp
            dump_json(state_path, state)
            self.summary.updated.append(str(state_path))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Initialize Quick SDD workspace and optionally scaffold a feature."
    )
    parser.add_argument("--repo-root", required=True, help="项目根目录")
    parser.add_argument("--feature-title", help="可选。传入后会创建一个新的 feature 脚手架")
    parser.add_argument("--feature-type", default="feature", help="feature 类型，默认 feature")
    parser.add_argument("--priority", default="P1", help="feature 优先级，默认 P1")
    parser.add_argument("--actor", default="用户", help="故事模板中的 actor")
    parser.add_argument("--capability", help="故事模板中的 capability，默认等于 feature 标题")
    parser.add_argument("--value", default="完成目标", help="故事模板中的 value")
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

    skill_root = Path(__file__).resolve().parents[1]
    initializer = CodeSpecInitializer(repo_root=repo_root, skill_root=skill_root)
    initializer.ensure_workspace()
    if args.feature_title:
        capability = args.capability or args.feature_title
        initializer.scaffold_feature(
            feature_title=args.feature_title,
            feature_type=args.feature_type,
            priority=args.priority,
            actor=args.actor,
            capability=capability,
            value=args.value,
        )
    else:
        initializer.normalize_idle_state()

    payload = {
        "status": "DONE",
        "repo_root": str(repo_root),
        "created": initializer.summary.created,
        "updated": initializer.summary.updated,
        "skipped": initializer.summary.skipped,
        "feature_id": initializer.summary.feature_id,
        "feature_dir": initializer.summary.feature_dir,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
