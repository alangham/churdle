import type { Constraints } from './constraints';

export function filterWords(
  wordList: string[],
  constraints: Constraints,
  usedWords: string[],
): string[] {
  const usedSet = new Set(usedWords);
  const { exactPositions, wrongPositions, letterCounts } = constraints;

  return wordList.filter(word => {
    if (usedSet.has(word)) return false;

    // Green: exact positions must match.
    for (const [pos, letter] of Object.entries(exactPositions)) {
      if (word[+pos] !== letter) return false;
    }

    // Letter count constraints.
    for (const [letter, { min, exact }] of Object.entries(letterCounts)) {
      let count = 0;
      for (const ch of word) if (ch === letter) count++;
      if (count < min) return false;
      if (exact && count !== min) return false;
    }

    // Yellow: letter must not appear at its forbidden positions.
    for (const [letter, positions] of Object.entries(wrongPositions)) {
      for (const pos of positions) {
        if (word[pos] === letter) return false;
      }
    }

    return true;
  });
}
