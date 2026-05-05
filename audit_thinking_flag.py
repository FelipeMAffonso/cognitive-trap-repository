"""
Explicitly classify every model variant in traps.json as thinking vs. not,
add `isThinking: true|false` to every modelTests entry, and print an audit
table for verification. No heuristics — every model is in the white-list below.

Run after adding any new model variant.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent
TRAPS_PATH = REPO / "traps.json"

# Explicit classification per display name.
# Justification column gives the rationale a maintainer can audit.
THINKING_TABLE = {
    # ── Anthropic ────────────────────────────────────────────────────────
    "Claude Haiku 3.0":              (False, "pre-extended-thinking architecture; cannot reason"),
    "Claude Haiku 3.5":              (False, "pre-extended-thinking architecture; cannot reason"),
    "Claude Haiku 4.5":               (False, "extended thinking disabled in test"),
    "Claude Haiku 4.5\u2020":         (True,  "extended thinking enabled, budget_tokens=1024"),
    "Claude Sonnet 4.5":              (False, "extended thinking disabled"),
    "Claude Sonnet 4.5\u2020":        (True,  "extended thinking enabled, budget_tokens=1024"),
    "Claude Sonnet 4.6":              (False, "extended thinking disabled"),
    "Claude Sonnet 4.6\u2020":        (True,  "extended thinking enabled, budget_tokens=1024"),
    "Claude Opus 4.5":                (False, "extended thinking disabled"),
    "Claude Opus 4.5\u2020":          (True,  "extended thinking enabled, budget_tokens=1024"),
    "Claude Opus 4.6":                (False, "extended thinking disabled"),
    "Claude Opus 4.6\u2020":          (True,  "extended thinking enabled, budget_tokens=1024"),
    "Claude Opus 4.7":                (False, "no thinking config (adaptive thinking off)"),
    "Claude Opus 4.7\u2020":          (True,  "adaptive thinking, effort=medium"),
    "Claude Opus 4.7\u2020 (xhigh)":  (True,  "adaptive thinking, effort=xhigh"),

    # ── OpenAI ────────────────────────────────────────────────────────────
    "GPT-4o":                        (False, "pre-reasoning architecture"),
    "GPT-4o Mini":                   (False, "pre-reasoning architecture"),
    "GPT-4.1":                       (False, "pre-reasoning architecture"),
    "GPT-4.1 Mini":                  (False, "pre-reasoning architecture"),
    "GPT-5 Instant":                 (False, "chat-latest endpoint, no reasoning tokens"),
    "GPT-5 Mini":                    (False, "non-reasoning fast variant"),
    "GPT-5\u2020":                   (True,  "reasoning_effort=medium (default thinking model)"),
    "GPT-5.1 Instant":               (False, "chat-latest endpoint, no reasoning tokens"),
    "GPT-5.1\u2020":                 (True,  "reasoning_effort=medium"),
    "GPT-5.2 Instant":               (False, "chat-latest endpoint, no reasoning tokens"),
    "GPT-5.2\u2020":                 (True,  "reasoning_effort=medium"),
    "GPT-5.2 Pro":                   (True,  "Responses API, reasoning_effort=high (default for Pro)"),
    "GPT-5.4 Instant":               (False, "reasoning_effort=none"),
    "GPT-5.4\u2020":                 (True,  "reasoning_effort=medium"),
    "GPT-5.5 Instant":               (False, "reasoning_effort=none"),
    "GPT-5.5\u2020":                 (True,  "reasoning_effort=medium"),
    "GPT-5.5\u2020 (high)":          (True,  "reasoning_effort=high"),
    "GPT-5.5\u2020 (xhigh)":         (True,  "reasoning_effort=xhigh"),

    # ── Google ────────────────────────────────────────────────────────────
    "Gemini 2.0 Flash":              (False, "pre-thinking architecture; no reasoning support"),
    "Gemini 2.5 Flash":              (False, "thinking_budget=0 (explicitly off)"),
    "Gemini 2.5 Flash\u2020":        (True,  "thinking_budget=-1 (dynamic)"),
    "Gemini 2.5 Flash Lite":         (False, "no thinking config (Flash Lite default = off)"),
    "Gemini 2.5 Flash Lite\u2020":   (True,  "thinking_budget=-1 (dynamic)"),
    "Gemini 2.5 Pro":                (False, "thinking_budget=128 (Pro mandatory minimum, not user-requested reasoning)"),
    "Gemini 2.5 Pro\u2020":          (True,  "thinking_budget=-1 (dynamic, user-requested)"),
    "Gemini 3 Flash":                (False, "thinking_level=minimal"),
    "Gemini 3 Flash\u2020":          (True,  "thinking_level=high"),
    "Gemini 3 Pro":                  (False, "thinking_level=low (Pro mandatory minimum)"),
    "Gemini 3.1 Pro":                (False, "thinking_level=low (Pro mandatory minimum)"),
    "Gemini 3.1 Pro\u2020":          (True,  "thinking_level=high"),
    "Gemini 3.1 Flash":              (False, "thinking_level=minimal"),
    "Gemini 3.1 Flash\u2020":        (True,  "thinking_level=high"),
    "Gemini 3.1 Flash Lite":         (False, "thinking_level=minimal"),
    "Gemini 3.1 Flash Lite\u2020":   (True,  "thinking_level=high"),
}


def main() -> None:
    with open(TRAPS_PATH, encoding="utf-8") as f:
        traps = json.load(f)

    # Audit table: show every distinct (model, contributionId) once
    seen = set()
    audit_rows = []
    written = 0
    unmapped = set()
    for trap in traps:
        for entry in trap.get("modelTests", []):
            display = entry.get("model", "")
            if display in THINKING_TABLE:
                is_thinking, reason = THINKING_TABLE[display]
                # Always overwrite to enforce single source of truth
                entry["isThinking"] = is_thinking
                written += 1
                if display not in seen:
                    audit_rows.append((display, is_thinking, reason))
                    seen.add(display)
            else:
                unmapped.add(display)

    audit_rows.sort(key=lambda r: (not r[1], r[0]))   # thinking first, then alpha
    print(f"{'Model':<35s} {'Thinking?':<12s} Reason")
    print("-" * 110)
    for display, is_thinking, reason in audit_rows:
        flag = "TRUE " if is_thinking else "false"
        print(f"  {display:<33s} {flag:<10s}  {reason}")

    n_thinking = sum(1 for _, t, _ in audit_rows if t)
    n_not = sum(1 for _, t, _ in audit_rows if not t)
    print(f"\nTotal distinct variants: {len(audit_rows)}")
    print(f"  thinking=TRUE : {n_thinking}")
    print(f"  thinking=false: {n_not}")
    print(f"\nWrote isThinking field on {written} entries across {len(traps)} traps.")

    if unmapped:
        print("\nWARNING: unmapped models (add to THINKING_TABLE):")
        for u in sorted(unmapped):
            print(f"  {u!r}")
        return  # don't save if anything is unmapped

    with open(TRAPS_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(traps, f, indent=2, ensure_ascii=False)
    print(f"\nSaved -> {TRAPS_PATH}")


if __name__ == "__main__":
    main()
