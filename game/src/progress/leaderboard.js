/**
 * Local leaderboard: the ten best runs on this device.
 *
 * Deliberately local. A global board in a game this short turns into a wall of
 * scores nobody can approach, and the player's real rival in a reflex game is
 * the version of themselves that played yesterday.
 *
 * Every entry records what the run *was*, not just what it scored — time,
 * blocks, streak and the theme it was played in — so the board reads as a
 * history rather than a column of numbers.
 *
 * Like the profile, every read is defensive: corrupt or partial storage resets
 * to an empty board rather than breaking the menu.
 */

const STORAGE_KEY = 'deflect.scores.v2';

/** How many runs the board remembers. */
export const BOARD_SIZE = 10;

export function createBoard() {
  return [];
}

const toCount = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** Repairs one stored entry; returns null if it is too broken to keep. */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const score = toCount(raw.score);
  // A zero-score entry carries no information and would push a real run off
  // the bottom of the board.
  if (score <= 0) return null;

  return {
    score,
    seconds: toCount(raw.seconds),
    blocks: toCount(raw.blocks),
    streak: toCount(raw.streak),
    themeId: typeof raw.themeId === 'string' ? raw.themeId : 'neon',
    at: toCount(raw.at),
  };
}

export function loadBoard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createBoard();
    return normalizeBoard(JSON.parse(raw));
  } catch {
    return createBoard();
  }
}

/** Sorts, trims and repairs an arbitrary array into a valid board. */
export function normalizeBoard(raw) {
  if (!Array.isArray(raw)) return createBoard();

  return raw
    .map(normalizeEntry)
    .filter(Boolean)
    .sort(compareEntries)
    .slice(0, BOARD_SIZE);
}

export function saveBoard(board) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch {
    // Storage unavailable. The board lives for the session and no further.
  }
}

/**
 * Higher score first; on a tie the earlier run keeps the better place.
 *
 * Ties are common in a game with fixed shard values, and "whoever got there
 * first keeps it" is the rule players expect from an arcade board.
 */
function compareEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return a.at - b.at;
}

/**
 * Adds a run to the board.
 *
 * Returns a new board and the 1-based rank the run earned, or rank 0 when it
 * did not make the cut. Never mutates the input.
 */
export function addRun(board, run) {
  const entry = normalizeEntry(run);
  if (!entry) return { board, rank: 0 };

  const next = [...board, entry].sort(compareEntries).slice(0, BOARD_SIZE);
  const index = next.indexOf(entry);

  return { board: next, rank: index < 0 ? 0 : index + 1 };
}

/** The score a run has to beat to reach the board at all. */
export function cutoffScore(board) {
  if (board.length < BOARD_SIZE) return 0;
  return board[board.length - 1].score;
}

/**
 * "3 days ago" style age, from two timestamps.
 *
 * Relative rather than absolute: a player looking at their own board cares that
 * a run was recent, not that it happened on the 14th.
 */
export function formatAge(at, now) {
  if (!at) return '';

  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 60) return 'JUST NOW';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}M AGO`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}W AGO`;

  return `${Math.floor(days / 30)}MO AGO`;
}
