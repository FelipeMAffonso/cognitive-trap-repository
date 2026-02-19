# Cognitive Trap Repository

Community collection of visual-perceptual tasks for detecting AI agents in online surveys.

**Live site:** [https://FelipeMAffonso.github.io/cognitive-trap-repository](https://FelipeMAffonso.github.io/cognitive-trap-repository)

## What are cognitive traps?

Cognitive traps exploit architectural constraints in vision-language models: tasks that humans pass easily but AI agents fail systematically. Researchers embed them in surveys to screen for AI respondents.

## Using a trap in your survey

1. Browse the repository at the link above
2. Pick traps that fit your survey length (2-3 traps is usually sufficient)
3. Download the stimulus image and add it to your Qualtrics/survey tool
4. Use the question text and response options from the trap entry
5. Pre-register your classification threshold before collecting data (e.g., "failing 2 of 3 traps = flagged")

## Submitting a new trap

Click **Submit a Trap** on the website, or [open an issue directly](https://github.com/FelipeMAffonso/cognitive-trap-repository/issues/new?template=submit-trap.yml).

You need: a stimulus image, the question/answer, and the constraint it exploits. Model testing data and human validation are optional but make the submission more useful.

## How this works

- Traps are stored in `traps.json`
- The website is a static HTML/CSS/JS site hosted on GitHub Pages
- Submissions come in as GitHub Issues using a structured form
- Approved submissions are added to `traps.json` by the maintainer

## Citation

If you use traps from this repository, please cite:

> Affonso, F.M. (2026). Brief Commentary: Are Your Survey Respondents Human? A Framework for Detecting AI Agents in Online Research. *Journal of Consumer Research*.

## Setup (for maintainers)

1. Enable GitHub Pages (Settings > Pages > Source: main branch, root)
2. Replace `FelipeMAffonso` in all files with your GitHub username
3. The site will be live at `https://FelipeMAffonso.github.io/cognitive-trap-repository`

To add an approved trap: edit `traps.json`, add the entry, copy the image to `images/`, push.
