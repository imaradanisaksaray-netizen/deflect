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
  playPickup,
  playReveal,
  playShellCrack,
  playStart,
  playVoidPass,
} from '../audio.js';
import { clamp, damp, rand } from '../math.js';
import { createShield, registerImpact, setShieldSpan, updateShield } from '../entities/shield.js';
import { colorKeyOf, createFragments, isBlockable, updateProjectiles } from '../entities/projectiles.js';
import { clearEffects, createEffects, emitBurst, emitWave, updateEffects } from '../entities/particles.js';
import { resolveCollisions } from '../systems/collision.js';
import { createPickupSpawner, updatePickupSpawner, updatePickups } from '../systems/pickups.js';
import { createSpawner, updateSpawner } from '../systems/spawner.js';
import { difficultyAt } from '../systems/difficulty.js';
import { loadProfile, markUnlocksSeen, recordRun, saveProfile } from '../progress/profile.js';
import { collectUnlocks, unlockedTypeKeys } from '../progress/unlocks.js';
import { getTheme } from '../themes/index.js';
import { toScreenX, toScreenY } from '../viewport.js';

export const SCREEN = {
  menu: 'menu',
  playing: 'playing',
  paused: 'paused',
  gameover: 'gameover',
};

export function createGame(viewport, input) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const profile = loadProfile();

  return {
    viewport,
    input,
    reducedMotion,
    /** Persistent progress across runs. Replaced (not mutated) on every save. */
    profile,
    theme: getTheme(profile.themeId),
    /** Unlocks earned by the run that just ended, shown once on the score screen. */
    pendingUnlocks: [],
    /** Shards blocked in the current run — folded into the profile at run end. */
    blocks: 0,
    /** Shard types the profile has unlocked; the spawner draws from this. */
    availableTypes: unlockedTypeKeys(profile),
    screen: SCREEN.menu,
    shield: createShield(),
    projectiles: [],
    /** Rewards currently drifting in. At most one at a time. */
    pickups: [],
    /** Seconds remaining on each timed reward; 0 means inactive. */
    buffs: { extend: 0, slow: 0 },
    /** The reward just collected, shown briefly in the HUD. */
    pickupBanner: null,
    effects: createEffects(reducedMotion ? 0.3 : 1),
    spawner: createSpawner(),
    pickupSpawner: createPickupSpawner(),
    difficulty: difficultyAt(0),
    /** Wall-clock time, always advancing — drives background animation. */
    time: 0,
    elapsed: 0,
    score: 0,
    highScore: profile.bestScore,
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
  game.pickups.length = 0;
  game.buffs = { extend: 0, slow: 0 };
  game.pickupBanner = null;
  game.spawner = createSpawner();
  game.pickupSpawner = createPickupSpawner();
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
  game.blocks = 0;
  game.pendingUnlocks = [];
  // Re-read in case the previous run unlocked a new threat.
  game.availableTypes = unlockedTypeKeys(game.profile);
  clearEffects(game.effects);
  playStart();
}

function endRun(game) {
  game.screen = SCREEN.gameover;
  // Rewards do not outlive the run that earned them.
  game.buffs = { extend: 0, slow: 0 };
  game.pickups.length = 0;
  game.shake = Math.min(CONFIG.feel.maxShake, game.shake + 0.03);

  const score = Math.floor(game.score);
  const before = game.profile;
  const after = recordRun(before, {
    blocks: game.blocks,
    streak: game.bestCombo,
    seconds: game.elapsed,
    score,
  });

  // Unlocks are derived by comparing the profile before and after the run, so
  // the run that crosses a threshold is the one that celebrates it.
  game.pendingUnlocks = collectUnlocks(before, after);
  game.profile = game.pendingUnlocks.length
    ? markUnlocksSeen(after, game.pendingUnlocks.map((u) => u.id))
    : after;
  saveProfile(game.profile);

  if (score > game.highScore) {
    game.highScore = score;
    game.newRecord = true;
    playNewRecord();
  } else {
    playGameOver();
  }
}

/** Switches the active theme and remembers the choice. */
export function applyTheme(game, themeId) {
  game.theme = getTheme(themeId);
  game.profile = { ...game.profile, themeId: game.theme.id };
  saveProfile(game.profile);
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
  setShieldSpan(
    game.shield,
    CONFIG.shield.arcSpan * (game.buffs.extend > 0 ? CONFIG.pickups.extendScale : 1),
    dt,
  );

  if (game.pickupBanner) {
    game.pickupBanner.life -= dt;
    if (game.pickupBanner.life <= 0) game.pickupBanner = null;
  }

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

  // Buffs burn real seconds, never slowed ones — otherwise SLIPSTREAM would
  // stretch its own duration and a six-second reward would last thirteen.
  game.buffs.extend = Math.max(0, game.buffs.extend - dt);
  game.buffs.slow = Math.max(0, game.buffs.slow - dt);

  // SLIPSTREAM slows the entire run, the clock included. Safety costs score,
  // which is what stops it from being a strictly free reward.
  if (game.buffs.slow > 0) scaledDt *= CONFIG.pickups.slowFactor;

  game.introFade = Math.min(1, game.introFade + dt * 1.4);
  game.elapsed += scaledDt;
  game.difficulty = difficultyAt(game.elapsed);
  game.invulnerable = Math.max(0, game.invulnerable - scaledDt);

  updateSpawner(game.spawner, game, game.difficulty, scaledDt);
  updateProjectiles(game.projectiles, scaledDt);
  announceReveals(game);

  const events = [];
  updatePickupSpawner(game.pickupSpawner, game, scaledDt);
  updatePickups(game, scaledDt, events);
  resolveCollisions(game, events);
  applyEvents(game, events);

  game.score += CONFIG.play.scorePerSecond * game.multiplier * scaledDt;
}

/**
 * Plays the warning sting the first time each mimic drops its disguise.
 *
 * The reveal itself happens in projectiles.js, which has no business importing
 * audio — so the sound is triggered here, once per shard.
 */
function announceReveals(game) {
  for (const projectile of game.projectiles) {
    if (projectile.revealed && !projectile.revealAnnounced) {
      projectile.revealAnnounced = true;
      playReveal();
    }
  }
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
      case 'shellCrack':
        onShellCrack(game, event);
        break;
      case 'voidPass':
        onVoidPass(game);
        break;
      case 'pickup':
        onPickup(game, event);
        break;
      default:
        break;
    }
  }
}

function onBlock(game, event) {
  const { theme } = game;
  const { projectile } = event;
  const isGold = projectile.type === 'gold';

  game.blocks += 1;
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
  const color = theme.colors[colorKeyOf(projectile)];

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

  // A splitter is only half dealt with: destroying it releases fragments that
  // re-enter from just outside the shield band, so they cannot collide on the
  // same frame they are born.
  if (projectile.archetype.splitInto) {
    const releaseDistance = event.distance + 0.07;
    game.projectiles.push(...createFragments(projectile, releaseDistance));
  }
}

/** Armoured shard survived a block: shell gone, shard pushed back out. */
function onShellCrack(game, event) {
  const { theme } = game;
  const { projectile } = event;
  const x = toScreenX(game.viewport, projectile.angle, event.distance);
  const y = toScreenY(game.viewport, projectile.angle, event.distance);

  emitBurst(game.effects, {
    x,
    y,
    color: theme.colors.shieldEdge,
    count: 12,
    direction: projectile.angle + Math.PI,
    spread: 1.6,
    speed: 220,
    size: 2,
  });

  registerImpact(game.shield, 0.6);
  game.shake = Math.min(CONFIG.feel.maxShake, game.shake + 0.004);
  playShellCrack();
}

function onDamage(game, event) {
  const { theme } = game;
  const { projectile } = event;
  const x = toScreenX(game.viewport, projectile.angle, event.distance);
  const y = toScreenY(game.viewport, projectile.angle, event.distance);

  emitBurst(game.effects, {
    x,
    y,
    color: theme.colors[colorKeyOf(projectile)],
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
    color: theme.colors.danger,
    radius: game.viewport.unit * CONFIG.world.coreRadius,
    life: 0.5,
    thickness: 6,
    growth: 640,
  });
  playDamage();

  if (game.lives <= 0) endRun(game);
}

/**
 * A reward was caught.
 *
 * The effect is applied here rather than in pickups.js because every one of them
 * reaches into a different part of the run — lives, the shield, the clock, the
 * whole projectile list — and that is exactly the state this module owns.
 */
function onPickup(game, event) {
  const { theme } = game;
  const { pickup } = event;
  const x = toScreenX(game.viewport, pickup.angle, event.distance);
  const y = toScreenY(game.viewport, pickup.angle, event.distance);

  switch (pickup.type) {
    case 'life':
      game.lives = Math.min(CONFIG.pickups.maxLives, game.lives + 1);
      game.coreFlash = 1;
      break;
    case 'extend':
    case 'slow':
      // Re-catching a reward refreshes it rather than stacking, so the ceiling
      // on how safe a run can get stays fixed.
      game.buffs[pickup.type] = pickup.archetype.duration;
      break;
    case 'nova':
      detonateNova(game);
      break;
    default:
      break;
  }

  game.pickupBanner = { label: pickup.archetype.label, life: 1.6 };
  registerImpact(game.shield, 1.2);

  emitBurst(game.effects, {
    x,
    y,
    color: theme.colors.pickup,
    count: 30,
    direction: pickup.angle + Math.PI,
    spread: Math.PI,
    speed: 340,
  });
  emitWave(game.effects, {
    x,
    y,
    color: theme.colors.pickup,
    radius: game.viewport.unit * 0.02,
    life: 0.5,
    thickness: 4,
    growth: 420,
  });
  playPickup();
}

/**
 * Clears the screen of everything that could have been blocked, paying for each.
 *
 * Void spikes survive on purpose: a reward that erased the one threat the player
 * is meant to dodge would teach the wrong reflex, and it would make the safest
 * play "grab nova, then ignore red".
 */
function detonateNova(game) {
  const { theme } = game;
  let cleared = 0;

  for (const projectile of game.projectiles) {
    if (!projectile.alive || !isBlockable(projectile)) continue;
    projectile.alive = false;
    cleared += 1;
    game.score += projectile.archetype.score * game.multiplier;

    emitBurst(game.effects, {
      x: toScreenX(game.viewport, projectile.angle, projectile.distance),
      y: toScreenY(game.viewport, projectile.angle, projectile.distance),
      color: theme.colors[colorKeyOf(projectile)],
      count: 10,
      speed: 300,
      size: 2,
    });
  }

  game.blocks += cleared;
  game.shake = Math.min(CONFIG.feel.maxShake, game.shake + 0.02);
  emitWave(game.effects, {
    x: game.viewport.centerX,
    y: game.viewport.centerY,
    color: theme.colors.pickup,
    radius: game.viewport.unit * CONFIG.world.coreRadius,
    life: 0.6,
    thickness: 7,
    growth: 900,
  });
}

function onVoidPass(game) {
  const { theme } = game;
  emitBurst(game.effects, {
    x: game.viewport.centerX + rand(-6, 6),
    y: game.viewport.centerY + rand(-6, 6),
    color: theme.colors.void,
    count: 8,
    speed: 120,
    size: 2,
  });
  playVoidPass();
  // Absorbing void is the intended outcome, so it pays a small bonus.
  game.score += 5 * game.multiplier;
}
