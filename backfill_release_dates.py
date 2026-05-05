"""
Add `releaseDate` (ISO date string) to every modelTests entry in traps.json.
Single source of truth for release dates — used by the Evolution view in the UI.

Idempotent: only adds/updates `releaseDate` for entries that lack it or
when the canonical map says something different. Run after adding new
models to the map below.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent
TRAPS_PATH = REPO / "traps.json"

# Canonical release dates for every model variant.
# Format: ISO YYYY-MM-DD (day = 1 if only month-precision known).
# Source: vendor announcements, plus the MODEL_RELEASE map in
# projects/cognitive-traps-jcr/v2_revision/create_final_figures.py
RELEASE_DATES = {
    # ── Anthropic ────────────────────────────────────────────────────────
    "Claude Haiku 3.0":              "2024-03-13",
    "Claude Haiku 3.5":              "2024-11-04",
    "Claude Haiku 4.5":              "2025-10-15",
    "Claude Haiku 4.5\u2020":        "2025-10-15",
    "Claude Sonnet 4.5":             "2025-09-29",
    "Claude Sonnet 4.5\u2020":       "2025-09-29",
    "Claude Sonnet 4.6":             "2026-02-17",
    "Claude Sonnet 4.6\u2020":       "2026-02-17",
    "Claude Opus 4.5":               "2025-11-24",
    "Claude Opus 4.5\u2020":         "2025-11-24",
    "Claude Opus 4.6":               "2026-02-17",
    "Claude Opus 4.6\u2020":         "2026-02-17",
    "Claude Opus 4.7":               "2026-04-16",
    "Claude Opus 4.7\u2020":         "2026-04-16",
    "Claude Opus 4.7\u2020 (xhigh)": "2026-04-16",

    # ── OpenAI ────────────────────────────────────────────────────────────
    "GPT-4o":                        "2024-05-13",
    "GPT-4o Mini":                   "2024-07-18",
    "GPT-4.1":                       "2025-04-14",
    "GPT-4.1 Mini":                  "2025-04-14",
    "GPT-5 Instant":                 "2025-08-07",
    "GPT-5\u2020":                   "2025-08-07",
    "GPT-5 Mini":                    "2025-08-07",
    "GPT-5.1 Instant":               "2025-11-13",
    "GPT-5.1\u2020":                 "2025-11-13",
    "GPT-5.2 Instant":               "2025-12-11",
    "GPT-5.2\u2020":                 "2025-12-11",
    "GPT-5.2 Pro":                   "2025-12-11",
    "GPT-5.4 Instant":               "2026-03-05",
    "GPT-5.4\u2020":                 "2026-03-05",
    "GPT-5.5 Instant":               "2026-04-23",
    "GPT-5.5\u2020":                 "2026-04-23",
    "GPT-5.5\u2020 (high)":          "2026-04-23",
    "GPT-5.5\u2020 (xhigh)":         "2026-04-23",

    # ── Google ────────────────────────────────────────────────────────────
    "Gemini 2.0 Flash":              "2025-02-05",
    "Gemini 2.5 Flash":              "2025-06-17",
    "Gemini 2.5 Flash\u2020":        "2025-06-17",
    "Gemini 2.5 Flash Lite":         "2025-06-17",
    "Gemini 2.5 Flash Lite\u2020":   "2025-06-17",
    "Gemini 2.5 Pro":                "2025-03-25",
    "Gemini 2.5 Pro\u2020":          "2025-03-25",
    "Gemini 3 Flash":                "2025-12-09",
    "Gemini 3 Flash\u2020":          "2025-12-09",
    "Gemini 3 Pro":                  "2025-11-18",
    "Gemini 3.1 Pro":                "2026-02-20",
    "Gemini 3.1 Pro\u2020":          "2026-02-20",
    "Gemini 3.1 Flash":              "2026-03-03",
    "Gemini 3.1 Flash\u2020":        "2026-03-03",
    "Gemini 3.1 Flash Lite":         "2026-03-03",
    "Gemini 3.1 Flash Lite\u2020":   "2026-03-03",
}


def main() -> None:
    with open(TRAPS_PATH, encoding="utf-8") as f:
        traps = json.load(f)

    written = 0
    unmapped = set()
    for trap in traps:
        for entry in trap.get("modelTests", []):
            display = entry.get("model", "")
            if display in RELEASE_DATES:
                if entry.get("releaseDate") != RELEASE_DATES[display]:
                    entry["releaseDate"] = RELEASE_DATES[display]
                    written += 1
            else:
                unmapped.add(display)

    if unmapped:
        print("Models without release-date mapping (add to RELEASE_DATES):")
        for m in sorted(unmapped):
            print(f"  {m!r}")
    print(f"\nWrote releaseDate on {written} entries.")
    print(f"Coverage: {sum(1 for t in traps for m in t['modelTests'] if 'releaseDate' in m)}/{sum(len(t['modelTests']) for t in traps)} entries")

    with open(TRAPS_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(traps, f, indent=2, ensure_ascii=False)
    print(f"\nSaved -> {TRAPS_PATH}")


if __name__ == "__main__":
    main()
