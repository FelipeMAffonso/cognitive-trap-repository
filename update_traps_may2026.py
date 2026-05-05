"""
Merge May 2026 model trial data into traps.json.
Adds a new contribution entry "affonso-2026-may" without touching prior entries.

Usage: python update_traps_may2026.py
"""
import json
import pandas as pd
from pathlib import Path

DATA_DIR = Path(r"C:\Users\fmarine\Dropbox\Felipe\CLAUDE CODE\academic-research\projects\cognitive-traps-jcr\v2_revision\data")
REPO_DIR = Path(r"C:\Users\fmarine\Dropbox\Felipe\CLAUDE CODE\academic-research\cognitive-trap-repository")

# May 2026 CSV files (chronologically by start time)
CSV_FILES = [
    "model_trials_20260505_151415.csv",  # Anthropic 4.7 (3 variants × 6 traps × 10)
    "model_trials_20260505_151417.csv",  # OpenAI 5.4 instant + thinking (5.4-pro had 2 trials, dropped)
    "model_trials_20260505_151419.csv",  # Google 3.1 (6 variants × 6 × 10)
    "model_trials_20260505_153848.csv",  # OpenAI 5.5 instant
    "model_trials_20260505_154142.csv",  # OpenAI 5.5 thinking + thinking-high + thinking-xhigh
]

# Models to skip (incomplete: only 2 trials of gpt-5.4-pro before kill)
SKIP_MODELS = {"gpt-5.4-pro", "gpt-5.5-pro"}

TRAP_MAP = {
    "cafe_wall": "modified-cafe-wall",
    "muller_lyer": "modified-muller-lyer",
    "ebbinghaus": "modified-ebbinghaus",
    "moving_robot": "moving-robot",
    "colliding_oranges": "colliding-oranges",
    "surrounded_planets": "surrounded-planets",
}

# Display name + provider + thinking-config description for each new variant
# Schema:
#   model_key (CSV "model" column) -> {
#     "display": str,
#     "provider": str,
#     "method": "API" or "Chat Interface",
#     "config": str (human-readable, surfaced in tooltip)
#   }
NEW_MODELS = {
    # Anthropic Opus 4.7 (Apr 16, 2026)
    "claude-opus-4.7":              {"display": "Claude Opus 4.7",            "provider": "Anthropic", "method": "API", "config": "no thinking"},
    "claude-opus-4.7-thinking":     {"display": "Claude Opus 4.7\u2020",      "provider": "Anthropic", "method": "API", "config": "adaptive thinking, effort=medium"},
    "claude-opus-4.7-thinking-xhigh": {"display": "Claude Opus 4.7\u2020 (xhigh)", "provider": "Anthropic", "method": "API", "config": "adaptive thinking, effort=xhigh"},

    # OpenAI GPT-5.4 (Mar 5, 2026) — Pro skipped
    "gpt-5.4-instant":              {"display": "GPT-5.4 Instant",            "provider": "OpenAI", "method": "API", "config": "reasoning_effort=none"},
    "gpt-5.4-thinking":             {"display": "GPT-5.4\u2020",              "provider": "OpenAI", "method": "API", "config": "reasoning_effort=medium"},

    # OpenAI GPT-5.5 (Apr 23, 2026) — Pro skipped
    "gpt-5.5-instant":              {"display": "GPT-5.5 Instant",            "provider": "OpenAI", "method": "API", "config": "reasoning_effort=none"},
    "gpt-5.5-thinking":             {"display": "GPT-5.5\u2020",              "provider": "OpenAI", "method": "API", "config": "reasoning_effort=medium"},
    "gpt-5.5-thinking-high":        {"display": "GPT-5.5\u2020 (high)",       "provider": "OpenAI", "method": "API", "config": "reasoning_effort=high"},
    "gpt-5.5-thinking-xhigh":       {"display": "GPT-5.5\u2020 (xhigh)",      "provider": "OpenAI", "method": "API", "config": "reasoning_effort=xhigh"},

    # Google Gemini 3.1 (Feb 20 / Mar 3, 2026)
    "gemini-3.1-pro":               {"display": "Gemini 3.1 Pro",             "provider": "Google", "method": "API", "config": "thinking_level=low (Pro min)"},
    "gemini-3.1-pro-thinking":      {"display": "Gemini 3.1 Pro\u2020",       "provider": "Google", "method": "API", "config": "thinking_level=high"},
    "gemini-3.1-flash":             {"display": "Gemini 3.1 Flash",           "provider": "Google", "method": "API", "config": "thinking_level=minimal"},
    "gemini-3.1-flash-thinking":    {"display": "Gemini 3.1 Flash\u2020",     "provider": "Google", "method": "API", "config": "thinking_level=high"},
    "gemini-3.1-flash-lite":        {"display": "Gemini 3.1 Flash Lite",      "provider": "Google", "method": "API", "config": "thinking_level=minimal"},
    "gemini-3.1-flash-lite-thinking": {"display": "Gemini 3.1 Flash Lite\u2020", "provider": "Google", "method": "API", "config": "thinking_level=high"},
}

# Display order (newest gen first within each provider)
MODEL_ORDER = [
    "claude-opus-4.7", "claude-opus-4.7-thinking", "claude-opus-4.7-thinking-xhigh",
    "gpt-5.5-instant", "gpt-5.5-thinking", "gpt-5.5-thinking-high", "gpt-5.5-thinking-xhigh",
    "gpt-5.4-instant", "gpt-5.4-thinking",
    "gemini-3.1-pro", "gemini-3.1-pro-thinking",
    "gemini-3.1-flash", "gemini-3.1-flash-thinking",
    "gemini-3.1-flash-lite", "gemini-3.1-flash-lite-thinking",
]

CONTRIBUTION = {
    "id": "affonso-2026-may",
    "contributor": "Affonso (2026)",
    "date": "2026-05-05",
    "type": "update",
    "description": "May 2026 model refresh: Claude Opus 4.7, OpenAI GPT-5.4/5.5 (with reasoning-effort variants from none/medium/high/xhigh), and Google Gemini 3.1 family. 15 new variants × 6 traps × 10 trials each (900 total trials).",
}


def main() -> None:
    # ── Load and concatenate trial CSVs ─────────────────────────────────
    frames = []
    for f in CSV_FILES:
        path = DATA_DIR / f
        if not path.exists():
            print(f"WARNING: missing {path}")
            continue
        frames.append(pd.read_csv(path))
    df = pd.concat(frames, ignore_index=True)
    df = df[~df["model"].isin(SKIP_MODELS)]
    print(f"Loaded {len(df)} trials, {df['model'].nunique()} models, {df['trap'].nunique()} traps")

    # ── Compute per-(model, trap) accuracy ─────────────────────────────
    results: dict[str, dict[str, dict]] = {}
    for model_key in df["model"].unique():
        results[model_key] = {}
        for csv_trap in TRAP_MAP:
            subset = df[(df["model"] == model_key) & (df["trap"] == csv_trap)]
            if len(subset) == 0:
                continue
            results[model_key][csv_trap] = {
                "passRate": round(subset["correct"].mean(), 2),
                "trials": int(len(subset)),
            }

    # Summary
    print("\n=== Per-model average pass rate ===")
    for m in MODEL_ORDER:
        if m not in results:
            continue
        accs = [results[m][t]["passRate"] for t in results[m]]
        avg = sum(accs) / len(accs) * 100 if accs else 0
        print(f"  {NEW_MODELS[m]['display']:<35s} avg {avg:>5.1f}%  ({len(accs)} traps)")

    # ── Load existing traps.json ──────────────────────────────────────
    traps_path = REPO_DIR / "traps.json"
    with open(traps_path, encoding="utf-8") as f:
        traps = json.load(f)

    # ── Merge new entries into each trap ──────────────────────────────
    for trap in traps:
        trap_id = trap["id"]
        # Find CSV trap key
        csv_trap = None
        for k, v in TRAP_MAP.items():
            if v == trap_id:
                csv_trap = k
                break
        if csv_trap is None:
            print(f"  (skipping {trap_id}: no CSV mapping)")
            continue

        # Add new contribution entry if not already present
        existing_ids = {c["id"] for c in trap.get("contributions", [])}
        if CONTRIBUTION["id"] not in existing_ids:
            trap.setdefault("contributions", []).append(CONTRIBUTION.copy())

        # Add new modelTests entries (in MODEL_ORDER, skipping any already present)
        existing_displays = {mt["model"] for mt in trap.get("modelTests", [])}
        new_entries = []
        for model_key in MODEL_ORDER:
            if model_key not in results:
                continue
            if csv_trap not in results[model_key]:
                continue
            meta = NEW_MODELS[model_key]
            display = meta["display"]
            if display in existing_displays:
                continue  # don't duplicate
            r = results[model_key][csv_trap]
            entry = {
                "model": display,
                "passRate": r["passRate"],
                "trials": r["trials"],
                "provider": meta["provider"],
                "method": meta["method"],
                "config": meta["config"],         # NEW field for tooltip
                "source": "Affonso (2026)",
                "contributionId": CONTRIBUTION["id"],
            }
            new_entries.append(entry)

        trap["modelTests"] = trap.get("modelTests", []) + new_entries
        print(f"  {trap['name']:<25s}  +{len(new_entries):>2d} new model entries  (total now {len(trap['modelTests'])})")

    # ── Write back ─────────────────────────────────────────────────────
    with open(traps_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(traps, f, indent=2, ensure_ascii=False)
    print(f"\nWrote updated traps.json -> {traps_path}")


if __name__ == "__main__":
    main()
