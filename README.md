# Churdle

A **solver assistant** for five-letter word-deduction puzzles (the Wordle-style daily game). Churdle is *not* the game — you play the puzzle wherever you normally do, then use Churdle to figure out your best next guess. You enter the guesses you've made along with the color feedback you got, and Churdle narrows the dictionary down to the words that are still possible and ranks the best words to try next.

Churdle is an original implementation. It does not use any New York Times branding, design, or word lists.

---

## Quick start

```bash
npm install
npm run dev      # then open http://localhost:3000/churdle/
```

Other scripts:

```bash
npm run build    # type-check + production bundle
npm run preview  # serve the production build
npm run lint     # ESLint
```

---

## How to use it

1. **Enter a guess.** Type a five-letter word, or click one of the suggestions on the right to drop it into the **Next guess** row.
2. **Mark the feedback.** Click each tile to cycle its color to match what the puzzle showed you:
   **Gray → Yellow → Green → Gray** (click again to keep cycling).
   - **Green** — right letter, right position
   - **Yellow** — letter is in the word, wrong position
   - **Gray** — letter is not in the word
3. **Submit** (button or `Enter`). Churdle filters the word list to everything still consistent with all your clues and re-ranks the suggestions.
4. **Repeat.** Click the suggestion you want to play next (or type your own), mark its feedback, and submit again. Keep going until you've solved it.

You can always type a word manually instead of picking from the list — the input never restricts you to the suggestions.

### Keyboard

- **Letter keys** — type into the next-guess row
- **Backspace** — delete the last letter
- **Enter** — submit the guess

---

## Features

### Suggested starters
Before your first guess, the right panel shows a small curated set of strong opening words — **SALET, SLATE, CRATE, TRACE, CRANE**, plus **TIERS** pinned at the end — ranked by how well they split the answer pool. Pick whichever you like, or ignore them and type your own opener.

### Auto-marked greens
Once a position is confirmed **green** by an earlier guess, Churdle automatically marks that same letter green when it appears in that position in your next guess — whether you typed the word or clicked a suggestion. You can still click any tile to override it.

### SOLVE / EXPLORE
A toggle above the suggestion list controls *which words get ranked* as your next guess:

| Mode | What it ranks | When to use it |
|------|---------------|----------------|
| **SOLVE** (default) | Only the words that are still possible answers. Every suggestion could win outright. With ≤ 10 candidates left it leans even harder toward words that could be the answer. | Most of the time, and especially when you're close. |
| **EXPLORE** | *Every* valid guess word (~8,600), including words that **cannot** be the answer. A non-answer word is often the best way to split the remaining possibilities. | When lots of candidates remain and you want maximum information from one guess. |

In EXPLORE mode, words that can't be the answer are labeled **"not a possible answer"** and have no ◆ badge — they're pure information probes. The header shows how many real answers are still possible, e.g. *"57 possible answers left — ranking all 8,636 guesses."*

### UNDO LAST
Removes your most recent guess and recomputes the suggestions from the remaining ones. Useful if you mis-marked a tile. It only appears once you have at least one guess.

### RESET
Clears every guess and feedback and returns to the starting "Suggested starters" view.

### Light / dark theme
The ☀ / ☾ button in the header toggles light and dark mode. Your choice is saved and restored the next time you open Churdle.

### Big lists load as you scroll
EXPLORE can rank thousands of words. The list renders the top 100 first and loads more as you scroll, so it stays responsive.

---

## Reading a suggestion

Each row shows the word, an optional badge, three numbers, and a short explanation:

```
COMIC ◆        ~3.0 · ↑6 · 27p
in answer pool
```

| Element | Meaning |
|---------|---------|
| **◆** | This word still satisfies all your clues — it could be the answer. (Absent on EXPLORE probe words.) |
| **~3.0** | **Expected remaining** — the average number of candidates that would still be left after playing this word. **Lower is better.** |
| **↑6** | **Worst case** — the most candidates that could remain on the unluckiest feedback. Lower is safer. |
| **27p** | **Distinct patterns** — how many different feedback results this word can produce across the remaining candidates. More patterns ≈ more information. |
| explanation | A short reason, e.g. *best split*, *possible answer*, *guarantees solve*, *near-certain solve*, *not a possible answer*, *strong probe*, *dup-letter risk*. |

---

## How the ranking works

For every word being considered as a next guess, Churdle simulates it against **every remaining candidate answer** and groups those answers by the exact feedback pattern the guess would produce. A guess that scatters the candidates into many small groups is better than one that leaves them lumped together.

**Feedback scoring** uses a two-pass algorithm so repeated letters are handled correctly: first all exact-position (green) matches are taken and "used up" from the answer's letter counts, then the remaining letters compete for yellows against whatever counts are left. A letter therefore earns green/yellow credit only as many times as it actually occurs in the answer.

From the groups, each guess gets three metrics (the three numbers above):

- **Expected remaining** = Σ (group size²) ÷ total candidates — the probability-weighted average of how many candidates survive. **Primary ranking signal; lower is better.**
- **Worst case** = size of the largest group.
- **Distinct patterns** = number of groups.

Suggestions are sorted by a composite score (expected remaining, with a small bonus for words that could actually be the answer and a small penalty for wasteful duplicate letters), and ties are broken in this order:

1. smaller **worst case**
2. higher **positional letter frequency** among remaining answers
3. higher **overall letter frequency** among remaining answers
4. fewer wasted duplicate letters

The duplicate-letter penalty only applies when the repeated letter is unlikely to appear twice in the remaining answers, so Churdle won't discourage a doubled letter when a double genuinely makes sense.

When more than ~500 candidates remain, ranking is skipped (it wouldn't be meaningful yet) and the list is shown alphabetically with a "refine further" note.

---

## Word lists

Two lists live in `src/utils/words.ts`, both derived from the public-domain **ENABLE** dictionary, with word frequencies from Peter Norvig's public-domain `count_1w` corpus:

- **Valid guesses (8,636)** — every five-letter ENABLE word. Used to validate what you type and as the EXPLORE probe pool.
- **Possible answers (4,507)** — the guess list minus (a) words that never appear in the frequency corpus (obscure Scrabble-only words like *aahed* that are never real answers) and (b) simple plurals/inflections ending in `-s`/`-es`/`-ies`/`-ed`. This mirrors how real answer lists omit plural nouns, while staying broad enough that the solver won't miss a genuinely uncommon answer.

---

## Tech

React + Vite + TypeScript, with CSS Modules for styling. All solver logic runs in the browser — there is no backend. See [CLAUDE.md](CLAUDE.md) for architecture notes.
