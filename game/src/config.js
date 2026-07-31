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

  colors: {
    background: '#07031a',
    backgroundGlow: '#1b0a44',
    horizon: '#ff2d95',
    grid: '#6a2bd9',
    star: '#c9b8ff',
    core: '#00f0ff',
    coreShell: '#7df9ff',
    shield: '#00f0ff',
    shieldEdge: '#ffffff',
    shard: '#22e8ff',
    gold: '#ffd24a',
    void: '#ff1f4b',
    text: '#eae4ff',
    textDim: '#8f81c6',
    danger: '#ff1f4b',
  },
};

/** Projectile archetypes. Shape differs per type so colour is never the only cue. */
export const SHARD_TYPES = {
  shard: {
    key: 'shard',
    color: CONFIG.colors.shard,
    shape: 'circle',
    speedScale: 1,
    score: CONFIG.play.scorePerBlock,
    blockable: true,
  },
  gold: {
    key: 'gold',
    color: CONFIG.colors.gold,
    shape: 'diamond',
    speedScale: 1.35,
    score: CONFIG.play.scorePerGold,
    blockable: true,
  },
  void: {
    key: 'void',
    color: CONFIG.colors.void,
    shape: 'spike',
    speedScale: 0.86,
    score: 0,
    blockable: false,
  },
};
