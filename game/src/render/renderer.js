/**
 * Frame composition.
 *
 * Screen shake is applied to the world layer only — the HUD stays pinned, which
 * keeps the score readable through the biggest impacts.
 */

import { CONFIG } from '../config.js';
import { clamp, rand } from '../math.js';
import { SCREEN } from '../state/game.js';
import { createBackground, drawBackground, updateBackground } from './background.js';
import { drawCore, drawPickups, drawProjectiles, drawShield } from './entities.js';
import { drawEffects } from './effects.js';
import { drawGameOver, drawHud, drawMenu, drawPaused } from './hud.js';

export function createRenderer(ctx, viewport, theme) {
  return { ctx, viewport, background: createBackground(theme), themeId: theme.id };
}

export function render(renderer, game, dt) {
  const { ctx, viewport } = renderer;
  const { theme } = game;

  // Star density and particle physics are baked in at creation, so a theme
  // switch needs a fresh backdrop rather than a palette swap.
  if (renderer.themeId !== theme.id) {
    renderer.background = createBackground(theme);
    renderer.themeId = theme.id;
  }

  const energy = computeEnergy(game);
  const danger = computeDanger(game);

  updateBackground(renderer.background, dt, energy, theme);
  drawBackground(ctx, renderer.background, viewport, { time: game.time, energy, danger, theme });

  const shake = game.reducedMotion ? 0 : game.shake * viewport.unit;
  ctx.save();
  if (shake > 0.01) ctx.translate(rand(-shake, shake), rand(-shake, shake));

  // Zoom the playfield about its own centre, so menu text has breathing room.
  if (Math.abs(game.worldScale - 1) > 0.001) {
    ctx.translate(viewport.centerX, viewport.centerY);
    ctx.scale(game.worldScale, game.worldScale);
    ctx.translate(-viewport.centerX, -viewport.centerY);
  }

  drawProjectiles(ctx, game);
  drawPickups(ctx, game);
  drawShield(ctx, game);
  drawCore(ctx, game);
  drawEffects(ctx, game.effects);
  ctx.restore();

  drawHud(ctx, game);

  if (game.screen === SCREEN.menu) drawMenu(ctx, game);
  else if (game.screen === SCREEN.paused) drawPaused(ctx, game);
  else if (game.screen === SCREEN.gameover) drawGameOver(ctx, game);
}

/** Drives how fast and bright the backdrop reacts. */
function computeEnergy(game) {
  if (game.screen === SCREEN.menu) return 0.15;

  const comboEnergy = clamp((game.multiplier - 1) / (CONFIG.play.maxMultiplier - 1), 0, 1);
  // Overtime keeps feeding the backdrop after the ramp tops out, so the screen
  // visibly escalates alongside the shard speed.
  const overdriveEnergy = clamp((game.difficulty.overdrive - 1) / 2, 0, 1);

  return clamp(
    comboEnergy * 0.45 + game.difficulty.curve * 0.3 + overdriveEnergy * 0.25,
    0,
    1,
  );
}

/** Red wash on the last life, plus a flash on every hit. */
function computeDanger(game) {
  if (game.screen === SCREEN.playing && game.lives <= 1) {
    return 0.45 + 0.35 * Math.abs(Math.sin(game.time * 3.4));
  }
  return game.coreFlash * 0.6;
}
