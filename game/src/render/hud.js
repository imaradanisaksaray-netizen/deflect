/**
 * HUD and full-screen states (menu, pause, game over).
 *
 * Vertical positions are anchored to viewport height while text sizes are
 * anchored to the reference unit, so nothing collides with the playfield on
 * extreme aspect ratios.
 */

import { CONFIG, PICKUP_TYPES } from '../config.js';
import { isMuted } from '../audio.js';
import { clamp, easeOutCubic } from '../math.js';
import { SCREEN } from '../state/game.js';
import { nextThemeGoal } from '../progress/unlocks.js';
import { tabButtons } from '../ui/menu.js';
import { drawShardIcon } from './entities.js';
import { drawButton } from './screens.js';
import { neonText, plainText, withAlpha } from './neon.js';

const HOW_TO_PLAY = [
  { type: 'shard', label: 'BLOCK' },
  { type: 'gold', label: 'BONUS' },
  { type: 'void', label: 'AVOID' },
];

function multiplierColor(multiplier, theme) {
  if (multiplier >= 5) return theme.colors.horizon;
  if (multiplier >= 3) return theme.colors.gold;
  return theme.colors.core;
}

export function drawHud(ctx, game) {
  const { theme } = game;
  const { viewport, screen } = game;
  const { width, height, unit } = viewport;

  if (screen === SCREEN.playing || screen === SCREEN.paused) {
    drawScore(ctx, game);
    drawRunHints(ctx, game);
    drawActiveBuffs(ctx, game);
    drawPickupBanner(ctx, game);
  }

  // The menu prints its own, larger BEST line — no need to show it twice.
  if (screen !== SCREEN.menu) {
    plainText(ctx, `BEST ${game.highScore}`, width - unit * 0.045, height * 0.05, {
      size: unit * 0.026,
      color: theme.colors.textDim,
      spacing: unit * 0.004,
      align: 'right',
      font: 'mono',
      alpha: 0.75,
    });
  }

  plainText(ctx, isMuted() ? 'SOUND OFF  [M]' : 'SOUND ON  [M]', unit * 0.045, height * 0.05, {
    size: unit * 0.022,
    color: theme.colors.textDim,
    spacing: unit * 0.003,
    align: 'left',
    font: 'mono',
    alpha: 0.5,
  });
}

function drawScore(ctx, game) {
  const { theme } = game;
  const { viewport, score, multiplier } = game;
  const { width, height, unit } = viewport;

  neonText(ctx, String(Math.floor(score)).padStart(4, '0'), width / 2, height * 0.085, {
    size: unit * 0.078,
    color: theme.colors.text,
    spacing: unit * 0.008,
    font: 'mono',
    weight: 700,
  });

  if (multiplier <= 1) return;

  const color = multiplierColor(multiplier, theme);
  neonText(ctx, `x${multiplier}`, width / 2, height * 0.085 + unit * 0.062, {
    size: unit * 0.04,
    color,
    spacing: unit * 0.004,
    font: 'mono',
    weight: 700,
  });
}

/**
 * Timed rewards, as draining bars in the bottom-left.
 *
 * A bar rather than a number: the player is watching the centre of the screen
 * and only needs to know "still on / running out", which peripheral vision can
 * read from a shrinking line but not from digits.
 */
function drawActiveBuffs(ctx, game) {
  const { theme, viewport, buffs } = game;
  const { height, unit } = viewport;

  const active = [
    { key: 'extend', label: 'WIDE GUARD', duration: PICKUP_TYPES.extend.duration },
    { key: 'slow', label: 'SLIPSTREAM', duration: PICKUP_TYPES.slow.duration },
  ].filter((entry) => buffs[entry.key] > 0);

  active.forEach((entry, index) => {
    const y = height - unit * 0.07 - index * unit * 0.055;
    const remaining = clamp(buffs[entry.key] / entry.duration, 0, 1);
    const barWidth = unit * 0.14;

    plainText(ctx, entry.label, unit * 0.045, y, {
      size: unit * 0.02,
      color: theme.colors.pickup,
      spacing: unit * 0.003,
      align: 'left',
      font: 'mono',
      alpha: 0.9,
    });

    ctx.save();
    ctx.fillStyle = withAlpha(theme.colors.pickup, 0.18);
    ctx.fillRect(unit * 0.045, y + unit * 0.012, barWidth, unit * 0.006);
    ctx.fillStyle = withAlpha(theme.colors.pickup, 0.9);
    ctx.fillRect(unit * 0.045, y + unit * 0.012, barWidth * remaining, unit * 0.006);
    ctx.restore();
  });
}

/** Names the reward that was just caught, then fades out. */
function drawPickupBanner(ctx, game) {
  const { theme, viewport, pickupBanner } = game;
  if (!pickupBanner) return;

  const { width, height, unit } = viewport;
  // Fades over the last third of its life so it never lingers as clutter.
  const alpha = clamp(pickupBanner.life / 0.55, 0, 1);

  neonText(ctx, pickupBanner.label, width / 2, height * 0.185, {
    size: unit * 0.032,
    color: theme.colors.pickup,
    spacing: unit * 0.008,
    font: 'mono',
    weight: 700,
    alpha,
  });
}

/**
 * Just-in-time teaching. Both hints are derived from elapsed time, so they need
 * no extra state and always fire at the right moment in a run.
 */
function drawRunHints(ctx, game) {
  const { theme } = game;
  const { viewport, elapsed } = game;
  const { width, height, unit } = viewport;
  const voidTime = CONFIG.difficulty.voidGraceTime;

  const openingHint = fadeWindow(elapsed, 0.4, 3.6);
  if (openingHint > 0) {
    plainText(ctx, 'BLOCK THE LIGHT', width / 2, height * 0.78, {
      size: unit * 0.032,
      color: theme.colors.core,
      spacing: unit * 0.01,
      alpha: openingHint * 0.85,
    });
  }

  const voidHint = fadeWindow(elapsed, voidTime - 2, voidTime + 3.5);
  if (voidHint > 0) {
    plainText(ctx, 'RED SPIKES — DO NOT TOUCH', width / 2, height * 0.78, {
      size: unit * 0.032,
      color: theme.colors.danger,
      spacing: unit * 0.01,
      alpha: voidHint * 0.9,
    });
  }

  // Announces the moment the ramp ends and speed starts climbing for good.
  const rampEnd = CONFIG.difficulty.rampDuration;
  const overdriveHint = fadeWindow(elapsed, rampEnd - 1, rampEnd + 5, 0.8);
  if (overdriveHint > 0) {
    neonText(ctx, 'OVERDRIVE', width / 2, height * 0.775, {
      size: unit * 0.055,
      color: theme.colors.horizon,
      spacing: unit * 0.018,
      weight: 800,
      intensity: overdriveHint,
    });
    plainText(ctx, 'IT ONLY GETS FASTER FROM HERE', width / 2, height * 0.775 + unit * 0.05, {
      size: unit * 0.024,
      color: theme.colors.textDim,
      spacing: unit * 0.008,
      alpha: overdriveHint * 0.8,
    });
  }
}

/** 0 outside [start, end], ramping up and down at the edges. */
function fadeWindow(time, start, end, ramp = 0.6) {
  if (time < start || time > end) return 0;
  const rampIn = clamp((time - start) / ramp, 0, 1);
  const rampOut = clamp((end - time) / ramp, 0, 1);
  return Math.min(rampIn, rampOut);
}

function drawBackdrop(ctx, viewport, alpha) {
  ctx.save();
  ctx.fillStyle = withAlpha('#05020f', alpha);
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.restore();
}

export function drawMenu(ctx, game) {
  const { theme } = game;
  const { viewport, time, highScore } = game;
  const { width, height, unit } = viewport;

  drawBackdrop(ctx, viewport, 0.35);

  neonText(ctx, 'DEFLECT', width / 2, height * 0.15, {
    size: unit * 0.13,
    color: theme.colors.core,
    spacing: unit * 0.028,
    weight: 800,
  });

  plainText(ctx, 'NEON REFLEX ARCADE', width / 2, height * 0.15 + unit * 0.085, {
    size: unit * 0.028,
    color: theme.colors.horizon,
    spacing: unit * 0.018,
    alpha: 0.9,
  });

  if (highScore > 0) {
    plainText(ctx, `BEST ${highScore}`, width / 2, height * 0.15 + unit * 0.125, {
      size: unit * 0.026,
      color: theme.colors.textDim,
      spacing: unit * 0.006,
      font: 'mono',
    });
  }

  drawThemeProgress(ctx, game);
  drawHowToPlay(ctx, viewport, time, theme);

  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  plainText(ctx, 'CLICK  /  TAP  /  SPACE  TO  START', width / 2, height * 0.855, {
    size: unit * 0.032,
    color: theme.colors.text,
    spacing: unit * 0.006,
    alpha: pulse,
  });

  drawTabs(ctx, game);
}

/**
 * The bottom tab strip.
 *
 * Deliberately quiet. The menu's promise is that tapping anywhere plays, and
 * three loud buttons would make the player hunt for the right one instead.
 */
function drawTabs(ctx, game) {
  const buttons = tabButtons(game.viewport);
  const selectedId = buttons[game.menuSelection]?.id;

  for (const button of buttons) {
    drawButton(ctx, game, button, {
      selected: button.id === selectedId,
      accent: game.theme.colors.textDim,
    });
  }
}

/**
 * Active theme plus the next unlock, drawn on the menu.
 *
 * Showing the locked goal and the distance to it is what turns a counter into
 * motivation — a bar the player can see filling is worth more than a number
 * they only meet once it is already earned.
 */
function drawThemeProgress(ctx, game) {
  const { viewport, theme, profile } = game;
  const { height, unit } = viewport;
  // Pinned to the top-left corner: the centre belongs to the playfield, and on
  // short screens anything placed under the title collides with the shield.
  const x = unit * 0.045;
  const y = height * 0.05 + unit * 0.045;
  const goal = nextThemeGoal(profile);

  plainText(ctx, `THEME  ${theme.name}  [T]`, x, y, {
    size: unit * 0.021,
    color: theme.colors.textDim,
    spacing: unit * 0.004,
    align: 'left',
    font: 'mono',
    alpha: 0.7,
  });

  if (!goal) {
    plainText(ctx, 'ALL THEMES UNLOCKED', x, y + unit * 0.032, {
      size: unit * 0.019,
      color: theme.colors.gold,
      spacing: unit * 0.005,
      align: 'left',
      font: 'mono',
      alpha: 0.75,
    });
    return;
  }

  plainText(ctx, `NEXT  ${goal.theme.name}  ${goal.remaining}`, x, y + unit * 0.032, {
    size: unit * 0.019,
    color: theme.colors.textDim,
    spacing: unit * 0.004,
    align: 'left',
    font: 'mono',
    alpha: 0.55,
  });

  const barWidth = unit * 0.19;
  const barY = y + unit * 0.052;
  const filled = barWidth * clamp(goal.progress, 0, 1);

  ctx.save();
  ctx.fillStyle = withAlpha(theme.colors.textDim, 0.22);
  ctx.fillRect(x, barY, barWidth, unit * 0.004);
  ctx.fillStyle = withAlpha(goal.theme.colors.core, 0.85);
  ctx.fillRect(x, barY, filled, unit * 0.004);
  ctx.restore();
}

function drawHowToPlay(ctx, viewport, time, theme) {
  const { width, height, unit } = viewport;
  // Sits above the call to action with room to spare. The full explanation now
  // lives on its own screen; this row is only the three-second version.
  const y = height * 0.72;
  const spacing = unit * 0.26;
  const iconSize = unit * 0.024;

  HOW_TO_PLAY.forEach((entry, index) => {
    const x = width / 2 + (index - 1) * spacing;
    drawShardIcon(ctx, x, y, iconSize, entry.type, time * (entry.type === 'void' ? -1.6 : 0.9), theme);
    plainText(ctx, entry.label, x, y + unit * 0.042, {
      size: unit * 0.022,
      color: entry.type === 'void' ? theme.colors.danger : theme.colors.textDim,
      spacing: unit * 0.005,
      alpha: 0.85,
    });
  });
}

export function drawPaused(ctx, game) {
  const { theme } = game;
  const { viewport, time } = game;
  const { width, height, unit } = viewport;

  drawBackdrop(ctx, viewport, 0.55);
  neonText(ctx, 'PAUSED', width / 2, height * 0.45, {
    size: unit * 0.085,
    color: theme.colors.core,
    spacing: unit * 0.02,
    weight: 800,
  });

  plainText(ctx, 'CLICK OR PRESS P TO RESUME', width / 2, height * 0.56, {
    size: unit * 0.028,
    color: theme.colors.text,
    spacing: unit * 0.006,
    alpha: 0.6 + 0.4 * Math.sin(time * 3),
  });
}

export function drawGameOver(ctx, game) {
  const { theme } = game;
  const { viewport, score, highScore, bestCombo, newRecord, elapsed, time } = game;
  const { width, height, unit } = viewport;

  const reveal = easeOutCubic(clamp(elapsed / 0.5, 0, 1));
  drawBackdrop(ctx, viewport, 0.62 * reveal);

  neonText(ctx, 'CORE BREACH', width / 2, height * 0.28, {
    size: unit * 0.07,
    color: theme.colors.danger,
    spacing: unit * 0.018,
    weight: 800,
    intensity: reveal,
  });

  neonText(ctx, String(Math.floor(score)), width / 2, height * 0.44, {
    size: unit * 0.15,
    color: newRecord ? theme.colors.gold : theme.colors.text,
    spacing: unit * 0.012,
    font: 'mono',
    weight: 700,
    intensity: reveal,
  });

  const subtitle = newRecord ? 'NEW RECORD' : `BEST ${highScore}`;
  plainText(ctx, subtitle, width / 2, height * 0.55, {
    size: unit * 0.032,
    color: newRecord ? theme.colors.gold : theme.colors.textDim,
    spacing: unit * 0.012,
    font: newRecord ? 'sans' : 'mono',
    alpha: newRecord ? 0.75 + 0.25 * Math.sin(time * 6) : 0.8,
  });

  plainText(ctx, `LONGEST STREAK  ${bestCombo}`, width / 2, height * 0.61, {
    size: unit * 0.025,
    color: theme.colors.textDim,
    spacing: unit * 0.006,
    font: 'mono',
    alpha: 0.7,
  });

  drawUnlockCard(ctx, game);

  if (elapsed < 0.6) return;
  plainText(ctx, 'CLICK  /  TAP  /  SPACE  TO  RETRY', width / 2, height * 0.82, {
    size: unit * 0.03,
    color: theme.colors.text,
    spacing: unit * 0.006,
    alpha: 0.55 + 0.45 * Math.sin(time * 3.4),
  });
}

/**
 * Celebration for anything unlocked by the run that just ended.
 *
 * It lands on the score screen rather than in a menu, because the player is
 * already looking here — making them dig for the reward would waste the moment.
 */
function drawUnlockCard(ctx, game) {
  const { viewport, pendingUnlocks, elapsed, time } = game;
  if (!pendingUnlocks.length) return;

  const { width, height, unit } = viewport;
  const unlock = pendingUnlocks[0];
  const accent = unlock.theme ? unlock.theme.colors.core : game.theme.colors.gold;

  // Slides in a beat after the score so the two do not compete for attention.
  const reveal = easeOutCubic(clamp((elapsed - 0.7) / 0.5, 0, 1));
  if (reveal <= 0) return;

  const y = height * 0.72;
  const pulse = 0.75 + 0.25 * Math.sin(time * 4);

  plainText(ctx, 'NEW THEME UNLOCKED', width / 2, y - unit * 0.045, {
    size: unit * 0.022,
    color: game.theme.colors.textDim,
    spacing: unit * 0.012,
    alpha: reveal * 0.85,
  });

  neonText(ctx, unlock.title, width / 2, y, {
    size: unit * 0.058,
    color: accent,
    spacing: unit * 0.016,
    weight: 800,
    intensity: reveal * pulse,
  });

  plainText(ctx, unlock.subtitle, width / 2, y + unit * 0.045, {
    size: unit * 0.022,
    color: accent,
    spacing: unit * 0.006,
    alpha: reveal * 0.7,
  });
}
