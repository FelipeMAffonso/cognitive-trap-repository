# Cognitive Trap Repository

Community collection of visual-perceptual tasks for detecting AI agents in online surveys.

**Live site:** [https://FelipeMAffonso.github.io/cognitive-trap-repository](https://FelipeMAffonso.github.io/cognitive-trap-repository)

## What are cognitive traps?

Cognitive traps exploit architectural constraints in vision-language models: tasks that humans pass easily but AI agents fail systematically. Researchers embed them in surveys to screen for AI respondents.

The repository currently includes **7 traps** validated against **49 vision-language model variants** from Anthropic, OpenAI, and Google, spanning **March 2024 through April 2026** — for a total of **3,000 model trials**. Human validation comes from **1,178 participants** across two Prolific cohorts (validation N=171 and deployment N=1,007), and deployment data covers **526 autonomous agents** across 4 platforms (Google Project Mariner, Perplexity Comet, ChatGPT Agent, Claude Sonnet 4.5 in Cursor).

These numbers are computed live from `traps.json` and update automatically when new contributions land.

## Three ways to browse

The site offers three complementary views, all driven by the same JSON data:

1. **Browse by Trap** — card grid of every trap. Click a trap for full details (stimulus image, exact survey wording, response options, all model results filterable by source, all human-validation cohorts, all agent-deployment data, source papers).

2. **Browse by Model** — model-centric leaderboard. Three sub-views (**Cards**, **List**, **Matrix**) and four group-by modes (**None**, **Provider**, **Family**, **Thinking on/off**). Each model is profiled by *constraint category* rather than individual trap, so the view stays meaningful as new traps are added — they just bucket into existing categories. Click any model for its per-trap breakdown.

3. **Evolution over time** — interactive scatter chart of release date × pass rate. Toggle which traps to include (1 to all 6); filter by provider; filter to thinking-only or no-thinking-only models; overlay an OLS trend line, the human baseline (86.8%), and selective model labels. Filled dots = thinking on, hollow = thinking off.

## Using a trap in your survey

1. Browse the repository at the link above.
2. Pick traps that fit your survey length (2–3 traps is usually sufficient).
3. Download the stimulus image and add it to your Qualtrics/survey tool.
4. Use the question text and response options from the trap entry verbatim.
5. Pre-register your classification threshold before collecting data (e.g., "failing 2 of 3 traps = flagged").

## Submitting a new trap

Click **Submit a Trap** on the website, or [open an issue directly](https://github.com/FelipeMAffonso/cognitive-trap-repository/issues/new?template=submit-trap.yml).

You need: a stimulus image, the question/answer, and the constraint it exploits. Model testing data and human validation are optional but make the submission more useful.

## How this works

- All data lives in `traps.json` (single source of truth).
- The website is a static HTML / CSS / vanilla JS site hosted on GitHub Pages — no build step.
- Submissions come in as GitHub Issues using a structured form.
- Approved submissions are added to `traps.json` by the maintainer.

For maintainers and contributors, `CLAUDE.md` documents the full data schema, all required fields on `modelTests` entries (`config`, `releaseDate`, `isThinking`, `provider`, `method`), the architecture of all three views, and the helper scripts (`update_traps_*.py`, `backfill_*.py`, `audit_thinking_flag.py`) that keep the data clean.

## Reference

If you use traps from this repository, please cite:

> Affonso, Felipe M. (2026), "Brief Commentary: A Framework for Detecting AI Agents in Online Research," *Journal of Consumer Research*. [https://doi.org/10.1093/jcr/ucag006](https://doi.org/10.1093/jcr/ucag006)

## License

[![CC BY 4.0](https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by.svg)](https://creativecommons.org/licenses/by/4.0/)

Released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Free to use, share, and adapt (including commercially), provided you cite the original work.

## Setup (for maintainers)

1. Enable GitHub Pages (Settings → Pages → Source: main branch, root).
2. The site goes live at `https://<your-username>.github.io/cognitive-trap-repository`.
3. To add an approved trap: edit `traps.json`, add the entry, copy the image to `images/`, push.

Adding a new trap or model? Read `CLAUDE.md` first — it documents every field, the schemas, the gotchas (Anthropic 4.7 thinking schema differs from 4.5/4.6, GPT-5.4/5.5 lack `chat-latest`, Gemini 3.1 preview models may need OpenRouter fallback), and how to keep the views consistent.
