# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Type-check then bundle (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # Serve the production build locally
```

There are no automated tests. Verification is done by running the dev server and exercising the UI.

## What This App Is

Churdle is a **Wordle solver assistant** — not a Wordle game. The user plays an external Wordle puzzle, enters each guess here and marks the tile feedback they received (green/yellow/gray), and the app progressively narrows a word list to ranked candidates for the next guess.

## Architecture

State lives entirely in `src/hooks/useSolver.ts` via a single `useReducer`. Components are pure presentational. No external state library.

```
useSolver (reducer + keyboard listener)
  └─ dispatches: TYPE | DELETE | CYCLE_TILE | SUBMIT | UNDO | CLICK_CANDIDATE | SET_STRATEGY | RESET | DISMISS_TOAST
  └─ on SUBMIT/UNDO/SET_STRATEGY: deriveConstraints → filterWords → rankCandidates
```

The data flow on each submitted guess:
1. `deriveConstraints(history)` → `Constraints` (green positions, yellow forbidden positions, letter count bounds)
2. `filterWords(ANSWER_LIST, constraints, usedWords)` → filtered `string[]`
3. `rankCandidates({ candidates, allGuesses, answerSet, mode })` → `RankedWord[]`

## Word Lists

`src/utils/words.ts` exports two arrays (lowercase). The dictionary source is the public-domain ENABLE word list; answer-pool curation additionally uses Peter Norvig's public-domain `count_1w` frequency list (Google Web Trillion Word Corpus).

- **`WORD_LIST`** (8,636 words) — every valid 5-letter ENABLE word. Used for input validation and as the Explore-mode probe pool. (ENABLE is kept as the source rather than larger lists like dwyl/words_alpha, whose extra 5-letter entries are mostly junk/non-words.)
- **`ANSWER_LIST`** (4,507 words) — likely answer candidates. Built from `WORD_LIST` by (1) requiring the word to appear in the frequency corpus at all — this drops ~1,200 zero-frequency Scrabble-only words (e.g. `aahed`, `zoeae`) that are never real answers, while keeping every word with genuine usage so the solver does not miss uncommon-but-real answers (e.g. `swung`, `satyr` are kept); and (2) excluding simple plurals/inflections (`-s`/`-es`/`-ies`/`-ed` where the stem is itself a word).

`STARTER_WORDS` in `useSolver.ts` are merged into `VALID_GUESSES` explicitly because some (e.g. SALET) are not in ENABLE.

To regenerate: download ENABLE (`enable1.txt`) and Norvig `count_1w.txt`, then for each ENABLE 5-letter word emit it to `WORD_LIST`, and to `ANSWER_LIST` only if it appears in `count_1w` and is not an inflection (stem-existence check against the 3-/4-letter ENABLE words). The conservative "appears in corpus at all" floor was chosen over stricter frequency thresholds because a solver must not exclude a genuinely uncommon answer.

## Ranking Algorithm

`src/utils/ranking.ts` — the core solver logic. Two public functions:

**`rankCandidates(config)`** — used after each submitted guess.
- Skips ranking when `candidates.length > 500`; returns alphabetical list with null metrics.
- **Solve mode**: scores only the remaining answer-candidates against each other.
- **Explore mode**: scores all 8,636 valid words against the remaining candidates (~4M scoring calls at n=500, 200–400 ms).
- Sort key: `expectedRemaining − answerBonus + dupPenalty × 0.02`, then tiebreak by `worstCase → positionalScore↓ → overallScore↓ → dupPenalty`.
- Answer bonus is 0.5 in Solve mode with ≤10 candidates, 0.1 otherwise.

**`rankGuessesAgainstPool(guesses, pool)`** — used only for the initial 5 starter words, ranked against the full ANSWER_LIST.

**Pattern scoring** (`scoreGuess`, internal) uses a two-pass algorithm:
1. Pass 1: mark exact matches (green), consume from a letter frequency pool.
2. Pass 2: mark present matches (yellow) from remaining pool budget, then gray.

This correctly handles duplicate letters — a letter only receives yellow/green credit as many times as it appears in the answer.

**`expectedRemaining`** = Σ(bucket_size²) / total across all feedback-pattern buckets. Lower is better.

## Constraint Logic

`src/utils/constraints.ts` — `deriveConstraints(history)` produces three structures:

- `exactPositions` — green tiles: position → required letter
- `wrongPositions` — yellow tiles: letter → list of forbidden positions
- `letterCounts` — per letter: `{ min, exact }`. `exact: true` is set when a gray tile appears for that letter in any guess, meaning the answer has *exactly* `min` copies of it (no more).

The duplicate-letter case: if a guess has two E's and Wordle marks one yellow and one gray, `letterCounts.e = { min: 1, exact: true }`. This is correctly derived because the gray sets `exact: true` while the yellow contributes `min: 1`.

## TypeScript Strictness

`tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `noFallthroughCasesInSwitch`. Unused imports are errors. Run `npm run build` (or `npx tsc --noEmit`) to catch these before serving.
