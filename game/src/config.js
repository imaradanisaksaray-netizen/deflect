/**
 * Every tunable number in one place.
 *
 * Distances are expressed as fractions of the reference unit, which is
 * `min(viewportWidth, viewportHeight)`. That keeps the playfield identical on
 * every aspect ratio — a hard requirement for YouTube Playables submission.
 */

export const CONFIG = {
  world: {
    coreRadius: 0.082,
    shieldRadius: 0.225,
    shieldThickness: 0.03,
    projectileRadius: 0.026,
    /** Extra margin past the screen corner so shards spawn fully off-screen. */
    spawnMargin: 0.08,
  },

  shield: {
    /** Angular width of the shield arc, in radians (~66 degrees). */
    arcSpan: 1.15,
    /** Pointer tracking stiffness — higher feels snappier. */
    followStiffness: 18,
    /** Rotation speed when steering with the keyboard, in radians/second. */
    keyboardSpeed: 5.4,
  },

  play: {
    startLives: 3,
    /** Grace period after taking damage, in seconds. */
    invulnerableTime: 1.1,
    /** Blocks required to advance one combo step. */
    comboStep: 4,
    maxMultiplier: 8,
    scorePerBlock: 10,
    scorePerGold: 50,
    /** Score awarded per second survived, scaled by the current multiplier. */
    scorePerSecond: 2,
  },

  difficulty: {
    /** Seconds until the difficulty curve reaches its maximum. */
    rampDuration: 165,
    spawnIntervalStart: 1.2,
    spawnIntervalEnd: 0.36,
    /** Travel speed in units/second. */
    speedStart: 0.3,
    speedEnd: 0.78,
    /** Void shards only start appearing after this many seconds. */
    voidGraceTime: 14,
    voidChanceEnd: 0.28,
    goldChance: 0.09,
    /** Share of spawns that use an unlocked advanced type, at full ramp. */
    advancedChanceEnd: 0.3,
    /** Late-game chance of spawning two shards at once. */
    burstChanceEnd: 0.34,
    /**
     * Angular gap between shards spawned in the same burst. The maximum must
     * stay below the reachability limit in spawner.js, otherwise a burst can
     * ask for a spread the shield physically cannot cover.
     */
    burstMinSeparation: 1.4,
    burstMaxSeparation: 2.0,
  },

  /**
   * Overtime: what happens after the main ramp finishes.
   *
   * Without this the curve would plateau and a strong player could survive
   * forever. Pressure keeps climbing — slowly, and without a ceiling — so every
   * run ends eventually. Speed is the lever; spawn interval shrinks in step with
   * it, which holds on-screen density constant and narrows only the reaction
   * window. That keeps the ending hard rather than cluttered.
   */
  endless: {
    /** Seconds of overtime that double shard speed. */
    speedDoubleTime: 200,
    /** Overtime seconds to reach the void/burst ceilings. */
    hazardRampTime: 280,
    /** Void shards stay a minority so there is always something to block. */
    voidChanceCap: 0.42,
    burstChanceCap: 0.6,
  },

  feel: {
    telegraphTime: 0.45,
    hitStopDuration: 0.09,
    /** The playfield shrinks on menu/game-over screens so text has room. */
    menuWorldScale: 0.75,
    shakeDecay: 6.5,
    maxShake: 0.035,
    /** Delta time is clamped so a stalled tab cannot teleport shards. */
    maxDeltaTime: 1 / 20,
  },

};

/**
 * Projectile archetypes.
 *
 * Shape differs per type so colour is never the only cue — that matters for
 * colour-blind players and it is what lets themes repaint the game freely.
 * `colorKey` is resolved against the active theme at draw time instead of
 * baking a hex value in here.
 */
export const SHARD_TYPES = {
  shard: {
    key: 'shard',
    colorKey: 'shard',
    shape: 'circle',
    speedScale: 1,
    score: CONFIG.play.scorePerBlock,
    blockable: true,
    unlockAtSeconds: 0,
  },
  gold: {
    key: 'gold',
    colorKey: 'gold',
    shape: 'diamond',
    speedScale: 1.35,
    score: CONFIG.play.scorePerGold,
    blockable: true,
    unlockAtSeconds: 0,
  },
  void: {
    key: 'void',
    colorKey: 'void',
    shape: 'spike',
    speedScale: 0.86,
    score: 0,
    blockable: false,
    unlockAtSeconds: 0,
  },

  /** Blocking it releases two smaller fragments that must also be caught. */
  splitter: {
    key: 'splitter',
    colorKey: 'shard',
    shape: 'ringed',
    speedScale: 0.82,
    score: 15,
    blockable: true,
    unlockAtSeconds: 600,
    label: 'SPLITTER',
    hint: 'IT BREAKS IN TWO',
    splitInto: 2,
    /** Fragment offset from the parent bearing, in radians. */
    splitSpread: 0.34,
  },

  /** Needs two hits: the first cracks the shell, the second destroys it. */
  shelled: {
    key: 'shelled',
    colorKey: 'shard',
    shape: 'shelled',
    speedScale: 0.72,
    score: 30,
    blockable: true,
    unlockAtSeconds: 1500,
    label: 'ARMOURED',
    hint: 'HIT IT TWICE',
    hitPoints: 2,
    /** How far the shard is pushed back when its shell breaks, in units. */
    knockback: 0.16,
  },

  /**
   * Looks like an ordinary shard until it nears the shield, then reveals itself
   * as a spike. Reveal timing is enforced in projectiles.js so the player always
   * gets a fair window to pull away.
   */
  mimic: {
    key: 'mimic',
    colorKey: 'shard',
    shape: 'circle',
    speedScale: 0.9,
    score: 0,
    blockable: true,
    unlockAtSeconds: 2700,
    label: 'MIMIC',
    hint: 'NOT EVERYTHING IS WHAT IT SEEMS',
    revealsAsVoid: true,
    /**
     * Fraction of the approach the player still has left when the disguise
     * drops. Expressed as a share of the flight rather than a fixed number of
     * seconds: at OVERDRIVE speeds the whole approach lasts well under a second,
     * so any constant lead time would either be impossible to honour or would
     * reveal the mimic the instant it spawns.
     */
    revealAtFraction: 0.45,
  },

  /** Arrives as a tight burst from one bearing; hold the shield still. */
  swarm: {
    key: 'swarm',
    colorKey: 'shard',
    shape: 'circle',
    speedScale: 1.1,
    score: 6,
    blockable: true,
    unlockAtSeconds: 4200,
    label: 'SWARM',
    hint: 'HOLD YOUR GROUND',
    sizeScale: 0.62,
    burstSize: 4,
    /** Gap between swarm members, in units of travel distance. */
    burstGap: 0.07,
  },
};

/** Types that exist from the very first run. */
export const BASE_TYPES = ['shard', 'gold', 'void'];

/** Types that unlock as total play time accumulates. */
export const ADVANCED_TYPES = ['splitter', 'shelled', 'mimic', 'swarm'];
