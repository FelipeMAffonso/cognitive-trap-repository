"""
Back-fill the 'config' tooltip metadata onto every existing modelTests entry.
Idempotent: only adds/updates 'config' for entries that lack it.

After this script: every model row in the UI will surface its exact
reasoning-effort / thinking-level / thinking-budget parameters via the
title-attribute tooltip and the ⓘ marker.
"""
import json
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent
TRAPS_PATH = REPO_DIR / "traps.json"

# Map display name -> human-readable config string.
# Derived from the original test_models.py defaults at the time each model
# was tested (Feb 2026 baseline run for the unified affonso-2026 contribution).
CONFIG_BY_DISPLAY = {
    # ── Anthropic ────────────────────────────────────────────────────────
    "Claude Haiku 3.0":              "no thinking (model does not support reasoning)",
    "Claude Haiku 3.5":              "no thinking (model does not support reasoning)",
    "Claude Haiku 4.5":              "no thinking (extended thinking disabled)",
    "Claude Haiku 4.5\u2020":        "extended thinking, budget_tokens=1024",
    "Claude Sonnet 4.5":             "no thinking (extended thinking disabled)",
    "Claude Sonnet 4.5\u2020":       "extended thinking, budget_tokens=1024",
    "Claude Opus 4.5":               "no thinking (extended thinking disabled)",
    "Claude Opus 4.5\u2020":         "extended thinking, budget_tokens=1024",
    "Claude Sonnet 4.6":             "no thinking (extended thinking disabled)",
    "Claude Sonnet 4.6\u2020":       "extended thinking, budget_tokens=1024",
    "Claude Opus 4.6":               "no thinking (extended thinking disabled)",
    "Claude Opus 4.6\u2020":         "extended thinking, budget_tokens=1024",

    # ── OpenAI (Chat Completions API; thinking models default to medium) ──
    "GPT-4o":                        "no reasoning (pre-reasoning architecture)",
    "GPT-4o Mini":                   "no reasoning (pre-reasoning architecture)",
    "GPT-4.1":                       "no reasoning (pre-reasoning architecture)",
    "GPT-4.1 Mini":                  "no reasoning (pre-reasoning architecture)",
    "GPT-5 Instant":                 "chat-latest (no reasoning tokens)",
    "GPT-5 Mini":                    "default reasoning",
    "GPT-5\u2020":                   "reasoning_effort=medium (default)",
    "GPT-5.1 Instant":               "chat-latest (no reasoning tokens)",
    "GPT-5.1\u2020":                 "reasoning_effort=medium (default)",
    "GPT-5.2 Instant":               "chat-latest (no reasoning tokens)",
    "GPT-5.2\u2020":                 "reasoning_effort=medium (default)",
    "GPT-5.2 Pro":                   "Responses API, reasoning_effort=high (default)",

    # ── Google ────────────────────────────────────────────────────────────
    "Gemini 2.0 Flash":              "no thinking (model does not support reasoning)",
    "Gemini 2.5 Flash":              "thinking_budget=0 (off)",
    "Gemini 2.5 Flash\u2020":        "thinking_budget=-1 (dynamic)",
    "Gemini 2.5 Flash Lite":         "no thinking config (Flash Lite default)",
    "Gemini 2.5 Flash Lite\u2020":   "thinking_budget=-1 (dynamic)",
    "Gemini 2.5 Pro":                "thinking_budget=128 (Pro minimum)",
    "Gemini 2.5 Pro\u2020":          "thinking_budget=-1 (dynamic)",
    "Gemini 3 Flash":                "thinking_level=minimal",
    "Gemini 3 Flash\u2020":          "thinking_level=high",
    "Gemini 3 Pro":                  "thinking_level=low (Pro minimum)",
}


def main() -> None:
    with open(TRAPS_PATH, encoding="utf-8") as f:
        traps = json.load(f)

    backfilled = 0
    unmapped = set()
    total_modeltests = 0

    for trap in traps:
        for entry in trap.get("modelTests", []):
            total_modeltests += 1
            if entry.get("config"):
                continue  # already has config (either May 2026 or prior backfill run)
            display = entry.get("model", "")
            if display in CONFIG_BY_DISPLAY:
                entry["config"] = CONFIG_BY_DISPLAY[display]
                backfilled += 1
            else:
                unmapped.add(display)

    # Stats
    with_config_after = sum(1 for t in traps for m in t["modelTests"] if m.get("config"))

    print(f"Total modelTests entries: {total_modeltests}")
    print(f"Back-filled this run:     {backfilled}")
    print(f"Have config now:          {with_config_after}/{total_modeltests}")
    if unmapped:
        print(f"\nUnmapped display names (not in CONFIG_BY_DISPLAY):")
        for u in sorted(unmapped):
            print(f"  {u!r}")
    else:
        print("\nAll model entries now have config metadata.")

    with open(TRAPS_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(traps, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {TRAPS_PATH}")


if __name__ == "__main__":
    main()
