import { useEffect, useState } from 'react';
import styles from './styles/App.module.css';
import { useSolver } from './hooks/useSolver';
import GuessHistory from './components/GuessHistory';
import ActiveRow from './components/ActiveRow';
import CandidateList from './components/CandidateList';
import Toast from './components/Toast';
import sunIcon from './assets/sun.svg';
import moonIcon from './assets/moon.svg';

type Theme = 'dark' | 'light';

// Initial theme comes from the data-theme attribute that the inline script in
// index.html already set from localStorage (defaults to dark).
function getInitialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export default function App() {
  const { state, dispatch } = useSolver();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply theme to <html> and persist the choice.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('churdle-theme', theme);
    } catch {
      // localStorage unavailable (private mode etc.) — theme still applies for the session.
    }
  }, [theme]);

  // Auto-dismiss toast (Toast component also has its own timer — this is a safety net)
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'DISMISS_TOAST' }), 2200);
    return () => clearTimeout(t);
  }, [state.toast, dispatch]);

  const isSolved =
    state.history.length > 0 &&
    state.history[state.history.length - 1].states.every(s => s === 'correct');

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.title}>Churdle</span>
        <div className={styles.headerActions}>
          <button
            className={styles.themeBtn}
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle light/dark theme"
          >
            <span
              className={styles.themeIcon}
              style={{
                // Double-quote the URL: Vite inlines these SVGs as data: URIs that
                // contain single quotes, which would break an unquoted url().
                WebkitMaskImage: `url("${theme === 'dark' ? sunIcon : moonIcon}")`,
                maskImage: `url("${theme === 'dark' ? sunIcon : moonIcon}")`,
              }}
            />
          </button>
          <button
            className={styles.resetBtn}
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Reset
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.leftPanel}>
          {state.history.length > 0 && (
            <div>
              <div className={styles.sectionRow}>
                <span className={styles.sectionLabel}>Your guesses</span>
                <button
                  className={styles.undoBtn}
                  onClick={() => dispatch({ type: 'UNDO' })}
                  title="Remove last guess"
                >
                  ← Undo last
                </button>
              </div>
              <GuessHistory history={state.history} />
            </div>
          )}

          {isSolved ? (
            <div className={styles.solvedBanner}>Solved 🎉</div>
          ) : (
            <>
              <div>
                <div className={styles.sectionLabel}>
                  {state.history.length === 0 ? 'Enter your first guess' : 'Next guess'}
                </div>
                <ActiveRow
                  word={state.activeWord}
                  tileStates={state.activeTileStates}
                  onCycleTile={index => dispatch({ type: 'CYCLE_TILE', index })}
                />
              </div>

              <button
                className={styles.submitBtn}
                disabled={state.activeWord.length !== 5}
                onClick={() => dispatch({ type: 'SUBMIT' })}
              >
                Submit
              </button>
            </>
          )}
        </section>

        <section className={styles.rightPanel}>
          <CandidateList
            candidates={state.candidates}
            onSelect={word => dispatch({ type: 'CLICK_CANDIDATE', word })}
            isFiltered={state.history.length > 0}
            strategy={state.strategy}
            onStrategyChange={strategy => dispatch({ type: 'SET_STRATEGY', strategy })}
          />
        </section>
      </main>

      {state.toast && (
        <Toast
          message={state.toast}
          onDismiss={() => dispatch({ type: 'DISMISS_TOAST' })}
        />
      )}
    </div>
  );
}
