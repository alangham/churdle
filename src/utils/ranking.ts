import type { RankedWord, Strategy } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN SCORING (two-pass, duplicate-letter safe) — integer-encoded hot path
// ─────────────────────────────────────────────────────────────────────────────
//
// Wordle feedback for one (guess, answer) pair is computed two-pass to handle
// duplicate letters correctly:
//   Pass 1 — mark exact-position matches (green) and consume those letters from a
//            per-answer letter-count pool.
//   Pass 2 — for the rest, mark present (yellow) while the letter still has pool
//            budget, otherwise absent (gray).
// A letter therefore earns green/yellow credit only as many times as it occurs in
// the answer. The feedback is encoded as a base-3 integer (0–242), one trit per
// position (0 = absent, 1 = present, 2 = correct), so guesses can be bucketed with
// no string/object allocation. This is the difference between ~1.2 s and ~0.1 s
// when ranking 8,636 guesses against ~250 candidates in Explore mode.

const A_CODE = 97; // char code of 'a'

interface EncodedAnswer {
  codes: Uint8Array;  // 5 letter indices (0–25)
  counts: Uint8Array; // letter histogram, length 26
}

function encodeWord(word: string): Uint8Array {
  const codes = new Uint8Array(5);
  for (let i = 0; i < 5; i++) codes[i] = word.charCodeAt(i) - A_CODE;
  return codes;
}

function encodeAnswer(word: string): EncodedAnswer {
  const codes = encodeWord(word);
  const counts = new Uint8Array(26);
  for (let i = 0; i < 5; i++) counts[codes[i]]++;
  return { codes, counts };
}

// Reused scratch buffers — safe because JS is single-threaded and patternStats
// never runs reentrantly. Avoids per-call allocation in the O(G×n) hot loop.
const SCRATCH_COUNTS = new Uint8Array(26);
const SCRATCH_RESULT = new Uint8Array(5);
const SCRATCH_BUCKETS = new Int32Array(243);
const SCRATCH_TOUCHED = new Int32Array(243);

// ─────────────────────────────────────────────────────────────────────────────
// LETTER FREQUENCY ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

interface LetterFrequencies {
  // positional[pos][letter] = count of remaining answers with that letter at that position.
  positional: Record<string, number>[];
  // overall[letter] = count of remaining answers containing that letter (once per word).
  overall: Record<string, number>;
  total: number;
}

function computeLetterFrequencies(answers: string[]): LetterFrequencies {
  const positional: Record<string, number>[] = Array.from({ length: 5 }, () => ({}));
  const overall: Record<string, number> = {};

  for (const word of answers) {
    const seen = new Set<string>();
    for (let pos = 0; pos < 5; pos++) {
      const ch = word[pos];
      positional[pos][ch] = (positional[pos][ch] ?? 0) + 1;
      if (!seen.has(ch)) {
        overall[ch] = (overall[ch] ?? 0) + 1;
        seen.add(ch);
      }
    }
  }

  return { positional, overall, total: answers.length };
}

// Sum of per-position hit frequencies for each letter of the guess.
// Higher = the guess covers letter-position pairs that appear often in remaining answers.
function positionalScore(word: string, freq: LetterFrequencies): number {
  let score = 0;
  for (let pos = 0; pos < 5; pos++) {
    score += freq.positional[pos][word[pos]] ?? 0;
  }
  return score;
}

// Sum of overall presence frequency for each unique letter in the guess.
// Higher = the guess covers letters that appear often across remaining answers.
function overallScore(word: string, freq: LetterFrequencies): number {
  let score = 0;
  const seen = new Set<string>();
  for (const ch of word) {
    if (!seen.has(ch)) {
      score += freq.overall[ch] ?? 0;
      seen.add(ch);
    }
  }
  return score;
}

// Penalty for duplicate letters in the guess.
// Repeating a letter that already has a low presence rate among remaining answers wastes
// information: the extra copy tests a letter position that's unlikely to matter.
// The penalty is proportional to (1 − letter_presence_rate) per excess copy.
// No penalty when the letter appears in ≥ 40 % of remaining answers — then the duplicate
// could legitimately hit a double-letter answer (e.g., guessing STEEP when half the
// remaining answers contain E twice).
function duplicatePenalty(word: string, freq: LetterFrequencies): number {
  const counts: Record<string, number> = {};
  for (const ch of word) counts[ch] = (counts[ch] ?? 0) + 1;

  let penalty = 0;
  for (const [ch, count] of Object.entries(counts)) {
    if (count > 1) {
      const presenceRate = (freq.overall[ch] ?? 0) / freq.total;
      if (presenceRate < 0.40) {
        penalty += (count - 1) * (1 - presenceRate);
      }
    }
  }
  return penalty;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN BUCKET STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

interface PatternStats {
  // expected_remaining = Σ_buckets (bucket_size / total) × bucket_size
  //                    = Σ bucket_size² / total
  // Interpretation: the average number of candidates still possible after this guess,
  // weighted by the probability of each feedback outcome. Lower is better.
  expectedRemaining: number;

  // The size of the single largest feedback bucket.
  // Represents the worst-case scenario — the most candidates that could remain in
  // the unluckiest outcome. Lower is better.
  worstCase: number;

  // Number of distinct feedback patterns the guess can produce across the candidate set.
  // Higher generally means more information gain. The theoretical maximum is min(243, n).
  distinctPatterns: number;
}

function patternStats(guess: Uint8Array, answers: EncodedAnswer[]): PatternStats {
  const counts = SCRATCH_COUNTS;
  const r = SCRATCH_RESULT;
  const buckets = SCRATCH_BUCKETS;
  const touched = SCRATCH_TOUCHED;
  const total = answers.length;
  let touchedCount = 0;

  for (let ai = 0; ai < total; ai++) {
    const aCodes = answers[ai].codes;
    counts.set(answers[ai].counts);
    r[0] = r[1] = r[2] = r[3] = r[4] = 0;

    // Pass 1: greens consume their letter from the count pool.
    for (let i = 0; i < 5; i++) {
      const g = guess[i];
      if (g === aCodes[i]) { r[i] = 2; counts[g]--; }
    }
    // Pass 2: yellows consume remaining pool budget.
    for (let i = 0; i < 5; i++) {
      if (r[i] === 2) continue;
      const g = guess[i];
      if (counts[g] > 0) { r[i] = 1; counts[g]--; }
    }

    const pattern = r[0] + r[1] * 3 + r[2] * 9 + r[3] * 27 + r[4] * 81;
    if (buckets[pattern] === 0) touched[touchedCount++] = pattern;
    buckets[pattern]++;
  }

  // Tally metrics over only the buckets we touched, resetting them as we go so the
  // shared buffer is clean for the next guess (no full 243-wide clear needed).
  let expectedRemaining = 0;
  let worstCase = 0;
  for (let j = 0; j < touchedCount; j++) {
    const sz = buckets[touched[j]];
    expectedRemaining += (sz * sz) / total;
    if (sz > worstCase) worstCase = sz;
    buckets[touched[j]] = 0;
  }

  return { expectedRemaining, worstCase, distinctPatterns: touchedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLANATION BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildExplanation(
  stats: PatternStats,
  isAnswer: boolean,
  dupPenalty: number,
  rank: number,
  candidateCount: number,
): string {
  const parts: string[] = [];

  if (rank === 0) {
    parts.push('best split');
  } else if (stats.expectedRemaining <= 1.5) {
    parts.push('near-certain solve');
  }

  if (isAnswer && candidateCount <= 10) {
    parts.push('possible answer');
  } else if (isAnswer) {
    parts.push('in answer pool');
  }

  if (stats.worstCase === 1) {
    parts.push('guarantees solve');
  } else if (stats.worstCase <= Math.ceil(candidateCount * 0.1)) {
    parts.push(`tight worst case`);
  }

  if (dupPenalty > 0.6) {
    parts.push('dup-letter risk');
  }

  if (parts.length === 0) {
    parts.push(`${stats.distinctPatterns} split patterns`);
  }

  return parts.join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

// Threshold: above this many candidates we skip full ranking and return alphabetical.
// Solve mode: ranks only remaining answer-candidates — O(n²), max 500² = 250 K pairs.
// Explore mode: ranks every valid guess word — O(G × n) where G ≈ 8,636.
//   At n = 500 that is ~4.3 M scoring pairs; with the integer-encoded patternStats
//   this runs in ~200 ms (vs ~2.4 s for the old string-based scorer).
const RANK_THRESHOLD = 500;

export interface RankConfig {
  candidates: string[];    // remaining valid answers (filter output)
  allGuesses: string[];    // full valid-guess pool (used in explore mode)
  answerSet: Set<string>;  // fast membership test: is this word a possible answer?
  mode: Strategy;
}

export function rankCandidates(config: RankConfig): RankedWord[] {
  const { candidates, allGuesses, answerSet, mode } = config;

  if (candidates.length === 0) return [];

  // Too many candidates to rank usefully — return alphabetical list without scores.
  if (candidates.length > RANK_THRESHOLD) {
    return [...candidates].sort().map(word => ({
      word,
      expectedRemaining: null,
      worstCase: null,
      distinctPatterns: null,
      isAnswer: answerSet.has(word),
      explanation: null,
    }));
  }

  // Which words to score as potential next guesses:
  //   Solve mode  → only the remaining answer-candidates. These are words that could
  //                 actually be the answer, so guessing one might win immediately.
  //   Explore mode → every valid guess word. A non-answer word can sometimes split
  //                  the remaining candidates better than any answer word.
  const guessPool = mode === 'explore' ? allGuesses : candidates;

  const freq = computeLetterFrequencies(candidates);
  const encodedAnswers = candidates.map(encodeAnswer); // encode candidate pool once

  // Answer-word bonus applied to the composite sort key.
  // In Solve mode with very few candidates, strongly prefer answer words because
  // guessing one might end the game. In Explore mode there is no preference.
  const answerBonus = mode === 'solve' && candidates.length <= 10 ? 0.5 : 0.1;

  const scored = guessPool.map(word => {
    const stats = patternStats(encodeWord(word), encodedAnswers);
    const isAnswer = answerSet.has(word);
    const dupPen = duplicatePenalty(word, freq);
    const posScore = positionalScore(word, freq);
    const ovrScore = overallScore(word, freq);

    // Composite sort key used as primary ordering signal.
    // The tiebreaker chain below handles cases where the keys are within ε of each other.
    const sortKey = stats.expectedRemaining
      - (isAnswer ? answerBonus : 0)  // answer words get a small lift
      + dupPen * 0.02;                // duplicate-letter cost is minor — don't override splits

    return { word, stats, isAnswer, dupPen, posScore, ovrScore, sortKey };
  });

  // Multi-key sort:
  //   1. Composite sort key (expected_remaining ± bonuses/penalties) — primary
  //   2. worstCase                         — tie-breaker 1: prefer smaller worst case
  //   3. positionalScore (desc)            — tie-breaker 2: prefer letters in common positions
  //   4. overallScore (desc)               — tie-breaker 3: prefer high-frequency letters
  //   5. duplicatePenalty                  — tie-breaker 4: prefer no wasted duplicates
  const EPS = 0.001;
  scored.sort((a, b) => {
    const d = a.sortKey - b.sortKey;
    if (Math.abs(d) > EPS) return d;
    if (a.stats.worstCase !== b.stats.worstCase) return a.stats.worstCase - b.stats.worstCase;
    if (a.posScore !== b.posScore) return b.posScore - a.posScore;
    if (a.ovrScore !== b.ovrScore) return b.ovrScore - a.ovrScore;
    return a.dupPen - b.dupPen;
  });

  return scored.map(({ word, stats, isAnswer, dupPen }, rank) => ({
    word,
    expectedRemaining: stats.expectedRemaining,
    worstCase: stats.worstCase,
    distinctPatterns: stats.distinctPatterns,
    isAnswer,
    explanation: buildExplanation(stats, isAnswer, dupPen, rank, candidates.length),
  }));
}

// Rank a fixed set of guesses against a candidate pool (used for first-guess starters).
// Starters are always ranked regardless of pool size since there are only 5 of them.
export function rankGuessesAgainstPool(guesses: string[], pool: string[]): RankedWord[] {
  if (pool.length === 0) {
    return guesses.map(word => ({
      word, expectedRemaining: null, worstCase: null,
      distinctPatterns: null, isAnswer: false, explanation: null,
    }));
  }

  const answerSet = new Set(pool);
  const freq = computeLetterFrequencies(pool);
  const encodedPool = pool.map(encodeAnswer);

  const scored = guesses.map(word => {
    const stats = patternStats(encodeWord(word), encodedPool);
    const isAnswer = answerSet.has(word);
    const dupPen = duplicatePenalty(word, freq);
    return { word, stats, isAnswer, dupPen };
  });

  scored.sort((a, b) => a.stats.expectedRemaining - b.stats.expectedRemaining);

  return scored.map(({ word, stats, isAnswer, dupPen }, rank) => ({
    word,
    expectedRemaining: stats.expectedRemaining,
    worstCase: stats.worstCase,
    distinctPatterns: stats.distinctPatterns,
    isAnswer,
    explanation: buildExplanation(stats, isAnswer, dupPen, rank, pool.length),
  }));
}
