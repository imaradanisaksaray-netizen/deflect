/**
 * The menu sub-screens: theme picker, stats and how-to-play.
 *
 * They share one visual grammar — a title, a body, and a back button — so that
 * moving between them feels like turning pages rather than opening apps.
 *
 * Every rectangle comes from ui/menu.js, the same source the hit test reads.
 */

import { formatAge } from '../progress/leaderboard.js';
import { getTheme } from '../themes/index.js';
import { backButton, formatDuration, helpEntries, statRows, themeButtons } from '../ui/menu.js';
import { drawPickupIcon, drawShardIcon } from './entities.js';
import { neonText, plainText, withAlpha } from './neon.js';

/** Dim wash so the playfield reads as backdrop while a screen is open. */
function drawBackdrop(ctx, viewport, alpha) {
  ctx.save();
  ctx.fillStyle = withAlpha('#05020f', alpha);
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.restore();
}

function drawTitle(ctx, game, text) {
  const { theme, viewport } = game;
  neonText(ctx, text, viewport.width / 2, viewport.height * 0.13, {
    size: viewport.unit * 0.058,
    color: theme.colors.core,
    spacing: viewport.unit * 0.016,
    weight: 800,
  });
}

/**
 * A button frame.
 *
 * `selected` is driven by keyboard navigation and `hovered` by the pointer.
 * They are drawn identically on purpose: the player should not have to learn
 * two different highlight languages for the same state.
 */
export function drawButton(ctx, game, button, { selected, label, accent } = {}) {
  const { theme, viewport } = game;
  const { unit } = viewport;
  const color = accent ?? theme.colors.text;
  const active = selected;

  ctx.save();
  ctx.lineWidth = unit * (active ? 0.0045 : 0.003);
  ctx.strokeStyle = withAlpha(color, active ? 0.95 : 0.35);
  ctx.fillStyle = withAlpha(color, active ? 0.14 : 0.05);
  roundedRect(ctx, button.x, button.y, button.w, button.h, unit * 0.012);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  plainText(ctx, label ?? button.label, button.x + button.w / 2, button.y + button.h / 2, {
    size: unit * 0.021,
    color,
    spacing: unit * 0.005,
    font: 'mono',
    alpha: active ? 1 : 0.75,
  });
}

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBack(ctx, game, buttons) {
  const button = backButton(game.viewport);
  drawButton(ctx, game, button, {
    selected: isSelected(game, buttons, button),
    accent: game.theme.colors.textDim,
  });
}

const isSelected = (game, buttons, button) => buttons[game.menuSelection]?.id === button.id;

/**
 * Theme picker.
 *
 * Each tile previews its own palette rather than the active one — the point of
 * the screen is to answer "what would the game look like?", and a swatch drawn
 * in the current theme's colours answers nothing.
 */
export function drawThemeScreen(ctx, game) {
  const { theme, viewport, profile } = game;
  const { width, height, unit } = viewport;
  const buttons = themeButtons(viewport, profile);

  drawBackdrop(ctx, viewport, 0.82);
  drawTitle(ctx, game, 'THEMES');

  plainText(ctx, 'UNLOCKED BY BLOCKING SHARDS', width / 2, height * 0.13 + unit * 0.05, {
    size: unit * 0.021,
    color: theme.colors.textDim,
    spacing: unit * 0.008,
    alpha: 0.7,
  });

  for (const button of buttons) {
    const selected = isSelected(game, buttons, button) || button.theme.id === theme.id;
    const accent = button.unlocked ? button.theme.colors.core : theme.colors.textDim;

    ctx.save();
    ctx.lineWidth = unit * (selected ? 0.0045 : 0.003);
    ctx.strokeStyle = withAlpha(accent, selected ? 0.95 : 0.3);
    ctx.fillStyle = withAlpha(button.theme.colors.background, button.unlocked ? 0.95 : 0.5);
    roundedRect(ctx, button.x, button.y, button.w, button.h, unit * 0.014);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawSwatch(ctx, button, unit, button.unlocked ? 1 : 0.3);

    plainText(ctx, button.theme.name, button.x + button.w / 2, button.y + button.h * 0.62, {
      size: unit * 0.026,
      color: accent,
      spacing: unit * 0.006,
      font: 'mono',
      alpha: button.unlocked ? 1 : 0.6,
    });

    const caption = button.unlocked
      ? button.theme.tagline
      : `${button.remaining} MORE BLOCKS`;

    plainText(ctx, caption, button.x + button.w / 2, button.y + button.h * 0.84, {
      size: unit * 0.017,
      color: button.unlocked ? theme.colors.textDim : theme.colors.gold,
      spacing: unit * 0.003,
      alpha: 0.8,
    });

    if (button.theme.id === theme.id) {
      plainText(ctx, 'ACTIVE', button.x + button.w / 2, button.y + button.h * 0.14, {
        size: unit * 0.015,
        color: accent,
        spacing: unit * 0.006,
        font: 'mono',
        alpha: 0.9,
      });
    }
  }

  drawBack(ctx, game, buttons);
}

/** Three dots of a theme's palette: what you block, what you avoid, what you catch. */
function drawSwatch(ctx, button, unit, alpha) {
  const colors = [
    button.theme.colors.shard,
    button.theme.colors.void,
    button.theme.colors.pickup,
  ];
  const radius = unit * 0.014;
  const gap = radius * 2.6;
  const y = button.y + button.h * 0.34;

  ctx.save();
  ctx.globalAlpha = alpha;
  colors.forEach((color, index) => {
    ctx.beginPath();
    ctx.arc(button.x + button.w / 2 + (index - 1) * gap, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.restore();
}

/**
 * The local leaderboard.
 *
 * The run just finished is highlighted when it placed, which is the only reason
 * a player opens this screen straight after dying — they want to see where they
 * landed, not read ten rows looking for themselves.
 */
export function drawScoresScreen(ctx, game) {
  const { theme, viewport, board, lastRank, time } = game;
  const { width, height, unit } = viewport;

  drawBackdrop(ctx, viewport, 0.82);
  drawTitle(ctx, game, 'SCORES');

  if (!board.length) {
    plainText(ctx, 'NO RUNS YET', width / 2, height * 0.45, {
      size: unit * 0.03,
      color: theme.colors.textDim,
      spacing: unit * 0.01,
      alpha: 0.8,
    });
    plainText(ctx, 'YOUR TEN BEST RUNS WILL LIVE HERE', width / 2, height * 0.45 + unit * 0.05, {
      size: unit * 0.02,
      color: theme.colors.textDim,
      spacing: unit * 0.005,
      alpha: 0.5,
    });
    drawBack(ctx, game, [backButton(viewport)]);
    return;
  }

  const { firstRowY, rowHeight } = SCORE_LAYOUT;
  const now = Date.now();
  // Column rails, as offsets from the centre in units.
  const rankX = width / 2 - unit * 0.3;
  const scoreX = width / 2 - unit * 0.09;
  const timeX = width / 2 + unit * 0.06;
  const ageX = width / 2 + unit * 0.3;

  board.forEach((entry, index) => {
    const y = height * firstRowY + index * unit * rowHeight;
    const isLatest = index + 1 === lastRank;
    // The fresh entry pulses rather than simply changing colour, so it is found
    // by peripheral vision instead of by reading.
    const emphasis = isLatest ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
    const color = isLatest ? theme.colors.gold : theme.colors.text;
    const entryTheme = getTheme(entry.themeId);

    plainText(ctx, String(index + 1).padStart(2, '0'), rankX, y, {
      size: unit * 0.022,
      color: theme.colors.textDim,
      spacing: unit * 0.003,
      align: 'right',
      font: 'mono',
      alpha: 0.6,
    });

    // A dot in the theme the run was played in — the board doubles as a record
    // of which palettes the player has actually lived in.
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(rankX + unit * 0.03, y, unit * 0.008, 0, Math.PI * 2);
    ctx.fillStyle = entryTheme.colors.shard;
    ctx.fill();
    ctx.restore();

    plainText(ctx, String(entry.score), scoreX, y, {
      size: unit * 0.026,
      color,
      spacing: unit * 0.004,
      align: 'right',
      font: 'mono',
      alpha: emphasis,
    });

    plainText(ctx, formatDuration(entry.seconds), timeX, y, {
      size: unit * 0.021,
      color: theme.colors.textDim,
      spacing: unit * 0.003,
      align: 'right',
      font: 'mono',
      alpha: 0.75,
    });

    plainText(ctx, `${entry.blocks} BLOCKS`, timeX + unit * 0.02, y, {
      size: unit * 0.018,
      color: theme.colors.textDim,
      spacing: unit * 0.002,
      align: 'left',
      alpha: 0.55,
    });

    plainText(ctx, formatAge(entry.at, now), ageX, y, {
      size: unit * 0.017,
      color: theme.colors.textDim,
      spacing: unit * 0.002,
      align: 'right',
      alpha: 0.45,
    });
  });

  drawBack(ctx, game, [backButton(viewport)]);
}

/**
 * Score row geometry, as fractions of height and unit.
 *
 * Exported for the same reason the help layout is: a full board of ten rows is
 * a state most players reach only after weeks, so overflow here would go
 * unnoticed for a long time.
 */
export const SCORE_LAYOUT = {
  firstRowY: 0.27,
  rowHeight: 0.045,
};

export function drawStatsScreen(ctx, game) {
  const { theme, viewport, profile } = game;
  const { width, height, unit } = viewport;
  const rows = statRows(profile);

  drawBackdrop(ctx, viewport, 0.82);
  drawTitle(ctx, game, 'STATS');

  const startY = height * 0.28;
  const rowHeight = unit * 0.052;
  // Two columns pinned to a shared centre gap, so labels and values line up
  // into readable rails instead of drifting with text length.
  const leftX = width / 2 - unit * 0.02;
  const rightX = width / 2 + unit * 0.02;

  rows.forEach((row, index) => {
    const y = startY + index * rowHeight;

    plainText(ctx, row.label, leftX, y, {
      size: unit * 0.023,
      color: theme.colors.textDim,
      spacing: unit * 0.004,
      align: 'right',
      font: 'mono',
      alpha: 0.8,
    });

    plainText(ctx, row.value, rightX, y, {
      size: unit * 0.026,
      color: theme.colors.text,
      spacing: unit * 0.004,
      align: 'left',
      font: 'mono',
    });
  });

  drawBack(ctx, game, [backButton(viewport)]);
}

export function drawHelpScreen(ctx, game) {
  const { theme, viewport, profile, time } = game;
  const { width, height, unit } = viewport;
  const { threats, rewards } = helpEntries(profile);

  drawBackdrop(ctx, viewport, 0.86);
  drawTitle(ctx, game, 'HOW TO PLAY');

  plainText(ctx, 'AIM WITH MOUSE, TOUCH OR ARROW KEYS', width / 2, height * 0.13 + unit * 0.05, {
    size: unit * 0.021,
    color: theme.colors.textDim,
    spacing: unit * 0.007,
    alpha: 0.75,
  });

  // Threats first, rewards second: the player has to survive before a reward
  // means anything.
  let y = height * HELP_LAYOUT.firstSectionY;
  y = drawHelpSection(ctx, game, 'THREATS', threats, y, time);
  drawHelpSection(ctx, game, 'REWARDS', rewards, y + unit * HELP_LAYOUT.sectionGap, time);

  drawBack(ctx, game, [backButton(viewport)]);
}

function drawHelpSection(ctx, game, title, entries, startY, time) {
  const { theme, viewport } = game;
  const { width, unit } = viewport;
  const { headerOffset, rowHeight, iconOffset, labelOffset, hintOffset } = HELP_LAYOUT;
  const iconX = width / 2 + unit * iconOffset;
  const labelX = width / 2 + unit * labelOffset;

  plainText(ctx, title, iconX - unit * 0.02, startY, {
    size: unit * 0.019,
    color: theme.colors.horizon,
    spacing: unit * 0.01,
    align: 'left',
    font: 'mono',
    alpha: 0.85,
  });

  entries.forEach((entry, index) => {
    const y = startY + unit * headerOffset + index * unit * rowHeight;

    if (entry.kind === 'threat') {
      drawShardIcon(ctx, iconX, y, unit * 0.018, entry.key, time * 0.9, theme);
    } else {
      drawPickupIcon(ctx, iconX, y, unit * 0.018, entry.symbol, theme);
    }

    plainText(ctx, entry.label, labelX, y, {
      size: unit * 0.021,
      color: theme.colors.text,
      spacing: unit * 0.003,
      align: 'left',
      font: 'mono',
    });

    plainText(ctx, entry.hint, width / 2 + unit * hintOffset, y, {
      size: unit * 0.018,
      color: theme.colors.textDim,
      spacing: unit * 0.002,
      align: 'left',
      alpha: 0.75,
    });
  });

  return startY + unit * headerOffset + entries.length * unit * rowHeight;
}

/**
 * Help screen geometry, as fractions of height and unit.
 *
 * Exported so a test can prove the fully-unlocked screen — every threat plus
 * every reward — still ends above the back button. That is the one layout in
 * the game that grows over months of play, so it is the one that can quietly
 * overflow long after it was last looked at.
 */
export const HELP_LAYOUT = {
  /** Fraction of viewport height where the first section header sits. */
  firstSectionY: 0.225,
  /** Unit fractions for everything below it. */
  headerOffset: 0.038,
  rowHeight: 0.042,
  sectionGap: 0.026,
  /** Horizontal offsets from the centre, in units. */
  iconOffset: -0.3,
  labelOffset: -0.25,
  hintOffset: -0.02,
};

/** Shared by the main menu and every sub-screen so one wash covers them all. */
export { drawBackdrop };
