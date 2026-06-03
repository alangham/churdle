import styles from '../styles/Keyboard.module.css';

interface Props {
  onKey: (letter: string) => void;
  onEnter: () => void;
  onDelete: () => void;
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

// On-screen keyboard. Works for touch (where there is no physical keyboard) and
// mouse alike; it dispatches the same TYPE/DELETE/SUBMIT actions as physical keys.
// preventDefault on mousedown keeps focus off the keys so a focused key can't be
// re-triggered by a physical Enter press.
export default function Keyboard({ onKey, onEnter, onDelete }: Props) {
  return (
    <div className={styles.keyboard}>
      <div className={styles.row}>
        {ROWS[0].split('').map(k => (
          <button
            key={k}
            type="button"
            className={styles.key}
            onMouseDown={e => e.preventDefault()}
            onClick={() => onKey(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        {ROWS[1].split('').map(k => (
          <button
            key={k}
            type="button"
            className={styles.key}
            onMouseDown={e => e.preventDefault()}
            onClick={() => onKey(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.key} ${styles.wide}`}
          onMouseDown={e => e.preventDefault()}
          onClick={onEnter}
        >
          Enter
        </button>
        {ROWS[2].split('').map(k => (
          <button
            key={k}
            type="button"
            className={styles.key}
            onMouseDown={e => e.preventDefault()}
            onClick={() => onKey(k)}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.key} ${styles.wide}`}
          onMouseDown={e => e.preventDefault()}
          onClick={onDelete}
          aria-label="Delete"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
