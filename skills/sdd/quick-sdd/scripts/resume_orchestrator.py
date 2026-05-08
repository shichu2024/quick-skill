#!/usr/bin/env python3
"""Recommend the next Quick SDD routing step from runtime state."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from resolve_dispatch import (
    ResolutionError,
    YAML_FENCE_RE,
    parse_tasks_markdown,
    parse_yaml,
)
from sync_validation_snapshot import resolve_validation_routing


STORY_SECTION_RE = re.compile(r"^##\s+ST-[^\n]*\n(?P<body>.*?)(?=^##\s+ST-|\Z)", re.M | re.S)
OPEN_TASK_STATUSES = {"todo", "in_progress"}
def normalize_scalar(value: Any) -> str:
    return str(value or "").strip().strip("`")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


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


def parse_stories_markdown(stories_path: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    if not stories_path.exists():
        return [], {}
    text = read_text(stories_path)
    story_list: list[dict[str, Any]] = []
    stories_by_id: dict[str, dict[str, Any]] = {}
    for match in STORY_SECTION_RE.finditer(text):
        fence_match = YAML_FENCE_RE.search(match.group("body"))
        if not fence_match:
            continue
        story = parse_yaml(fence_match.group("yaml"))
        if not isinstance(story, dict):
            raise ResolutionError("invalid_story_yaml", str(stories_path))
        story_id = str(story.get("id", "")).strip()
        if not story_id:
            raise ResolutionError("story_field_missing:id", str(stories_path))
        story.setdefault("title", "")
        story.setdefault("status", "draft")
        story.setdefault("depends_on", [])
        story_list.append(story)
        stories_by_id[story_id] = story
    return story_list, stories_by_id


def latest_validation_hint(state: dict[str, Any], validation_routing: dict[str, str] | None = None) -> dict[str, Any]:
    latest = state.get("latest_validation", {}) or {}
    active_dispatch = state.get("active_dispatch", {}) or {}
    active_story = str(active_dispatch.get("story", "") or "")
    active_task = str(active_dispatch.get("task", "") or "")
    validation_story = str(latest.get("story", "") or "")
    validation_task = str(latest.get("task", "") or "")
    routing = validation_routing or {}
    decision = normalize_scalar(routing.get("decision", "") or latest.get("decision", ""))
    status = normalize_scalar(routing.get("status", "") or latest.get("status", ""))
    root_cause_type = normalize_scalar(routing.get("root_cause_type", ""))
    reroute_to = normalize_scalar(routing.get("reroute_to", ""))
    reroute_action = normalize_scalar(routing.get("reroute_action", ""))
    summary = normalize_scalar(routing.get("summary", "") or latest.get("summary", ""))
    report_ref = normalize_scalar(routing.get("report_ref", "") or latest.get("report_ref", ""))
    source = normalize_scalar(routing.get("source", ""))
    usable = bool(
        decision
        and state.get("active_feature")
        and (not validation_story or validation_story == active_story)
        and (not validation_task or validation_task == active_task)
    )
    preferred_next_role = ""
    preferred_resume_mode = ""
    if usable:
        if decision == "fail":
            preferred_next_role = reroute_to or "dev"
            preferred_resume_mode = "repair"
        elif decision == "conditional_pass":
            preferred_next_role = "pm"
            preferred_resume_mode = "validate"
        elif decision == "pass":
            preferred_next_role = "pm"
            preferred_resume_mode = "continue"
    return {
        "usable": usable,
        "status": status,
        "decision": decision,
        "root_cause_type": root_cause_type,
        "reroute_to": reroute_to,
        "reroute_action": reroute_action,
        "summary": summary,
        "report_ref": report_ref,
        "updated_at": normalize_scalar(routing.get("updated_at", "") or latest.get("updated_at", "")),
        "source": source,
        "preferred_next_role": preferred_next_role,
        "preferred_resume_mode": preferred_resume_mode,
    }


def task_is_open(task: dict[str, Any]) -> bool:
    return str(task.get("status", "")).strip().lower() in OPEN_TASK_STATUSES


def task_is_done(task: dict[str, Any]) -> bool:
    return str(task.get("status", "")).strip().lower() == "done"


def depends_satisfied(task: dict[str, Any], tasks_by_id: dict[str, dict[str, Any]]) -> bool:
    depends_on = task.get("depends_on", []) or []
    if not isinstance(depends_on, list):
        return False
    for dependency_id in depends_on:
        dependency = tasks_by_id.get(str(dependency_id))
        if dependency is None or not task_is_done(dependency):
            return False
    return True


def ordered_tasks(tasks_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return list(tasks_by_id.values())


def find_current_or_next_task(
    tasks_by_id: dict[str, dict[str, Any]], active_task: str, active_story: str, exclude_task: str = ""
) -> dict[str, Any] | None:
    tasks = ordered_tasks(tasks_by_id)
    if active_task and active_task in tasks_by_id:
        current = tasks_by_id[active_task]
        if task_is_open(current) and depends_satisfied(current, tasks_by_id):
            return current
    for task in tasks:
        if exclude_task and str(task.get("id", "") or "") == exclude_task:
            continue
        if active_story and str(task.get("story_id", "")) != active_story:
            continue
        if task_is_open(task) and depends_satisfied(task, tasks_by_id):
            return task
    for task in tasks:
        if exclude_task and str(task.get("id", "") or "") == exclude_task:
            continue
        if task_is_open(task) and depends_satisfied(task, tasks_by_id):
            return task
    return None


def find_unplanned_story(
    stories: list[dict[str, Any]], tasks_by_id: dict[str, dict[str, Any]]
) -> dict[str, Any] | None:
    tasks_by_story: dict[str, list[dict[str, Any]]] = {}
    for task in tasks_by_id.values():
        story_id = str(task.get("story_id", "") or "")
        tasks_by_story.setdefault(story_id, []).append(task)
    for story in stories:
        story_id = str(story.get("id", "") or "")
        if story_id and not tasks_by_story.get(story_id):
            return story
    return None


def current_story_for_validation(
    stories_by_id: dict[str, dict[str, Any]], tasks_by_id: dict[str, dict[str, Any]], active_story: str
) -> str:
    if active_story:
        return active_story
    for task in ordered_tasks(tasks_by_id):
        if task_is_open(task):
            return str(task.get("story_id", "") or "")
    for story_id in stories_by_id:
        return story_id
    return ""


def fail_recommendation_from_hint(active_story: str, active_task: str, hint: dict[str, Any]) -> dict[str, Any]:
    reroute_to = normalize_scalar(hint.get("reroute_to", "")) or "dev"
    reroute_action = normalize_scalar(hint.get("reroute_action", ""))
    root_cause_type = normalize_scalar(hint.get("root_cause_type", ""))
    if reroute_to == "ta":
        return {
            "phase": "planning",
            "resume_mode": "repair",
            "next_role": "ta",
            "next_action": reroute_action or "根据 QA 根因重新拆解 task 边界、依赖或访问范围。",
            "dispatch": {"role": "ta", "story": active_story, "task": ""},
            "reason": f"latest_validation 为 fail，且根因属于 {root_cause_type or 'task_boundary'}，改派给 ta。",
        }
    if reroute_to == "ra":
        return {
            "phase": "stories",
            "resume_mode": "repair",
            "next_role": "ra",
            "next_action": reroute_action or "根据 QA 根因回看 story、acceptance 或 feature 范围定义。",
            "dispatch": {"role": "ra", "story": active_story, "task": ""},
            "reason": f"latest_validation 为 fail，且根因属于 {root_cause_type or 'requirement_gap'}，改派给 ra。",
        }
    if reroute_to == "pm":
        return {
            "phase": "validating",
            "resume_mode": "repair",
            "next_role": "pm",
            "next_action": reroute_action or "审阅 QA 根因并决定是回流 dev、ta 还是 ra。",
            "dispatch": {"role": "pm", "story": active_story, "task": active_task},
            "reason": "latest_validation 为 fail，但 QA 建议由 pm 先做路由决策。",
        }
    return {
        "phase": "implementing",
        "resume_mode": "repair",
        "next_role": "dev",
        "next_action": reroute_action or "根据最近一次 QA 失败结论修复当前 task 或 story 的实现问题。",
        "dispatch": {"role": "dev", "story": active_story, "task": active_task},
        "reason": "latest_validation 为 fail，按实现问题回流给 dev 修复。",
    }


def recommend_next_step(
    state: dict[str, Any],
    stories: list[dict[str, Any]],
    stories_by_id: dict[str, dict[str, Any]],
    tasks_by_id: dict[str, dict[str, Any]],
    hint: dict[str, Any],
) -> dict[str, Any]:
    active_feature = str(state.get("active_feature", "") or "")
    active_phase = str(state.get("active_phase", "") or "idle")
    active_dispatch = state.get("active_dispatch", {}) or {}
    active_story = str(active_dispatch.get("story", "") or "")
    active_task = str(active_dispatch.get("task", "") or "")
    if not active_feature:
        return {
            "phase": "idle",
            "resume_mode": "init",
            "next_role": "pm",
            "next_action": "创建或选择一个 feature",
            "dispatch": {"role": "", "story": "", "task": ""},
            "reason": "当前没有激活的 feature，需要先初始化或选择目标功能。",
        }

    if hint["usable"]:
        if hint["decision"] == "fail":
            return fail_recommendation_from_hint(active_story, active_task, hint)
        if hint["decision"] == "conditional_pass":
            reroute_to = normalize_scalar(hint.get("reroute_to", ""))
            reroute_action = normalize_scalar(hint.get("reroute_action", ""))
            extra = ""
            if reroute_to and reroute_to != "pm":
                followup = reroute_action or f"如不接受风险，则回流给 {reroute_to} 继续处理。"
                extra = f" 如不接受风险，建议回流给 {reroute_to}：{followup}"
            return {
                "phase": "validating",
                "resume_mode": "validate",
                "next_role": "pm",
                "next_action": "审阅 conditional_pass 的剩余风险，并决定接受风险还是回流修复。" + extra,
                "dispatch": {"role": "pm", "story": active_story, "task": active_task},
                "reason": "latest_validation 为 conditional_pass，需要 PM 做接受或回流决策。",
            }
        if hint["decision"] == "pass":
            next_task = find_current_or_next_task(tasks_by_id, "", active_story, exclude_task=active_task)
            if next_task:
                return {
                    "phase": "implementing",
                    "resume_mode": "continue",
                    "next_role": str(next_task.get("owner_role", "dev") or "dev"),
                    "next_action": f"继续执行 {next_task.get('id', '')} {next_task.get('title', '')}".strip(),
                    "dispatch": {
                        "role": str(next_task.get("owner_role", "dev") or "dev"),
                        "story": str(next_task.get("story_id", "") or ""),
                        "task": str(next_task.get("id", "") or ""),
                    },
                    "reason": "最近一次验证通过，且仍存在可继续执行的 task。",
                }
            unplanned_story = find_unplanned_story(stories, tasks_by_id)
            if unplanned_story:
                return {
                    "phase": "planning",
                    "resume_mode": "continue",
                    "next_role": "ta",
                    "next_action": f"为 {unplanned_story.get('id', '')} 生成 tasks.md 中的任务拆解。",
                    "dispatch": {
                        "role": "ta",
                        "story": str(unplanned_story.get("id", "") or ""),
                        "task": "",
                    },
                    "reason": "最近一次验证通过，但仍存在尚未拆解 task 的 story。",
                }
            return {
                "phase": "done",
                "resume_mode": "continue",
                "next_role": "pm",
                "next_action": "复核验证报告并完成 feature 收尾。",
                "dispatch": {"role": "pm", "story": active_story, "task": active_task},
                "reason": "最近一次验证通过，且没有剩余可执行 task。",
            }

    if active_phase in {"idle", ""}:
        return {
            "phase": "idle",
            "resume_mode": "init",
            "next_role": "pm",
            "next_action": "创建或选择一个 feature",
            "dispatch": {"role": "", "story": "", "task": ""},
            "reason": "当前处于空闲态，需要 PM 决定入口。",
        }
    if active_phase == "proposal":
        return {
            "phase": "proposal",
            "resume_mode": "continue",
            "next_role": "ra",
            "next_action": "完善 proposal.md，并明确范围、风险和待确认问题。",
            "dispatch": {"role": "ra", "story": "", "task": ""},
            "reason": "当前处于 proposal 阶段，应继续由 RA 完成需求分析。",
        }
    if active_phase == "stories":
        return {
            "phase": "stories",
            "resume_mode": "continue",
            "next_role": "ra",
            "next_action": "补全 stories.md 与 acceptance criteria。",
            "dispatch": {"role": "ra", "story": active_story, "task": ""},
            "reason": "当前处于 stories 阶段，应继续完善用户故事。",
        }
    if active_phase == "planning":
        unplanned_story = find_unplanned_story(stories, tasks_by_id)
        story_id = str(unplanned_story.get("id", "") or "") if unplanned_story else active_story
        return {
            "phase": "planning",
            "resume_mode": "continue",
            "next_role": "ta",
            "next_action": "根据已确认的 story 更新 tasks.md、依赖和访问范围。",
            "dispatch": {"role": "ta", "story": story_id, "task": ""},
            "reason": "当前处于 planning 阶段，应继续由 TA 拆解执行任务。",
        }
    if active_phase == "implementing":
        next_task = find_current_or_next_task(tasks_by_id, active_task, active_story)
        if next_task:
            return {
                "phase": "implementing",
                "resume_mode": "continue",
                "next_role": str(next_task.get("owner_role", "dev") or "dev"),
                "next_action": f"继续执行 {next_task.get('id', '')} {next_task.get('title', '')}".strip(),
                "dispatch": {
                    "role": str(next_task.get("owner_role", "dev") or "dev"),
                    "story": str(next_task.get("story_id", "") or ""),
                    "task": str(next_task.get("id", "") or ""),
                },
                "reason": "当前存在可执行 task，应继续实现。",
            }
        validation_story = current_story_for_validation(stories_by_id, tasks_by_id, active_story)
        return {
            "phase": "validating",
            "resume_mode": "validate",
            "next_role": "qa",
            "next_action": "执行 QA 验证并更新 validation-report.md。",
            "dispatch": {"role": "qa", "story": validation_story, "task": active_task},
            "reason": "当前没有剩余开放 task，建议进入验证阶段。",
        }
    if active_phase == "validating":
        validation_story = current_story_for_validation(stories_by_id, tasks_by_id, active_story)
        return {
            "phase": "validating",
            "resume_mode": "validate",
            "next_role": "qa",
            "next_action": "继续完成当前验证并写回 validation-report.md。",
            "dispatch": {"role": "qa", "story": validation_story, "task": active_task},
            "reason": "当前已处于 validating 阶段，但最新 QA 裁决不足以触发回流或收尾。",
        }
    if active_phase == "blocked":
        return {
            "phase": "blocked",
            "resume_mode": "continue",
            "next_role": "pm",
            "next_action": "先处理 blocked 列表中的阻塞项，再决定下一跳。",
            "dispatch": {"role": "pm", "story": active_story, "task": active_task},
            "reason": "当前存在阻塞，需要 PM 先清障。",
        }
    if active_phase == "done":
        return {
            "phase": "done",
            "resume_mode": "continue",
            "next_role": "pm",
            "next_action": "feature 已完成，如需继续请切换或创建新的 feature。",
            "dispatch": {"role": "pm", "story": active_story, "task": active_task},
            "reason": "当前 feature 已位于 done 阶段。",
        }

    return {
        "phase": active_phase,
        "resume_mode": "continue",
        "next_role": "pm",
        "next_action": "审阅当前状态并手动决定下一跳。",
        "dispatch": {"role": "pm", "story": active_story, "task": active_task},
        "reason": "未命中特定阶段规则，退回 PM 做人工路由。",
    }


def apply_recommendation(state_path: Path, state: dict[str, Any], recommendation: dict[str, Any]) -> None:
    dispatch = recommendation["dispatch"]
    state["active_phase"] = recommendation["phase"]
    state["active_dispatch"] = {
        "role": dispatch.get("role", ""),
        "story": dispatch.get("story", ""),
        "task": dispatch.get("task", ""),
    }
    state["resume"] = {
        "mode": recommendation["resume_mode"],
        "next_role": recommendation["next_role"],
        "next_action": recommendation["next_action"],
    }
    state["last_updated"] = now_iso()
    dump_json(state_path, state)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Recommend the next Quick SDD routing step from runtime state."
    )
    parser.add_argument("--repo-root", required=True, help="项目根目录")
    parser.add_argument(
        "--state",
        default="codespec/runtime/state.json",
        help="相对项目根目录的 state.json 路径",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="将推荐结果写回 state.json",
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
        active_feature = str(state.get("active_feature", "") or "")
        stories: list[dict[str, Any]] = []
        stories_by_id: dict[str, dict[str, Any]] = {}
        tasks_by_id: dict[str, dict[str, Any]] = {}
        if active_feature:
            feature_dir = repo_root / "codespec" / "specs" / active_feature
            stories, stories_by_id = parse_stories_markdown(feature_dir / "stories.md")
            tasks_path = feature_dir / "tasks.md"
            if tasks_path.exists():
                tasks_by_id, _ = parse_tasks_markdown(tasks_path)
        validation_routing = resolve_validation_routing(repo_root, state)
        hint = latest_validation_hint(state, validation_routing=validation_routing)
        recommendation = recommend_next_step(state, stories, stories_by_id, tasks_by_id, hint)
        if args.apply:
            apply_recommendation(state_path, state, recommendation)
        payload = {
            "status": "DONE",
            "repo_root": str(repo_root),
            "active_feature": active_feature,
            "current_phase": str(state.get("active_phase", "") or ""),
            "current_dispatch": state.get("active_dispatch", {}) or {},
            "latest_validation_hint": hint,
            "recommendation": recommendation,
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
