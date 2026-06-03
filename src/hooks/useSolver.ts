import { useReducer, useEffect, useCallback } from 'react';
import { WORD_LIST, ANSWER_LIST } from '../utils/words';
import { deriveConstraints } from '../utils/constraints';
import { filterWords } from '../utils/filter';
import { rankCandidates, rankGuessesAgainstPool } from '../utils/ranking';
import type { GuessRow, RankedWord, SolverState, Strategy, TileState } from '../types';

type Action =
  | { type: 'TYPE'; letter: string }
  | { type: 'DELETE' }
  | { type: 'CYCLE_TILE'; index: number }
  | { type: 'SUBMIT' }
  | { type: 'UNDO' }
  | { type: 'CLICK_CANDIDATE'; word: string }
  | { type: 'SET_STRATEGY'; strategy: Strategy }
  | { type: 'RESET' }
  | { type: 'DISMISS_TOAST' };

// Ranked starters are sorted by expected eliminations; pinned starters are always
// shown after them, in source order, regardless of their score.
const RANKED_STARTERS = ['salet', 'slate', 'crane', 'trace', 'crate'];
const PINNED_STARTERS = ['tiers'];
const STARTER_WORDS = [...RANKED_STARTERS, ...PINNED_STARTERS];

// Include starters explicitly — some (e.g. SALET) may not appear in the ENABLE list.
const VALID_GUESSES = new Set([...WORD_LIST, ...STARTER_WORDS]);

const BLANK_STATES: TileState[] = ['absent', 'absent', 'absent', 'absent', 'absent'];

function initialCandidates(): RankedWord[] {
  // Rank all starters together so ranks/explanations are accurate, then move the
  // pinned ones to the end while preserving the ranked order of the rest.
  const all = rankGuessesAgainstPool(STARTER_WORDS, ANSWER_LIST);
  const pinnedSet = new Set(PINNED_STARTERS);
  return [
    ...all.filter(w => !pinnedSet.has(w.word)),
    ...all.filter(w => pinnedSet.has(w.word)),
  ];
}

function getInitialState(): SolverState {
  return {
    history: [],
    activeWord: '',
    activeTileStates: [...BLANK_STATES],
    candidates: initialCandidates(),
    strategy: 'solve',
    toast: null,
  };
}

const CYCLE: Record<TileState, TileState> = {
  absent: 'present',
  present: 'correct',
  correct: 'absent',
};

// Positions whose correct letter is already confirmed green from earlier guesses.
// Returns position → lowercase letter.
function knownGreens(history: GuessRow[]): Record<number, string> {
  const greens: Record<number, string> = {};
  for (const row of history) {
    for (let i = 0; i < 5; i++) {
      if (row.states[i] === 'correct') greens[i] = row.word[i];
    }
  }
  return greens;
}

// A freshly placed letter auto-marks green when it sits on a confirmed-green
// position; otherwise it starts gray. The user can still cycle it manually.
function autoState(letter: string, pos: number, greens: Record<number, string>): TileState {
  return greens[pos] === letter.toLowerCase() ? 'correct' : 'absent';
}

function solverReducer(state: SolverState, action: Action): SolverState {
  switch (action.type) {
    case 'TYPE': {
      if (state.activeWord.length >= 5) return state;
      const pos = state.activeWord.length;
      const letter = action.letter.toUpperCase();
      const newStates = [...state.activeTileStates] as TileState[];
      newStates[pos] = autoState(letter, pos, knownGreens(state.history));
      return {
        ...state,
        activeWord: state.activeWord + letter,
        activeTileStates: newStates,
        toast: null,
      };
    }

    case 'DELETE': {
      if (state.activeWord.length === 0) return state;
      const pos = state.activeWord.length - 1;
      const newStates = [...state.activeTileStates] as TileState[];
      newStates[pos] = 'absent';
      return {
        ...state,
        activeWord: state.activeWord.slice(0, -1),
        activeTileStates: newStates,
        toast: null,
      };
    }

    case 'CYCLE_TILE': {
      const { index } = action;
      if (index >= state.activeWord.length) return state;
      const newStates = [...state.activeTileStates] as TileState[];
      newStates[index] = CYCLE[newStates[index]];
      return { ...state, activeTileStates: newStates };
    }

    case 'SUBMIT': {
      if (state.activeWord.length !== 5) {
        return { ...state, toast: 'Enter a 5-letter word first' };
      }
      if (!VALID_GUESSES.has(state.activeWord.toLowerCase())) {
        return { ...state, toast: 'Not a recognised word' };
      }

      const newRow: GuessRow = {
        word: state.activeWord.toLowerCase(),
        states: [...state.activeTileStates] as TileState[],
      };
      const newHistory = [...state.history, newRow];
      const constraints = deriveConstraints(newHistory);
      const usedWords = newHistory.map(r => r.word);
      const filtered = filterWords(ANSWER_LIST, constraints, usedWords);

      const ranked = rankCandidates({
        candidates: filtered,
        allGuesses: WORD_LIST,
        mode:state.strategy,
      });

      return {
        ...state,
        history: newHistory,
        activeWord: '',
        activeTileStates: [...BLANK_STATES],
        candidates: ranked,
        toast: null,
      };
    }

    case 'CLICK_CANDIDATE': {
      const word = action.word.toUpperCase();
      const greens = knownGreens(state.history);
      const newStates = Array.from({ length: 5 }, (_, i) =>
        autoState(word[i], i, greens),
      ) as TileState[];
      return {
        ...state,
        activeWord: word,
        activeTileStates: newStates,
        toast: null,
      };
    }

    case 'SET_STRATEGY': {
      // Re-rank existing candidates under the new strategy if they're already ranked.
      // If candidates are unranked (too many), switching mode has no visual effect yet —
      // it will take effect on the next guess submission.
      if (state.history.length === 0) {
        return { ...state, strategy: action.strategy };
      }
      const constraints = deriveConstraints(state.history);
      const usedWords = state.history.map(r => r.word);
      const filtered = filterWords(ANSWER_LIST, constraints, usedWords);
      const ranked = rankCandidates({
        candidates: filtered,
        allGuesses: WORD_LIST,
        mode:action.strategy,
      });
      return { ...state, strategy: action.strategy, candidates: ranked };
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const newHistory = state.history.slice(0, -1);
      if (newHistory.length === 0) {
        // Back to start — restore initial starter list.
        return { ...getInitialState(), strategy: state.strategy };
      }
      const constraints = deriveConstraints(newHistory);
      const usedWords = newHistory.map(r => r.word);
      const filtered = filterWords(ANSWER_LIST, constraints, usedWords);
      const ranked = rankCandidates({
        candidates: filtered,
        allGuesses: WORD_LIST,
        mode:state.strategy,
      });
      return { ...state, history: newHistory, candidates: ranked, toast: null };
    }

    case 'RESET':
      return getInitialState();

    case 'DISMISS_TOAST':
      return { ...state, toast: null };

    default:
      return state;
  }
}

export function useSolver() {
  const [state, dispatch] = useReducer(solverReducer, undefined, getInitialState);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter') {
      dispatch({ type: 'SUBMIT' });
    } else if (e.key === 'Backspace') {
      dispatch({ type: 'DELETE' });
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      dispatch({ type: 'TYPE', letter: e.key });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { state, dispatch };
}
