/**
 * Unlock detection.
 *
 * Unlocks are derived by diffing the profile before and after a run rather than
 * stored as flags. That way the run that actually crosses a threshold is the one
 * that celebrates it, and a profile edited by hand can never end up with a
 * "claimed" flag that contradicts its counters.
 */

import { THEMES } from '../themes/index.js';

/**
 * Returns everything that crossed its threshold during this run.
 * Each entry is display-ready: { kind, id, title, subtitle, theme? }
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

  return unlocks;
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
