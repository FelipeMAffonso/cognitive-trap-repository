"""
Update traps.json with 34-model extended validation data.
Reads CSV trial data, computes per-model per-trap accuracy,
and adds entries to the existing traps.json.
"""
import json
import pandas as pd
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────
DATA_DIR = Path(r"C:\Users\felip\Dropbox\Felipe\CLAUDE CODE\academic-research\projects\cognitive-traps-jcr\v2_revision\data")
REPO_DIR = Path(r"C:\Users\felip\Dropbox\Felipe\CLAUDE CODE\academic-research\cognitive-trap-repository")

# ── Load CSV data ──────────────────────────────────────────────────
claude = pd.read_csv(DATA_DIR / "claude_model_trials_combined.csv")
openai_df = pd.read_csv(DATA_DIR / "openai_model_trials_combined.csv")
google = pd.read_csv(DATA_DIR / "google_model_trials_combined.csv")
models = pd.concat([claude, openai_df, google], ignore_index=True)

print(f"Total trials: {len(models)}")
print(f"Unique models: {models['model'].nunique()}")
print(f"Unique traps: {models['trap'].nunique()}")

# ── Map CSV trap keys to traps.json IDs ────────────────────────────
TRAP_MAP = {
    "cafe_wall": "modified-cafe-wall",
    "muller_lyer": "modified-muller-lyer",
    "ebbinghaus": "modified-ebbinghaus",
    "moving_robot": "moving-robot",
    "colliding_oranges": "colliding-oranges",
    "surrounded_planets": "surrounded-planets",
    "shape_overload": "shape-overload",
}

# ── Map CSV model names to display names ───────────────────────────
DISPLAY_NAMES = {
    # Anthropic
    "claude-haiku-3.0": "Claude Haiku 3.0",
    "claude-haiku-3.5": "Claude Haiku 3.5",
    "claude-haiku-4.5": "Claude Haiku 4.5",
    "claude-haiku-4.5-thinking": "Claude Haiku 4.5\u2020",
    "claude-opus-4.5": "Claude Opus 4.5",
    "claude-opus-4.5-thinking": "Claude Opus 4.5\u2020",
    "claude-opus-4.6": "Claude Opus 4.6",
    "claude-opus-4.6-thinking": "Claude Opus 4.6\u2020",
    "claude-sonnet-4.5": "Claude Sonnet 4.5",
    "claude-sonnet-4.5-thinking": "Claude Sonnet 4.5\u2020",
    "claude-sonnet-4.6": "Claude Sonnet 4.6",
    "claude-sonnet-4.6-thinking": "Claude Sonnet 4.6\u2020",
    # OpenAI
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4.1": "GPT-4.1",
    "gpt-4.1-mini": "GPT-4.1 Mini",
    "gpt-5-instant": "GPT-5 Instant",
    "gpt-5-mini": "GPT-5 Mini",
    "gpt-5-thinking": "GPT-5\u2020",
    "gpt-5.1-instant": "GPT-5.1 Instant",
    "gpt-5.1-thinking": "GPT-5.1\u2020",
    "gpt-5.2-instant": "GPT-5.2 Instant",
    "gpt-5.2-pro": "GPT-5.2 Pro",
    "gpt-5.2-thinking": "GPT-5.2\u2020",
    # Google
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-flash-thinking": "Gemini 2.5 Flash\u2020",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
    "gemini-2.5-flash-lite-thinking": "Gemini 2.5 Flash Lite\u2020",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.5-pro-thinking": "Gemini 2.5 Pro\u2020",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-3-flash-thinking": "Gemini 3 Flash\u2020",
    "gemini-3-pro": "Gemini 3 Pro",
}

# Provider mapping
PROVIDERS = {}
for m in DISPLAY_NAMES:
    if m.startswith("claude"):
        PROVIDERS[m] = "Anthropic"
    elif m.startswith("gpt"):
        PROVIDERS[m] = "OpenAI"
    elif m.startswith("gemini"):
        PROVIDERS[m] = "Google"

# Release date mapping (approximate, from WA-C1)
RELEASE_DATES = {
    "claude-haiku-3.0": "2024-03",
    "gpt-4o": "2024-05",
    "gpt-4o-mini": "2024-07",
    "claude-haiku-3.5": "2024-10",
    "gemini-2.0-flash": "2025-02",
    "gemini-2.5-pro": "2025-03",
    "gemini-2.5-pro-thinking": "2025-03",
    "gpt-4.1": "2025-04",
    "gpt-4.1-mini": "2025-04",
    "gemini-2.5-flash": "2025-06",
    "gemini-2.5-flash-thinking": "2025-06",
    "gemini-2.5-flash-lite": "2025-06",
    "gemini-2.5-flash-lite-thinking": "2025-06",
    "gpt-5-instant": "2025-08",
    "gpt-5-mini": "2025-08",
    "gpt-5-thinking": "2025-08",
    "claude-sonnet-4.5": "2025-09",
    "claude-sonnet-4.5-thinking": "2025-09",
    "claude-haiku-4.5": "2025-10",
    "claude-haiku-4.5-thinking": "2025-10",
    "claude-opus-4.5": "2025-11",
    "claude-opus-4.5-thinking": "2025-11",
    "gemini-3-pro": "2025-11",
    "gpt-5.1-instant": "2025-11",
    "gpt-5.1-thinking": "2025-11",
    "gemini-3-flash": "2025-12",
    "gemini-3-flash-thinking": "2025-12",
    "gpt-5.2-instant": "2025-12",
    "gpt-5.2-pro": "2025-12",
    "gpt-5.2-thinking": "2025-12",
    "claude-opus-4.6": "2026-02",
    "claude-opus-4.6-thinking": "2026-02",
    "claude-sonnet-4.6": "2026-02",
    "claude-sonnet-4.6-thinking": "2026-02",
}

# ── Compute accuracy per model per trap ────────────────────────────
results = {}  # {csv_model: {csv_trap: {passRate, trials}}}
for csv_model in sorted(models["model"].unique()):
    results[csv_model] = {}
    for csv_trap in TRAP_MAP:
        subset = models[(models["model"] == csv_model) & (models["trap"] == csv_trap)]
        if len(subset) > 0:
            results[csv_model][csv_trap] = {
                "passRate": round(subset["correct"].mean(), 2),
                "trials": len(subset),
            }

# Print summary
print("\n=== Model Accuracy Summary ===")
for csv_model in sorted(results):
    display = DISPLAY_NAMES.get(csv_model, csv_model)
    provider = PROVIDERS.get(csv_model, "?")
    accs = []
    for csv_trap in ["cafe_wall", "muller_lyer", "ebbinghaus", "moving_robot", "colliding_oranges", "surrounded_planets"]:
        if csv_trap in results[csv_model]:
            accs.append(results[csv_model][csv_trap]["passRate"] * 100)
    avg = sum(accs) / len(accs) if accs else 0
    print(f"  {display:30s} ({provider:9s})  avg = {avg:.1f}%")

# ── Load existing traps.json ───────────────────────────────────────
with open(REPO_DIR / "traps.json", encoding="utf-8") as f:
    traps = json.load(f)

# ── New contribution entry ─────────────────────────────────────────
EXTENDED_CONTRIBUTION = {
    "id": "affonso-2026-extended",
    "contributor": "Affonso (2026)",
    "date": "2026-02-18",
    "type": "model-data",
    "description": "Extended validation: 34 vision-language models tested via API (10 trials per trap per model, 2,040 total trials)"
}

# ── Fix existing model name: "GPT-5 Instant" → "GPT-5.1 Instant" ──
# The initial 6 models were GPT-5.1 Instant (not GPT-5 Instant)
for trap in traps:
    for mt in trap.get("modelTests", []):
        if mt["model"] == "GPT-5 Instant":
            mt["model"] = "GPT-5.1 Instant"
        if mt["model"] == "GPT-5.1 Thinking":
            mt["model"] = "GPT-5.1\u2020"

# ── Sort order for models (by release date, then alphabetical) ─────
model_order = sorted(
    DISPLAY_NAMES.keys(),
    key=lambda m: (RELEASE_DATES.get(m, "9999-99"), DISPLAY_NAMES[m])
)

# ── Update each trap ──────────────────────────────────────────────
for trap in traps:
    trap_id = trap["id"]

    # Find matching CSV trap key
    csv_trap = None
    for k, v in TRAP_MAP.items():
        if v == trap_id:
            csv_trap = k
            break
    if csv_trap is None:
        print(f"WARNING: No CSV mapping for trap {trap_id}")
        continue

    # Add contribution if not already present
    has_extended = any(c["id"] == "affonso-2026-extended" for c in trap.get("contributions", []))
    if not has_extended:
        trap.setdefault("contributions", []).append(EXTENDED_CONTRIBUTION.copy())

    # Get existing model names to avoid exact duplicates
    existing_models = {mt["model"] for mt in trap.get("modelTests", [])}

    # Add new model entries (skip models whose display name already exists)
    new_entries = []
    for csv_model in model_order:
        if csv_trap not in results.get(csv_model, {}):
            continue
        display_name = DISPLAY_NAMES[csv_model]
        if display_name in existing_models:
            continue  # Already in the original validation

        r = results[csv_model][csv_trap]
        entry = {
            "model": display_name,
            "passRate": r["passRate"],
            "trials": r["trials"],
            "provider": PROVIDERS.get(csv_model, "Unknown"),
            "source": "Affonso (2026), Extended validation",
            "contributionId": "affonso-2026-extended"
        }
        new_entries.append(entry)

    trap["modelTests"] = trap.get("modelTests", []) + new_entries
    print(f"\n{trap['name']}: {len(existing_models)} existing + {len(new_entries)} new = {len(trap['modelTests'])} total models")

# ── Add provider field to existing entries too ─────────────────────
# Map existing display names back to providers
EXISTING_PROVIDERS = {
    "GPT-5.1 Instant": "OpenAI",
    "GPT-5.1\u2020": "OpenAI",
    "Gemini 2.5 Pro": "Google",
    "Gemini 2.5 Flash": "Google",
    "Claude Sonnet 4.5": "Anthropic",
    "Claude Haiku 4.5": "Anthropic",
}
for trap in traps:
    for mt in trap.get("modelTests", []):
        if "provider" not in mt and mt["model"] in EXISTING_PROVIDERS:
            mt["provider"] = EXISTING_PROVIDERS[mt["model"]]

# ── Write updated traps.json ───────────────────────────────────────
output_path = REPO_DIR / "traps.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(traps, f, indent=2, ensure_ascii=False)

print(f"\n=== Updated traps.json written to {output_path} ===")
print(f"Total models per trap: {len(traps[0]['modelTests'])}")
