import type { GuessRow } from '../types';

export interface Constraints {
  exactPositions: Record<number, string>;              // Green: pos → letter
  wrongPositions: Record<string, number[]>;            // Yellow: letter → forbidden positions
  letterCounts: Record<string, { min: number; exact: boolean }>;
}

export function deriveConstraints(history: GuessRow[]): Constraints {
  const exactPositions: Record<number, string> = {};
  const wrongPositions: Record<string, number[]> = {};
  const letterCounts: Record<string, { min: number; exact: boolean }> = {};

  for (const row of history) {
    const rowCountGY: Record<string, number> = {};
    const rowHasGray: Set<string> = new Set();

    for (let i = 0; i < 5; i++) {
      const letter = row.word[i];
      const state = row.states[i];

      if (state === 'correct') {
        exactPositions[i] = letter;
        rowCountGY[letter] = (rowCountGY[letter] ?? 0) + 1;
      } else if (state === 'present') {
        rowCountGY[letter] = (rowCountGY[letter] ?? 0) + 1;
        if (!wrongPositions[letter]) wrongPositions[letter] = [];
        if (!wrongPositions[letter].includes(i)) wrongPositions[letter].push(i);
      } else {
        rowHasGray.add(letter);
      }
    }

    // Merge this row's letter-count info into the global constraints.
    const allLetters = new Set([...Object.keys(rowCountGY), ...rowHasGray]);
    for (const letter of allLetters) {
      const min = rowCountGY[letter] ?? 0;
      const hasGray = rowHasGray.has(letter);
      const current = letterCounts[letter] ?? { min: 0, exact: false };
      letterCounts[letter] = {
        min: Math.max(current.min, min),
        exact: current.exact || hasGray,
      };
    }
  }

  return { exactPositions, wrongPositions, letterCounts };
}
