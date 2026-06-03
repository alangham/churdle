import styles from '../styles/Tile.module.css';
import type { TileVisualState } from '../types';

interface Props {
  letter: string;
  state: TileVisualState;
  onClick?: () => void;
}

export default function Tile({ letter, state, onClick }: Props) {
  return (
    <div
      className={`${styles.tile} ${styles[state]}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${letter || 'empty'} — click to cycle color` : undefined}
    >
      {letter.toUpperCase()}
    </div>
  );
}
