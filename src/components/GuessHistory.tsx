import styles from '../styles/GuessHistory.module.css';
import Tile from './Tile';
import type { GuessRow } from '../types';

interface Props {
  history: GuessRow[];
}

export default function GuessHistory({ history }: Props) {
  if (history.length === 0) return null;

  return (
    <div className={styles.history}>
      {history.map((row, i) => (
        <div key={i} className={styles.row}>
          {Array.from(row.word).map((letter, j) => (
            <Tile key={j} letter={letter} state={row.states[j]} />
          ))}
        </div>
      ))}
    </div>
  );
}
