/**
 * HUD and full-screen states (menu, pause, game over).
 *
 * Vertical positions are anchored to viewport height while text sizes are
 * anchored to the reference unit, so nothing collides with the playfield on
 * extreme aspect ratios.
 */

import { CONFIG } from '../config.js';
import { isMuted } from '../audio.js';
import { clamp, easeOutCubic } from '../math.js';
import { SCREEN } from '../state/game.js';
import { drawShardIcon } from './entities.js';
import { neonText, plainText, withAlpha } from './neon.js';

const HOW_TO_PLAY = [
  { type: 'shard', label: 'BLOCK' },
  { type: 'gold', label: 'BONUS' },
  { type: 'void', label: 'AVOID' },
];

function multiplierColor(multiplier) {
  if (multiplier >= 5) return CONFIG.colors.horizon;
  if (multiplier >= 3) return CONFIG.colors.gold;
  return CONFIG.colors.core;
}

export function drawHud(ctx, game) {
  const { viewport, screen } = game;
  const { width, height, unit } = viewport;

  if (screen === SCREEN.playing || screen === SCREEN.paused) {
    drawScore(ctx, game);
    drawRunHints(ctx, game);
  }

  // The menu prints its own, larger BEST line — no need to show it twice.
  if (screen !== SCREEN.menu) {
    plainText(ctx, `BEST ${game.highScore}`, width - unit * 0.045, height * 0.05, {
      size: unit * 0.026,
      color: CONFIG.colors.textDim,
      spacing: unit * 0.004,
      align: 'right',
      font: 'mono',
      alpha: 0.75,
    });
  }

  plainText(ctx, isMuted() ? 'SOUND OFF  [M]' : 'SOUND ON  [M]', unit * 0.045, height * 0.05, {
    size: unit * 0.022,
    color: CONFIG.colors.textDim,
    spacing: unit * 0.003,
    align: 'left',
    font: 'mono',
    alpha: 0.5,
  });
}

function drawScore(ctx, game) {
  const { viewport, score, multiplier } = game;
  const { width, height, unit } = viewport;

  neonText(ctx, String(Math.floor(score)).padStart(4, '0'), width / 2, height * 0.085, {
    size: unit * 0.078,
    color: CONFIG.colors.text,
    spacing: unit * 0.008,
    font: 'mono',
    weight: 700,
  });

  if (multiplier <= 1) return;

  const color = multiplierColor(multiplier);
  neonText(ctx, `x${multiplier}`, width / 2, height * 0.085 + unit * 0.062, {
    size: unit * 0.04,
    color,
    spacing: unit * 0.004,
    font: 'mono',
    weight: 700,
  });
}

/**
 * Just-in-time teaching. Both hints are derived from elapsed time, so they need
 * no extra state and always fire at the right moment in a run.
 */
function drawRunHints(ctx, game) {
  const { viewport, elapsed } = game;
  const { width, height, unit } = viewport;
  const voidTime = CONFIG.difficulty.voidGraceTime;

  const openingHint = fadeWindow(elapsed, 0.4, 3.6);
  if (openingHint > 0) {
    plainText(ctx, 'BLOCK THE LIGHT', width / 2, height * 0.78, {
      size: unit * 0.032,
      color: CONFIG.colors.core,
      spacing: unit * 0.01,
      alpha: openingHint * 0.85,
    });
  }

  const voidHint = fadeWindow(elapsed, voidTime - 2, voidTime + 3.5);
  if (voidHint > 0) {
    plainText(ctx, 'RED SPIKES — DO NOT TOUCH', width / 2, height * 0.78, {
      size: unit * 0.032,
      color: CONFIG.colors.danger,
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
      color: CONFIG.colors.horizon,
      spacing: unit * 0.018,
      weight: 800,
      intensity: overdriveHint,
    });
    plainText(ctx, 'IT ONLY GETS FASTER FROM HERE', width / 2, height * 0.775 + unit * 0.05, {
      size: unit * 0.024,
      color: CONFIG.colors.textDim,
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
  const { viewport, time, highScore } = game;
  const { width, height, unit } = viewport;

  drawBackdrop(ctx, viewport, 0.35);

  neonText(ctx, 'DEFLECT', width / 2, height * 0.15, {
    size: unit * 0.13,
    color: CONFIG.colors.core,
    spacing: unit * 0.028,
    weight: 800,
  });

  plainText(ctx, 'NEON REFLEX ARCADE', width / 2, height * 0.15 + unit * 0.085, {
    size: unit * 0.028,
    color: CONFIG.colors.horizon,
    spacing: unit * 0.018,
    alpha: 0.9,
  });

  if (highScore > 0) {
    plainText(ctx, `BEST ${highScore}`, width / 2, height * 0.15 + unit * 0.125, {
      size: unit * 0.026,
      color: CONFIG.colors.textDim,
      spacing: unit * 0.006,
      font: 'mono',
    });
  }

  drawHowToPlay(ctx, viewport, time);

  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  plainText(ctx, 'CLICK  /  TAP  /  SPACE  TO  START', width / 2, height * 0.875, {
    size: unit * 0.032,
    color: CONFIG.colors.text,
    spacing: unit * 0.006,
    alpha: pulse,
  });

  plainText(ctx, 'AIM WITH MOUSE, TOUCH OR ARROW KEYS', width / 2, height * 0.945, {
    size: unit * 0.022,
    color: CONFIG.colors.textDim,
    spacing: unit * 0.004,
    alpha: 0.6,
  });
}

function drawHowToPlay(ctx, viewport, time) {
  const { width, height, unit } = viewport;
  const y = height * 0.775;
  const spacing = unit * 0.26;
  const iconSize = unit * 0.024;

  HOW_TO_PLAY.forEach((entry, index) => {
    const x = width / 2 + (index - 1) * spacing;
    drawShardIcon(ctx, x, y, iconSize, entry.type, time * (entry.type === 'void' ? -1.6 : 0.9));
    plainText(ctx, entry.label, x, y + unit * 0.042, {
      size: unit * 0.022,
      color: entry.type === 'void' ? CONFIG.colors.danger : CONFIG.colors.textDim,
      spacing: unit * 0.005,
      alpha: 0.85,
    });
  });
}

export function drawPaused(ctx, game) {
  const { viewport, time } = game;
  const { width, height, unit } = viewport;

  drawBackdrop(ctx, viewport, 0.55);
  neonText(ctx, 'PAUSED', width / 2, height * 0.45, {
    size: unit * 0.085,
    color: CONFIG.colors.core,
    spacing: unit * 0.02,
    weight: 800,
  });

  plainText(ctx, 'CLICK OR PRESS P TO RESUME', width / 2, height * 0.56, {
    size: unit * 0.028,
    color: CONFIG.colors.text,
    spacing: unit * 0.006,
    alpha: 0.6 + 0.4 * Math.sin(time * 3),
  });
}

export function drawGameOver(ctx, game) {
  const { viewport, score, highScore, bestCombo, newRecord, elapsed, time } = game;
  const { width, height, unit } = viewport;

  const reveal = easeOutCubic(clamp(elapsed / 0.5, 0, 1));
  drawBackdrop(ctx, viewport, 0.62 * reveal);

  neonText(ctx, 'CORE BREACH', width / 2, height * 0.28, {
    size: unit * 0.07,
    color: CONFIG.colors.danger,
    spacing: unit * 0.018,
    weight: 800,
    intensity: reveal,
  });

  neonText(ctx, String(Math.floor(score)), width / 2, height * 0.44, {
    size: unit * 0.15,
    color: newRecord ? CONFIG.colors.gold : CONFIG.colors.text,
    spacing: unit * 0.012,
    font: 'mono',
    weight: 700,
    intensity: reveal,
  });

  const subtitle = newRecord ? 'NEW RECORD' : `BEST ${highScore}`;
  plainText(ctx, subtitle, width / 2, height * 0.55, {
    size: unit * 0.032,
    color: newRecord ? CONFIG.colors.gold : CONFIG.colors.textDim,
    spacing: unit * 0.012,
    font: newRecord ? 'sans' : 'mono',
    alpha: newRecord ? 0.75 + 0.25 * Math.sin(time * 6) : 0.8,
  });

  plainText(ctx, `LONGEST STREAK  ${bestCombo}`, width / 2, height * 0.61, {
    size: unit * 0.025,
    color: CONFIG.colors.textDim,
    spacing: unit * 0.006,
    font: 'mono',
    alpha: 0.7,
  });

  if (elapsed < 0.6) return;
  plainText(ctx, 'CLICK  /  TAP  /  SPACE  TO  RETRY', width / 2, height * 0.75, {
    size: unit * 0.03,
    color: CONFIG.colors.text,
    spacing: unit * 0.006,
    alpha: 0.55 + 0.45 * Math.sin(time * 3.4),
  });
}
