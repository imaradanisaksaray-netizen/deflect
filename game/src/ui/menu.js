/**
 * Menu layout.
 *
 * Every button's rectangle is computed here and used by both the renderer and
 * the hit test. Two independent layouts would drift, and a button that is drawn
 * somewhere other than where it responds is the worst kind of bug — invisible
 * in code review, obvious and infuriating in the hand.
 *
 * Rectangles are in canvas pixels; sizes derive from the reference unit so the
 * menu holds its proportions on every aspect ratio.
 */

import { PICKUP_TYPES, SHARD_TYPES } from '../config.js';
import { THEMES, blocksUntil, isThemeUnlocked } from '../themes/index.js';
import { unlockedTypeKeys } from '../progress/unlocks.js';

/**
 * Tabs along the bottom of the main menu.
 *
 * Labels are kept short and close in length so four of them fit side by side on
 * a phone without the row turning into a ransom note of mismatched widths.
 */
export const MENU_TABS = [
  { id: 'themes', label: 'THEMES' },
  { id: 'scores', label: 'SCORES' },
  { id: 'stats', label: 'STATS' },
  { id: 'help', label: 'GUIDE' },
];

/**
 * Minimum touch target, in real pixels.
 *
 * Everything else in the game scales with the reference unit, but a finger does
 * not get smaller on a narrow phone. On a 390px-wide screen the unit-derived
 * height lands around 23px, which is a button you have to aim at.
 */
const MIN_TOUCH = 44;

/**
 * Bottom tab strip.
 *
 * They sit low and read small on purpose: the main menu's primary action is
 * "tap anywhere to play", and a row of competing buttons would bury it.
 */
export function tabButtons(viewport) {
  const { width, height, unit } = viewport;
  // Four tabs plus their gaps have to clear the narrow side of the viewport,
  // which is exactly one reference unit.
  const buttonWidth = Math.max(unit * 0.21, MIN_TOUCH);
  const buttonHeight = Math.max(unit * 0.058, MIN_TOUCH);
  const gap = unit * 0.018;
  const total = MENU_TABS.length * buttonWidth + (MENU_TABS.length - 1) * gap;
  const startX = width / 2 - total / 2;
  const y = height * 0.93 - buttonHeight / 2;

  return MENU_TABS.map((tab, index) => ({
    ...tab,
    x: startX + index * (buttonWidth + gap),
    y,
    w: buttonWidth,
    h: buttonHeight,
  }));
}

/** Back button shared by every sub-screen. */
export function backButton(viewport) {
  const { width, height, unit } = viewport;
  const w = Math.max(unit * 0.22, MIN_TOUCH);
  const h = Math.max(unit * 0.062, MIN_TOUCH);

  return {
    id: 'back',
    label: 'BACK  [ESC]',
    x: width / 2 - w / 2,
    y: height * 0.9 - h / 2,
    w,
    h,
  };
}

/**
 * Theme picker grid.
 *
 * Locked themes stay in the grid rather than being hidden. Seeing what is
 * coming — and how far off it is — is the reason the counter is worth anything.
 */
export function themeButtons(viewport, profile) {
  const { width, height, unit } = viewport;
  const columns = 3;
  const cellWidth = unit * 0.26;
  const cellHeight = unit * 0.17;
  const gapX = unit * 0.03;
  const gapY = unit * 0.03;
  const rows = Math.ceil(THEMES.length / columns);

  const gridWidth = columns * cellWidth + (columns - 1) * gapX;
  const gridHeight = rows * cellHeight + (rows - 1) * gapY;
  const startX = width / 2 - gridWidth / 2;
  const startY = height * 0.48 - gridHeight / 2;

  return THEMES.map((theme, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      id: `theme:${theme.id}`,
      theme,
      // Reuses the progress module's rules rather than restating the threshold
      // comparison, so a tile can never disagree with what the game unlocked.
      unlocked: isThemeUnlocked(theme, profile),
      remaining: blocksUntil(theme, profile),
      x: startX + column * (cellWidth + gapX),
      y: startY + row * (cellHeight + gapY),
      w: cellWidth,
      h: cellHeight,
    };
  });
}

/** Rows for the stats screen, derived entirely from the profile. */
export function statRows(profile) {
  return [
    { label: 'BEST SCORE', value: String(profile.bestScore) },
    { label: 'RUNS PLAYED', value: String(profile.runs) },
    { label: 'SHARDS BLOCKED', value: String(profile.totalBlocks) },
    { label: 'LONGEST STREAK', value: String(profile.longestStreak) },
    { label: 'TIME SURVIVED', value: formatDuration(profile.totalSeconds) },
    {
      label: 'THEMES UNLOCKED',
      value: `${THEMES.filter((t) => isThemeUnlocked(t, profile)).length} / ${THEMES.length}`,
    },
    {
      label: 'THREATS FACED',
      value: `${unlockedTypeKeys(profile).length} / ${Object.keys(SHARD_TYPES).length}`,
    },
  ];
}

/**
 * Entries for the how-to-play screen.
 *
 * Only unlocked threats are listed. Explaining a shard the player has never met
 * teaches nothing and makes the screen look like a wall of homework.
 */
export function helpEntries(profile) {
  const unlocked = new Set(unlockedTypeKeys(profile));

  const threats = Object.values(SHARD_TYPES)
    .filter((type) => unlocked.has(type.key))
    .map((type) => ({
      kind: 'threat',
      key: type.key,
      shape: type.shape,
      label: type.label ?? defaultThreatLabel(type.key),
      hint: type.hint ?? defaultThreatHint(type.key),
    }));

  const rewards = Object.values(PICKUP_TYPES).map((type) => ({
    kind: 'pickup',
    key: type.key,
    symbol: type.symbol,
    label: type.label,
    hint: PICKUP_HINTS[type.key],
  }));

  return { threats, rewards };
}

const PICKUP_HINTS = {
  life: 'RESTORES A CORE SEGMENT',
  extend: 'A WIDER SHIELD, BRIEFLY',
  slow: 'EVERYTHING SLOWS DOWN',
  nova: 'CLEARS THE SCREEN',
};

function defaultThreatLabel(key) {
  if (key === 'gold') return 'BONUS';
  if (key === 'void') return 'VOID';
  return 'SHARD';
}

function defaultThreatHint(key) {
  if (key === 'gold') return 'WORTH FIVE ORDINARY BLOCKS';
  if (key === 'void') return 'NEVER BLOCK IT — LET IT PASS';
  return 'BLOCK IT WITH THE SHIELD';
}

/** Seconds -> a compact human duration, e.g. `3h 12m` or `48s`. */
export function formatDuration(seconds) {
  const total = Math.floor(seconds);
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** The button under (x, y), or null. */
export function hitTest(buttons, x, y) {
  for (const button of buttons) {
    if (x >= button.x && x <= button.x + button.w
      && y >= button.y && y <= button.y + button.h) {
      return button;
    }
  }
  return null;
}
