/**
 * Unlock detection.
 *
 * Unlocks are derived by diffing the profile before and after a run rather than
 * stored as flags. That way the run that actually crosses a threshold is the one
 * that celebrates it, and a profile edited by hand can never end up with a
 * "claimed" flag that contradicts its counters.
 */

import { ADVANCED_TYPES, SHARD_TYPES } from '../config.js';
import { THEMES } from '../themes/index.js';

/**
 * Returns everything that crossed its threshold during this run.
 * Each entry is display-ready: { kind, id, title, subtitle, theme? }
 *
 * Themes are earned by blocking (an aggressive axis); new threats are earned by
 * surviving (a patient one). Two different players reach them in two different
 * orders, which is the point of tracking separate counters.
 */
export function collectUnlocks(before, after) {
  const unlocks = [];

  for (const theme of THEMES) {
    const crossed = before.totalBlocks < theme.unlockAt && after.totalBlocks >= theme.unlockAt;
    if (!crossed) continue;

    unlocks.push({
      kind: 'theme',
      id: `theme:${theme.id}`,
      title: theme.name,
      subtitle: theme.tagline,
      theme,
    });
  }

  for (const key of ADVANCED_TYPES) {
    const type = SHARD_TYPES[key];
    const crossed = before.totalSeconds < type.unlockAtSeconds
      && after.totalSeconds >= type.unlockAtSeconds;
    if (!crossed) continue;

    unlocks.push({
      kind: 'threat',
      id: `threat:${key}`,
      title: type.label,
      subtitle: type.hint,
      typeKey: key,
    });
  }

  return unlocks;
}

/** Shard type keys currently available to the spawner, given the profile. */
export function unlockedTypeKeys(profile) {
  return Object.keys(SHARD_TYPES).filter(
    (key) => profile.totalSeconds >= SHARD_TYPES[key].unlockAtSeconds,
  );
}

/** The next threat still locked, with how much survival time is left. */
export function nextThreatGoal(profile) {
  const locked = ADVANCED_TYPES
    .map((key) => SHARD_TYPES[key])
    .filter((type) => profile.totalSeconds < type.unlockAtSeconds)
    .sort((a, b) => a.unlockAtSeconds - b.unlockAtSeconds);

  if (!locked.length) return null;

  const type = locked[0];
  return {
    type,
    remaining: type.unlockAtSeconds - profile.totalSeconds,
    progress: profile.totalSeconds / type.unlockAtSeconds,
  };
}

/**
 * The next theme still out of reach, with how far away it is.
 * Returns null once everything is unlocked — the menu shows a different line then.
 */
export function nextThemeGoal(profile) {
  const locked = THEMES
    .filter((theme) => profile.totalBlocks < theme.unlockAt)
    .sort((a, b) => a.unlockAt - b.unlockAt);

  if (!locked.length) return null;

  const theme = locked[0];
  return {
    theme,
    remaining: theme.unlockAt - profile.totalBlocks,
    progress: profile.totalBlocks / theme.unlockAt,
  };
}
