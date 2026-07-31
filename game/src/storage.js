/**
 * High score persistence.
 *
 * Storage is wrapped in try/catch on purpose: embedded contexts (YouTube
 * Playables, itch.io iframes, private browsing) can throw on access. A missing
 * high score must never break the game.
 */

const HIGH_SCORE_KEY = 'deflect.highScore.v1';
const MUTED_KEY = 'deflect.muted.v1';

function readNumber(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable — the session simply keeps its value in memory.
  }
}

export const readHighScore = () => readNumber(HIGH_SCORE_KEY, 0);

export const writeHighScore = (score) => write(HIGH_SCORE_KEY, Math.floor(score));

export const readMuted = () => readNumber(MUTED_KEY, 0) === 1;

export const writeMuted = (muted) => write(MUTED_KEY, muted ? 1 : 0);
