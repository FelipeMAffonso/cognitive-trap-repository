# Cognitive Trap Repository — Architecture & Maintenance Guide

This file documents the repository so any future maintenance / update is fast.

## What this repo is

A static GitHub Pages site at https://FelipeMAffonso.github.io/cognitive-trap-repository
that hosts a community-curated database of cognitive traps for detecting AI
agents in online surveys. Companion to Affonso (2026), JCR.

- **Live URL:** https://FelipeMAffonso.github.io/cognitive-trap-repository
- **Repo:** https://github.com/FelipeMAffonso/cognitive-trap-repository
- **License:** CC BY 4.0
- **Hosting:** GitHub Pages (master branch, root)

## Stack & file map

Pure static HTML + CSS + vanilla JS, no framework, no build step.
Push to `master` and Pages serves it.

```
.
├── index.html         # Landing page (3 top views: Traps, Models, Evolution)
├── submit.html        # GitHub-issue–based submission form
├── app.js             # All client logic (~1500 lines, single IIFE)
├── style.css          # All styles
├── traps.json         # ── SINGLE SOURCE OF TRUTH ── all data lives here
├── images/            # Trap stimulus PNGs (one per trap)
├── README.md          # Public README
├── LICENSE            # CC BY 4.0
├── CLAUDE.md          # This file
├── update_traps_may2026.py     # Merge May 2026 trial data → traps.json
├── backfill_config_metadata.py # Add `config` strings to old entries
├── backfill_release_dates.py   # Add `releaseDate` to all entries
└── .github/ISSUE_TEMPLATE/
    └── submit-trap.yml         # Structured "submit a trap" form
```

## Single source of truth: `traps.json`

Top-level is an array of trap objects. **Every UI number is computed from this
file at load time. Do not hardcode numbers in HTML/CSS/JS.**

### Trap object schema

```json
{
  "id": "modified-cafe-wall",                 // kebab-case slug, used in URLs
  "name": "Modified Cafe Wall",               // display name
  "category": "Data Overfitting",             // architectural-constraint bucket
  "description": "...",
  "question": "...",                          // exact survey wording
  "correctAnswer": "Slanted / Diagonal",
  "responseOptions": ["Straight / Horizontal", "Slanted / Diagonal"],
  "image": "images/modified-cafe-wall.png",
  "constraintExploited": "Training data overfitting...",
  "sourcePapers": ["...", "..."],             // citations supporting the trap

  "contributions": [                          // who contributed which data
    {
      "id": "affonso-2026",
      "contributor": "Affonso (2026)",
      "date": "2026-02-18",
      "type": "original",                     // "original" | "update" | "external"
      "description": "..."
    }
  ],

  "humanStudies": [                           // human validation cohorts
    {
      "label": "Affonso (2026), validation study",
      "passRate": 0.832,
      "sampleSize": 171,
      "platform": "Prolific",
      "source": "Affonso (2026), Table 3",
      "cohortId": "affonso-2026-validation",  // dedupe within-subjects designs
      "contributionId": "affonso-2026"        // links to contributions[]
    }
  ],

  "modelTests": [                             // 1 entry per model variant
    {
      "model": "Claude Opus 4.7\u2020 (xhigh)",  // display name († = thinking)
      "passRate": 0.0,                        // 0.0–1.0
      "trials": 10,                           // sample size
      "provider": "Anthropic",
      "method": "API",                        // "API" | "Chat Interface"
      "config": "adaptive thinking, effort=xhigh",  // tooltip text (REQUIRED)
      "releaseDate": "2026-04-16",            // ISO date (REQUIRED)
      "source": "Affonso (2026)",
      "contributionId": "affonso-2026-may"
    }
  ],

  "agentTests": [                             // autonomous agent platforms
    {
      "agent": "ChatGPT Agent",
      "failureRate": null,                    // null = pooled in pooledAgentResults
      "sampleSize": 129,
      "source": "Affonso (2026)",
      "contributionId": "affonso-2026"
    }
  ],

  "pooledAgentResults": {                     // pre-computed pooled stats
    "failureRate": 0.949,
    "sampleSize": 526,
    "humanPassRate": 0.832,
    "humanSampleSize": 1007,
    "discriminationPP": 81.7,                 // recomputed dynamically by JS, but stored here too
    "chiSq": 1062.4,
    "source": "Affonso (2026), Table 5"
  }
}
```

### Required fields on every modelTests entry
- `model` — display name (use `\u2020` for thinking variants by convention)
- `passRate` — 0.0 to 1.0
- `trials` — integer sample size
- `provider` — "Anthropic" | "OpenAI" | "Google" (matters for color coding)
- `method` — "API" or "Chat Interface"
- `config` — human-readable tooltip string (e.g., "reasoning_effort=high",
  "thinking_budget=128", "extended thinking, budget_tokens=1024",
  "no thinking (model does not support reasoning)")
- `releaseDate` — ISO YYYY-MM-DD; needed by Evolution view
- `source` — short attribution
- `contributionId` — must match an entry in the trap's `contributions[]`

### Categories (used by Browse-by-Model view's category aggregation)
The Cards view aggregates each model's pass rate per category. Adding a new
category in any trap's `category` field automatically creates a new bucket —
no JS changes needed.

Current categories: Data Overfitting, Spatial Reasoning, Spatiotemporal
Reasoning, Cross-Modal Binding, Compositional Counting.

## How the UI views work

Three top-level views, all driven by `traps.json`:

### 1. Browse by Trap (default)
- Card grid of all traps
- Click → modal with full per-trap detail (humans, models, agents)
- Per-trap modal: filterable model table, sortable columns, source-attribution

### 2. Browse by Model
- Three sub-views: **Cards** (default) / **List** / **Matrix**
- Four group-by modes: **None** / **Provider** / **Family** / **Thinking on/off**
- Five filters: All / Anthropic / OpenAI / Google / Thinking only / No-thinking only
- All sorts/filters operate on the FULL aggregated dataset
- Cards view organizes data by **constraint category** (not by individual trap),
  so the view stays meaningful as new traps are added — they bucket into existing
  categories
- Click any model → modal with per-trap breakdown for that model

### 3. Evolution (planned/in-progress)
- Scatter or line chart: model release date (X) × pass rate (Y)
- Multi-trap selectable overlay, provider color-coded
- Mimics fig2_evolution_lines from the paper

## How to update — common tasks

### Add a new model's results across existing traps

1. Run new trials with `projects/cognitive-traps-jcr/v2_revision/test_models.py`
   (already supports adding new MODELS dict entries; supports OpenRouter fallback
   for Google preview models). Keys to know:
   - Anthropic 4.7+ uses `thinking.type=adaptive` + `output_config.effort` (low/medium/high/xhigh)
   - Anthropic 4.5/4.6 uses `thinking.type=enabled` + `budget_tokens`
   - OpenAI 5.x thinking takes `reasoning_effort` (none/low/medium/high/xhigh)
   - Google Gemini 2.5 uses `thinking_budget`; Gemini 3.x uses `thinking_level`
   - OpenAI Pro variants (5.2-pro, 5.4-pro, 5.5-pro) require Responses API
   - GPT-5.4-pro / GPT-5.5-pro at default (high) effort are slow (~5–7 min/call) —
     either skip or pass `effort=medium` to keep latency reasonable

2. Trial CSVs land in `projects/cognitive-traps-jcr/v2_revision/data/`.

3. Build a one-shot merge script (model after `update_traps_may2026.py`):
   - Load CSVs → compute pass rate per (model, trap)
   - Map model_key → display name + provider + method + config + releaseDate
   - Add a new contribution entry (e.g., `affonso-2026-jul`) at top of each trap
   - Append modelTests entries with `contributionId` pointing at it
   - Save traps.json

4. Run `python backfill_release_dates.py` to ensure new models have releaseDate
   (and add their entries to RELEASE_DATES at top of that script first).

5. Run `python backfill_config_metadata.py` if any old entries are missing
   `config`.

6. `git commit && git push origin master`. Pages updates within ~1 minute.

### Add a new trap

1. Pick a stimulus image, place in `images/<slug>.png`.
2. Add a new top-level object in `traps.json` following the schema above.
3. Required fields: id, name, category, description, question, correctAnswer,
   responseOptions, image, constraintExploited, contributions, humanStudies (if any),
   modelTests (if tested), sourcePapers.
4. If you don't have data yet, leave `modelTests: []`, `agentTests: []`, etc. —
   the UI degrades gracefully.
5. Push.

### Add a new contributor's data

Submissions come in via GitHub issues using `.github/ISSUE_TEMPLATE/submit-trap.yml`.
Maintainer:
1. Adds a new entry in `contributions[]` with their attribution and a unique id.
2. Tags their data points with that `contributionId` (modelTests, humanStudies, agentTests).
3. UI automatically shows source filter chips when >1 contributor is present.

### Add a new constraint category

Just use the new category string in any trap's `category` field. The Cards view's
category aggregation uses `Object.keys(byCat).sort()` — new categories appear
automatically.

## Hardcoded-numbers audit

Anything that looks like a number must be derived from `traps.json`. The only
exception is the discrimination-tooltip explainer in app.js (~line 770) which
uses example numbers ("If agents fail 94.1% and humans fail 7.2%, discrimination
= 86.9pp") — that's a *teaching example*, not a claim about current data.

If you change something that affects displayed numbers, run:
```bash
grep -nE '\b34\b|\b2,?040\b|\b1,?007\b|\b171\b|\b526\b' index.html submit.html README.md
```
If anything pops up that's not in `traps.json` itself, fix it (or make it dynamic
via a placeholder span + JS lookup, like `#hero-model-count`).

## Pricing for new model trials (rough)
- Anthropic Opus 4.7 thinking: ~$0.04/call (60 calls = $2.40)
- OpenAI GPT-5.5 thinking: ~$0.02/call · GPT-5.5 Pro: ~$0.40/call (avoid)
- Google Gemini 3.x: ~$0.001–$0.002/call (very cheap)
- Budget for a full new-model refresh (15 variants × 6 traps × 10 trials, no Pros): ~$8

## Companion JCR project

Source data and stimuli live in `projects/cognitive-traps-jcr/`:
- `v2_revision/data/` — raw trial CSVs from the original + May 2026 runs
- `OSF/code/python/test_models.py` — same as v2_revision/test_models.py
- `media/media/Stimuli/` — original stimulus images (Cafe Wall, etc.)

When updating the repo, prefer producing CSVs in the JCR project and merging
into the repo via a one-shot script (so the JCR project remains the data
warehouse and the repo remains the publication-quality presentation).

## Things that have caught me before

1. **Sort + pagination**: Sorting must reapply visibility based on new
   indices, not the original render order. See `app.js` model-table sortable
   handler — the fix re-walks rows and resets `model-row-hidden` after
   re-appending in sorted order.

2. **GPT-5 Pro variants are slow.** Default reasoning_effort is high and each
   call takes 5–7 minutes. Either pass `effort=medium` in test_models.py or
   skip Pro variants and document it.

3. **Anthropic 4.7+ uses a different thinking schema** than 4.5/4.6 (adaptive
   + output_config.effort vs. enabled + budget_tokens). The call_anthropic
   function in test_models.py branches on model_id.

4. **GPT-5.4 and GPT-5.5 don't have a `chat-latest` variant.** Use the unified
   `gpt-5.5` (or `gpt-5.4`) model_id with `reasoning_effort=none` to get the
   no-thinking path.

5. **Gemini 3.1 preview models may not be in the direct Google API.** OpenRouter
   fallback is wired via `OPENROUTER_API_KEY` in `.env`. The call_google function
   catches exceptions and retries via `call_openrouter` for known fallback slugs.

6. **traps.json is large (~3MB).** Editing it by hand is error-prone — prefer
   one-shot Python scripts that load, mutate, and save back with `indent=2,
   ensure_ascii=False`.

7. **`pooledAgentResults` lives separate from `agentTests`.** The pooled stats
   are pre-computed; the JS `getPooled()` recomputes discrimination dynamically
   from `pooledAgentResults.failureRate` + `humanStudies` aggregated humanPassRate.
   So adding model tests does NOT change agent stats (correct behavior).

8. **`config` field is required for the tooltip system** — `backfill_config_metadata.py`
   ensures coverage. Run it after any bulk insert.
