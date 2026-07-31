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
import {
  beginRun as beginAdRun,
  canOfferRewarded,
  createAdPolicy,
  recordDeath,
  recordInterstitial,
  recordRewarded,
  shouldShowInterstitial,
} from '../ads/policy.js';
import { createAdService } from '../ads/provider.js';
import { addRun, loadBoard, saveBoard } from '../progress/leaderboard.js';
import { loadProfile, markUnlocksSeen, recordRun, saveProfile } from '../progress/profile.js';
import { collectUnlocks, unlockedTypeKeys } from '../progress/unlocks.js';
import { getTheme } from '../themes/index.js';
import {
  backButton,
  continueButton,
  hitTest,
  tabButtons,
  themeButtons,
} from '../ui/menu.js';
import { toScreenX, toScreenY } from '../viewport.js';

export const SCREEN = {
  menu: 'menu',
  playing: 'playing',
  paused: 'paused',
  gameover: 'gameover',
  themes: 'themes',
  scores: 'scores',
  stats: 'stats',
  help: 'help',
};

/** Screens that are part of the menu flow rather than a run. */
const MENU_SCREENS = new Set([
  SCREEN.menu, SCREEN.themes, SCREEN.scores, SCREEN.stats, SCREEN.help,
]);

export const isMenuScreen = (screen) => MENU_SCREENS.has(screen);

export function createGame(viewport, input, ads = createAdService()) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const profile = loadProfile();

  return {
    viewport,
    input,
    reducedMotion,
    /** Ad transport. Resolves to "no ad" everywhere outside a portal. */
    ads,
    adPolicy: createAdPolicy(),
    /** True while an ad is on screen; input is ignored until it clears. */
    adBusy: false,
    /** Persistent progress across runs. Replaced (not mutated) on every save. */
    profile,
    /** The ten best runs on this device, best first. */
    board: loadBoard(),
    /** Where the run that just ended landed on the board; 0 means it missed. */
    lastRank: 0,
    theme: getTheme(profile.themeId),
    /** Unlocks earned by the run that just ended, shown once on the score screen. */
    pendingUnlocks: [],
    /** Shards blocked in the current run — folded into the profile at run end. */
    blocks: 0,
    /** Shard types the profile has unlocked; the spawner draws from this. */
    availableTypes: unlockedTypeKeys(profile),
    screen: SCREEN.menu,
    /** Keyboard-selected menu entry; -1 means the pointer is in charge. */
    menuSelection: -1,
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
  game.adPolicy = beginAdRun(game.adPolicy);
  clearEffects(game.effects);
  game.ads.gameplayStart();
  playStart();
}

/**
 * Resumes the run that just ended, after a rewarded ad was watched.
 *
 * Everything the run earned is kept — score, elapsed time, difficulty — because
 * a continue that reset progress would be a worse deal than restarting. Only
 * the threats on screen are cleared, so the player is not killed again by the
 * same shard before they can react.
 */
function continueRun(game) {
  game.screen = SCREEN.playing;
  game.projectiles.length = 0;
  game.pickups.length = 0;
  game.lives = 1;
  game.invulnerable = CONFIG.play.invulnerableTime * 2;
  game.combo = 0;
  game.multiplier = 1;
  game.coreFlash = 1;
  game.ads.gameplayStart();
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

  // The board records what the run was, not just what it scored, so the theme
  // and shape of every entry is preserved alongside the number.
  const placement = addRun(game.board, {
    score,
    seconds: game.elapsed,
    blocks: game.blocks,
    streak: game.bestCombo,
    themeId: game.theme.id,
    at: Date.now(),
  });
  game.board = placement.board;
  game.lastRank = placement.rank;
  saveBoard(game.board);

  game.ads.gameplayStop();
  game.adPolicy = recordDeath(game.adPolicy);

  if (score > game.highScore) {
    game.highScore = score;
    game.newRecord = true;
    playNewRecord();
    // Portals use this to decide when to surface an install or share prompt.
    game.ads.celebrate();
  } else {
    playGameOver();
  }

  maybeShowInterstitial(game);
}

/**
 * Runs an interstitial if the policy allows one.
 *
 * Fire-and-forget: the death screen is already up and stays interactive-looking
 * while the ad decides whether it exists. `adBusy` is set synchronously so a tap
 * arriving during that window cannot start a run underneath the ad.
 */
function maybeShowInterstitial(game) {
  if (!shouldShowInterstitial(game.adPolicy, Date.now())) return;

  game.adBusy = true;
  game.ads.showInterstitial().finally(() => {
    // Recorded whether or not an ad actually appeared. If a request failed, the
    // gap still applies — retrying on the very next death is how a broken SDK
    // turns into an ad attempt after every single run.
    game.adPolicy = recordInterstitial(game.adPolicy, Date.now());
    game.adBusy = false;
  });
}

/**
 * Offers "watch an ad, keep this run" — once per run, and only when the ad
 * layer can actually deliver one.
 */
export function canContinueWithAd(game) {
  return game.screen === SCREEN.gameover
    && game.ads.isEnabled
    && !game.adBusy
    && canOfferRewarded(game.adPolicy, { score: Math.floor(game.score) });
}

/** Plays a rewarded ad and resumes the run only if it was watched through. */
export function watchAdToContinue(game) {
  if (!canContinueWithAd(game)) return;

  game.adBusy = true;
  game.adPolicy = recordRewarded(game.adPolicy);

  game.ads.showRewarded().then((watched) => {
    game.adBusy = false;
    // A dismissed or failed ad pays nothing. The offer is spent either way,
    // which is what stops a player from farming retries on a broken SDK.
    if (watched) continueRun(game);
  });
}

/** Switches the active theme and remembers the choice. */
export function applyTheme(game, themeId) {
  game.theme = getTheme(themeId);
  game.profile = { ...game.profile, themeId: game.theme.id };
  saveProfile(game.profile);
}

/** Primary action: click / tap / Space. Meaning depends on the current screen. */
export function handleAction(game) {
  // While an ad is up, every tap belongs to the ad. Without this the tap that
  // dismisses an interstitial would fall through and start a run the player
  // never asked for.
  if (game.adBusy) return undefined;

  if (game.screen === SCREEN.menu) return activateMenu(game);
  if (game.screen === SCREEN.themes) return activateThemePicker(game);
  if (game.screen === SCREEN.scores || game.screen === SCREEN.stats
    || game.screen === SCREEN.help) {
    return activateSubScreen(game);
  }
  if (game.screen === SCREEN.paused) game.screen = SCREEN.playing;

  if (game.screen === SCREEN.gameover) {
    // The continue offer is a real button, so it has to be checked before the
    // "tap anywhere to retry" rule swallows the tap.
    if (canContinueWithAd(game) && pointerHit(game, [continueButton(game.viewport)])) {
      return watchAdToContinue(game);
    }
    // A run is only restartable after a short beat, so the death tap never
    // instantly burns the next run.
    if (game.elapsed > 0.6) return startRun(game);
  }
  return undefined;
}

/**
 * The main menu keeps its one-tap promise: anywhere that is not a tab starts a
 * run. The tabs are small and low precisely so they never get in the way of it.
 */
function activateMenu(game) {
  const tabs = tabButtons(game.viewport);
  const selected = selectedButton(game, tabs);

  if (selected) {
    game.screen = selected.id;
    game.menuSelection = -1;
    return undefined;
  }

  return startRun(game);
}

function activateThemePicker(game) {
  const buttons = themeButtons(game.viewport, game.profile);
  const back = backButton(game.viewport);

  if (pointerHit(game, [back])) return goToMenu(game);

  const selected = selectedButton(game, buttons);
  // A locked theme is not an error to report, it is simply not a choice yet.
  if (selected?.unlocked) applyTheme(game, selected.theme.id);
  return undefined;
}

function activateSubScreen(game) {
  // Only the back button leaves. A stray tap dropping the player out of a
  // screen they were reading would feel like the game rejecting them.
  if (pointerHit(game, [backButton(game.viewport)]) || game.menuSelection >= 0) {
    return goToMenu(game);
  }
  return undefined;
}

/**
 * Which button the action applies to.
 *
 * Keyboard selection wins when it is active, because a player steering with
 * arrow keys has no meaningful pointer position — the cursor is wherever they
 * last left it, possibly over an unrelated button.
 */
function selectedButton(game, buttons) {
  if (game.menuSelection >= 0) return buttons[game.menuSelection] ?? null;
  return pointerHit(game, buttons);
}

function pointerHit(game, buttons) {
  const { input } = game;
  if (input.mode !== 'pointer') return null;
  return hitTest(buttons, input.pointerX, input.pointerY);
}

function goToMenu(game) {
  game.screen = SCREEN.menu;
  game.menuSelection = -1;
  return undefined;
}

/**
 * Arrow keys / A-D move between menu entries.
 *
 * The same keys steer the shield during a run, which is why this only responds
 * on menu screens — and why the first press selects the first entry rather than
 * moving from an invisible default.
 */
export function navigateMenu(game, direction) {
  const buttons = menuButtonsFor(game);
  if (!buttons.length) return;

  if (game.menuSelection < 0) {
    game.menuSelection = direction > 0 ? 0 : buttons.length - 1;
    return;
  }

  game.menuSelection = (game.menuSelection + direction + buttons.length) % buttons.length;
}

/** The navigable buttons on the current screen, in order. */
export function menuButtonsFor(game) {
  if (game.screen === SCREEN.menu) return tabButtons(game.viewport);
  if (game.screen === SCREEN.themes) return themeButtons(game.viewport, game.profile);
  if (game.screen === SCREEN.scores || game.screen === SCREEN.stats
    || game.screen === SCREEN.help) {
    return [backButton(game.viewport)];
  }
  return [];
}

export function togglePause(game) {
  // On a sub-screen, Escape means "back" — the meaning the player expects from
  // every other piece of software they have ever used.
  if (isMenuScreen(game.screen) && game.screen !== SCREEN.menu) return goToMenu(game);

  if (game.screen === SCREEN.playing) game.screen = SCREEN.paused;
  else if (game.screen === SCREEN.paused) game.screen = SCREEN.playing;
  return undefined;
}

/**
 * Handles a "go up one level" request — the Android back button.
 *
 * Returns false only at the top of the tree, where the caller is expected to
 * close the app. Anywhere else the press is consumed: a back press should never
 * exit an app from the middle of a run.
 */
export function navigateBack(game) {
  if (game.adBusy) return true;

  if (isMenuScreen(game.screen) && game.screen !== SCREEN.menu) {
    goToMenu(game);
    return true;
  }

  if (game.screen === SCREEN.playing) {
    game.screen = SCREEN.paused;
    return true;
  }

  if (game.screen === SCREEN.paused || game.screen === SCREEN.gameover) {
    game.screen = SCREEN.menu;
    game.menuSelection = -1;
    return true;
  }

  return false;
}

/** Opens the theme picker directly — bound to [T]. */
export function openThemePicker(game) {
  if (!isMenuScreen(game.screen)) return;
  game.screen = game.screen === SCREEN.themes ? SCREEN.menu : SCREEN.themes;
  game.menuSelection = -1;
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

  // Touching the mouse hands control back to it, so a stale keyboard highlight
  // never sits on a button the player is no longer looking at.
  if (game.input.mode === 'pointer' && game.menuSelection >= 0) game.menuSelection = -1;

  // The shield keeps tracking on every screen so the game always feels alive.
  updateShield(game.shield, game.input, dt, isMenuScreen(game.screen) ? 0.5 : 0);
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
