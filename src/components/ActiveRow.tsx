import styles from '../styles/ActiveRow.module.css';
import Tile from './Tile';
import type { TileState, TileVisualState } from '../types';

interface Props {
  word: string;
  tileStates: TileState[];
  greenPositions: Record<number, string>; // confirmed correct-position letters (uppercase)
  onCycleTile: (index: number) => void;
}

export default function ActiveRow({
  word, tileStates, greenPositions, onCycleTile,
}: Props) {
  return (
    <div>
      <div className={styles.row}>
        {Array.from({ length: 5 }, (_, i) => {
          const letter = word[i] ?? '';
          const state: TileVisualState = letter ? tileStates[i] : 'empty';
          // A letter sitting on a confirmed correct position is necessarily green,
          // so it is locked: tapping it must not cycle it to another color. This
          // honors known greens.
          const locked = !!letter && greenPositions[i] === letter;
          const cyclable = !!letter && !locked;
          return (
            <Tile
              key={i}
              letter={letter}
              state={state}
              onClick={cyclable ? () => onCycleTile(i) : undefined}
            />
          );
        })}
      </div>
      <p className={styles.hint}>
        {word.length > 0
          ? 'Tap tiles to set color: Gray → Yellow → Green'
          : 'Type a word, or pick one from the list'}
      </p>
    </div>
  );
}
