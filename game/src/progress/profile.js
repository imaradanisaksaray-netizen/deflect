/**
 * Persistent player profile.
 *
 * Progress is tracked on three separate axes rather than one XP number, so that
 * different play styles unlock different things: a careful survivor advances
 * `totalSeconds`, an aggressive blocker advances `totalBlocks`, and a precise
 * player advances `longestStreak`.
 *
 * Every read is defensive: a missing, corrupt or older profile silently resets
 * to a fresh one rather than breaking the game.
 */

const STORAGE_KEY = 'deflect.profile.v2';
const PROFILE_VERSION = 2;

export function createProfile() {
  return {
    version: PROFILE_VERSION,
    /** Blocked shards across all runs — drives theme unlocks. */
    totalBlocks: 0,
    /** Best consecutive-block chain ever reached — drives mastery badges. */
    longestStreak: 0,
    /** Seconds survived across all runs — drives threat-type unlocks. */
    totalSeconds: 0,
    runs: 0,
    bestScore: 0,
    /** Currently selected theme id. */
    themeId: 'neon',
    /** Unlock ids the player has already been shown a celebration for. */
    seenUnlocks: [],
  };
}

const toCount = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** Repairs a parsed profile so later code never has to null-check fields. */
function normalize(raw) {
  const base = createProfile();
  if (!raw || typeof raw !== 'object') return base;

  return {
    ...base,
    totalBlocks: toCount(raw.totalBlocks),
    longestStreak: toCount(raw.longestStreak),
    totalSeconds: toCount(raw.totalSeconds),
    runs: toCount(raw.runs),
    bestScore: toCount(raw.bestScore),
    themeId: typeof raw.themeId === 'string' ? raw.themeId : base.themeId,
    seenUnlocks: Array.isArray(raw.seenUnlocks)
      ? raw.seenUnlocks.filter((id) => typeof id === 'string')
      : [],
  };
}

export function loadProfile() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateFromV1(createProfile());
    return normalize(JSON.parse(raw));
  } catch {
    return createProfile();
  }
}

export function saveProfile(profile) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable (private mode, embedded context). The session keeps
    // its progress in memory and simply cannot persist it.
  }
}

/**
 * Carries a v1 high score into a fresh v2 profile so returning players do not
 * see their best score reset to zero.
 */
function migrateFromV1(profile) {
  try {
    const legacy = window.localStorage.getItem('deflect.highScore.v1');
    if (!legacy) return profile;
    return { ...profile, bestScore: toCount(Number.parseInt(legacy, 10)) };
  } catch {
    return profile;
  }
}

/**
 * Folds one finished run into the profile and returns a new profile object.
 * Never mutates the input — callers compare before/after to detect unlocks.
 */
export function recordRun(profile, run) {
  const blocks = toCount(run.blocks);
  const streak = toCount(run.streak);
  const seconds = toCount(run.seconds);
  const score = toCount(run.score);

  return {
    ...profile,
    totalBlocks: profile.totalBlocks + blocks,
    longestStreak: Math.max(profile.longestStreak, streak),
    totalSeconds: profile.totalSeconds + seconds,
    runs: profile.runs + 1,
    bestScore: Math.max(profile.bestScore, score),
  };
}

export function selectTheme(profile, themeId) {
  return { ...profile, themeId };
}

export function markUnlocksSeen(profile, ids) {
  const merged = new Set([...profile.seenUnlocks, ...ids]);
  return { ...profile, seenUnlocks: [...merged] };
}
