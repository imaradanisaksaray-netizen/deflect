/**
 * Game state and rules.
 *
 * Rules in one paragraph: shards fly at the core from every direction. Cyan and
 * gold shards must be blocked with the shield. Red void spikes must NOT be
 * touched — let them pass through the core, which absorbs them harmlessly.
 * Blocking builds a combo multiplier; losing all three core segments ends the run.
 */

import { CONFIG } from '../config.js';
import {
  playBlock,
  playDamage,
  playGameOver,
  playGold,
  playNewRecord,
  playStart,
  playVoidPass,
} from '../audio.js';
import { clamp, damp, rand } from '../math.js';
import { createShield, registerImpact, updateShield } from '../entities/shield.js';
import { updateProjectiles } from '../entities/projectiles.js';
import { clearEffects, createEffects, emitBurst, emitWave, updateEffects } from '../entities/particles.js';
import { resolveCollisions } from '../systems/collision.js';
import { createSpawner, updateSpawner } from '../systems/spawner.js';
import { difficultyAt } from '../systems/difficulty.js';
import { readHighScore, writeHighScore } from '../storage.js';
import { toScreenX, toScreenY } from '../viewport.js';

export const SCREEN = {
  menu: 'menu',
  playing: 'playing',
  paused: 'paused',
  gameover: 'gameover',
};

export function createGame(viewport, input) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  return {
    viewport,
    input,
    reducedMotion,
    screen: SCREEN.menu,
    shield: createShield(),
    projectiles: [],
    effects: createEffects(reducedMotion ? 0.3 : 1),
    spawner: createSpawner(),
    difficulty: difficultyAt(0),
    /** Wall-clock time, always advancing — drives background animation. */
    time: 0,
    elapsed: 0,
    score: 0,
    highScore: readHighScore(),
    newRecord: false,
    lives: CONFIG.play.startLives,
    combo: 0,
    bestCombo: 0,
    multiplier: 1,
    invulnerable: 0,
    shake: 0,
    hitStop: 0,
    coreFlash: 0,
    /** Ramps 0 -> 1 on start so the first shard never arrives before the eye settles. */
    introFade: 0,
    /** Playfield zoom, eased between menu and play framing. */
    worldScale: CONFIG.feel.menuWorldScale,
  };
}

export function startRun(game) {
  game.screen = SCREEN.playing;
  game.projectiles.length = 0;
  game.spawner = createSpawner();
  game.shield = createShield();
  game.difficulty = difficultyAt(0);
  game.elapsed = 0;
  game.score = 0;
  game.lives = CONFIG.play.startLives;
  game.combo = 0;
  game.bestCombo = 0;
  game.multiplier = 1;
  game.invulnerable = 0;
  game.newRecord = false;
  game.introFade = 0;
  clearEffects(game.effects);
  playStart();
}

function endRun(game) {
  game.screen = SCREEN.gameover;
  game.shake = Math.min(CONFIG.feel.maxShake, game.shake + 0.03);

  if (Math.floor(game.score) > game.highScore) {
    game.highScore = Math.floor(game.score);
    game.newRecord = true;
    writeHighScore(game.highScore);
    playNewRecord();
  } else {
    playGameOver();
  }
}

/** Primary action: click / tap / Space. Meaning depends on the current screen. */
export function handleAction(game) {
  if (game.screen === SCREEN.menu) return startRun(game);
  if (game.screen === SCREEN.paused) game.screen = SCREEN.playing;
  // A run is only restartable after a short beat, so the death tap never
  // instantly burns the next run.
  if (game.screen === SCREEN.gameover && game.elapsed > 0.6) return startRun(game);
  return undefined;
}

export function togglePause(game) {
  if (game.screen === SCREEN.playing) game.screen = SCREEN.paused;
  else if (game.screen === SCREEN.paused) game.screen = SCREEN.playing;
}

export function pauseIfPlaying(game) {
  if (game.screen === SCREEN.playing) game.screen = SCREEN.paused;
}

export function updateGame(game, dt) {
  game.time += dt;

  const isLive = game.screen === SCREEN.playing || game.screen === SCREEN.paused;
  game.worldScale = damp(game.worldScale, isLive ? 1 : CONFIG.feel.menuWorldScale, 7, dt);

  updateEffects(game.effects, dt);
  game.shake = damp(game.shake, 0, CONFIG.feel.shakeDecay, dt);
  game.coreFlash = Math.max(0, game.coreFlash - dt * 2.6);

  // The shield keeps tracking on every screen so the game always feels alive.
  updateShield(game.shield, game.input, dt, game.screen === SCREEN.menu ? 0.5 : 0);

  if (game.screen !== SCREEN.playing) {
    if (game.screen === SCREEN.gameover) game.elapsed += dt;
    return;
  }

  // Hit stop: a brief slow-motion beat that sells every impact.
  let scaledDt = dt;
  if (game.hitStop > 0) {
    game.hitStop -= dt;
    scaledDt = dt * 0.15;
  }

  game.introFade = Math.min(1, game.introFade + dt * 1.4);
  game.elapsed += scaledDt;
  game.difficulty = difficultyAt(game.elapsed);
  game.invulnerable = Math.max(0, game.invulnerable - scaledDt);

  updateSpawner(game.spawner, game, game.difficulty, scaledDt);
  updateProjectiles(game.projectiles, scaledDt);

  const events = [];
  resolveCollisions(game, events);
  applyEvents(game, events);

  game.score += CONFIG.play.scorePerSecond * game.multiplier * scaledDt;
}

function applyEvents(game, events) {
  for (const event of events) {
    switch (event.type) {
      case 'block':
        onBlock(game, event);
        break;
      case 'voidBlock':
      case 'coreHit':
        onDamage(game, event);
        break;
      case 'voidPass':
        onVoidPass(game);
        break;
      default:
        break;
    }
  }
}

function onBlock(game, event) {
  const { projectile } = event;
  const isGold = projectile.type === 'gold';

  game.combo += 1;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.multiplier = clamp(
    1 + Math.floor(game.combo / CONFIG.play.comboStep),
    1,
    CONFIG.play.maxMultiplier,
  );
  game.score += projectile.archetype.score * game.multiplier;

  registerImpact(game.shield, isGold ? 1.3 : 1);
  game.shake = Math.min(CONFIG.feel.maxShake, game.shake + (isGold ? 0.009 : 0.005));

  const x = toScreenX(game.viewport, projectile.angle, event.distance);
  const y = toScreenY(game.viewport, projectile.angle, event.distance);
  const color = projectile.archetype.color;

  emitBurst(game.effects, {
    x,
    y,
    color,
    count: isGold ? 26 : 15,
    // Sparks fly back outward, away from the core.
    direction: projectile.angle + Math.PI,
    spread: 2.1,
    speed: isGold ? 380 : 290,
  });
  emitWave(game.effects, {
    x,
    y,
    color,
    radius: game.viewport.unit * 0.02,
    life: 0.34,
    thickness: isGold ? 5 : 3,
  });

  if (isGold) playGold();
  else playBlock(game.multiplier - 1);
}

function onDamage(game, event) {
  const { projectile } = event;
  const x = toScreenX(game.viewport, projectile.angle, event.distance);
  const y = toScreenY(game.viewport, projectile.angle, event.distance);

  emitBurst(game.effects, {
    x,
    y,
    color: projectile.archetype.color,
    count: 30,
    speed: 420,
  });

  if (game.invulnerable > 0) return;

  game.lives -= 1;
  game.combo = 0;
  game.multiplier = 1;
  game.invulnerable = CONFIG.play.invulnerableTime;
  game.hitStop = CONFIG.feel.hitStopDuration;
  game.coreFlash = 1;
  game.shake = Math.min(CONFIG.feel.maxShake, game.shake + 0.026);

  emitWave(game.effects, {
    x: game.viewport.centerX,
    y: game.viewport.centerY,
    color: CONFIG.colors.danger,
    radius: game.viewport.unit * CONFIG.world.coreRadius,
    life: 0.5,
    thickness: 6,
    growth: 640,
  });
  playDamage();

  if (game.lives <= 0) endRun(game);
}

function onVoidPass(game) {
  emitBurst(game.effects, {
    x: game.viewport.centerX + rand(-6, 6),
    y: game.viewport.centerY + rand(-6, 6),
    color: CONFIG.colors.void,
    count: 8,
    speed: 120,
    size: 2,
  });
  playVoidPass();
  // Absorbing void is the intended outcome, so it pays a small bonus.
  game.score += 5 * game.multiplier;
}
