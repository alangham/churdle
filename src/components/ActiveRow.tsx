import styles from '../styles/ActiveRow.module.css';
import Tile from './Tile';
import type { TileState, TileVisualState } from '../types';

interface Props {
  word: string;
  tileStates: TileState[];
  onCycleTile: (index: number) => void;
}

export default function ActiveRow({ word, tileStates, onCycleTile }: Props) {
  return (
    <div>
      <div className={styles.row}>
        {Array.from({ length: 5 }, (_, i) => {
          const letter = word[i] ?? '';
          const state: TileVisualState = letter ? tileStates[i] : 'empty';
          return (
            <Tile
              key={i}
              letter={letter}
              state={state}
              onClick={letter ? () => onCycleTile(i) : undefined}
            />
          );
        })}
      </div>
      <p className={styles.hint}>
        {word.length > 0
          ? 'Click tiles to set color: Gray → Yellow → Green'
          : 'Type a word or click one from the list'}
      </p>
    </div>
  );
}
