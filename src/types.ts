export type TileState = 'absent' | 'present' | 'correct';
export type TileVisualState = TileState | 'empty';
export type Strategy = 'explore' | 'solve';

export interface GuessRow {
  word: string;       // lowercase, 5 letters
  states: TileState[];
}

export interface RankedWord {
  word: string;
  // null on all fields when the candidate list is too large to rank (shown alphabetically)
  expectedRemaining: number | null;
  worstCase: number | null;
  distinctPatterns: number | null;
  isAnswer: boolean;          // word is in the filtered answer pool (could be the actual answer)
  explanation: string | null; // brief reason for ranking
}

export interface SolverState {
  history: GuessRow[];
  activeWord: string;
  activeTileStates: TileState[];
  candidates: RankedWord[];
  strategy: Strategy;
  toast: string | null;
}
