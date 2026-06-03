import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/CandidateList.module.css';
import type { RankedWord, Strategy } from '../types';

interface Props {
  candidates: RankedWord[];
  onSelect: (word: string) => void;
  isFiltered: boolean;
  strategy: Strategy;
  onStrategyChange: (s: Strategy) => void;
}

// Render the list incrementally. Explore mode can return ~8,600 ranked words;
// mounting them all at once floods the DOM and makes scrolling/interaction lag.
// We render a page at a time and append more as the user scrolls toward the end.
const PAGE_SIZE = 100;
const SCROLL_THRESHOLD_PX = 300;

export default function CandidateList({
  candidates, onSelect, isFiltered, strategy, onStrategyChange,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset paging whenever the candidate set changes (new guess, undo, mode switch).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [candidates]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX) {
      setVisibleCount(c => (c < candidates.length ? c + PAGE_SIZE : c));
    }
  }, [candidates.length]);

  const isRanked = candidates.length > 0 && candidates[0].expectedRemaining !== null;
  const visible = candidates.slice(0, visibleCount);
  const hasMore = visibleCount < candidates.length;

  let headerLabel: string;
  if (!isFiltered) {
    headerLabel = 'Suggested starters';
  } else {
    headerLabel = `${candidates.length.toLocaleString()} candidate${candidates.length !== 1 ? 's' : ''}`;
  }

  let headerNote: string | null = null;
  if (isRanked) {
    headerNote = strategy === 'explore'
      ? 'explore — all guess words ranked'
      : 'solve — answer words preferred';
  } else if (isFiltered && candidates.length > 0) {
    headerNote = 'too many to rank — refine further';
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.count}>{headerLabel}</span>
          {headerNote && <span className={styles.note}>{headerNote}</span>}
        </div>

        {/* Strategy toggle — only visible after first guess */}
        {isFiltered && (
          <div className={styles.strategyBar}>
            <button
              className={`${styles.stratBtn} ${strategy === 'solve' ? styles.stratActive : ''}`}
              onClick={() => onStrategyChange('solve')}
            >
              Solve
            </button>
            <button
              className={`${styles.stratBtn} ${strategy === 'explore' ? styles.stratActive : ''}`}
              onClick={() => onStrategyChange('explore')}
            >
              Explore
            </button>
          </div>
        )}
      </div>

      {candidates.length === 0 && isFiltered ? (
        <div className={styles.empty}>No matches — check your tile markings</div>
      ) : (
        <ul className={styles.list} onScroll={handleScroll}>
          {visible.map(({ word, expectedRemaining, worstCase, distinctPatterns, isAnswer, explanation }) => (
            <li
              key={word}
              className={styles.item}
              onClick={() => onSelect(word)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelect(word)}
            >
              <div className={styles.itemMain}>
                <span className={styles.word}>{word}</span>
                {isAnswer && <span className={styles.answerBadge} title="Possible answer">◆</span>}
                <span className={styles.spacer} />
                {expectedRemaining !== null ? (
                  <span className={styles.stats}>
                    <span className={styles.stat} title="Expected remaining candidates">
                      ~{expectedRemaining.toFixed(1)}
                    </span>
                    <span className={styles.statSep}>·</span>
                    <span className={styles.stat} title="Worst-case remaining candidates">
                      ↑{worstCase}
                    </span>
                    <span className={styles.statSep}>·</span>
                    <span className={styles.stat} title="Distinct feedback patterns">
                      {distinctPatterns}p
                    </span>
                  </span>
                ) : null}
              </div>
              {explanation && (
                <div className={styles.explanation}>{explanation}</div>
              )}
            </li>
          ))}
          {hasMore && (
            <li className={styles.more}>
              showing {visible.length.toLocaleString()} of {candidates.length.toLocaleString()} — scroll for more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
