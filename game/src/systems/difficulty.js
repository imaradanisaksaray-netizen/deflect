/**
 * Difficulty curve.
 *
 * Two phases:
 *   1. Ramp     — one eased curve drives every pressure knob for `rampDuration`
 *                 seconds, so tuning the opening is a single number.
 *   2. Overtime — past the ramp, pressure keeps climbing without a ceiling.
 *                 A plateau would let a strong player survive indefinitely;
 *                 this makes every run finite while staying fair.
 */

import { CONFIG } from '../config.js';
import { clamp, easeInOutSine, lerp } from '../math.js';

export function difficultyAt(elapsed) {
  const { difficulty, endless } = CONFIG;
  const progress = clamp(elapsed / difficulty.rampDuration, 0, 1);
  const curve = easeInOutSine(progress);
  const overtime = Math.max(0, elapsed - difficulty.rampDuration);
  // Unbounded and linear: doubles every `speedDoubleTime` seconds of overtime.
  const overdrive = 1 + overtime / endless.speedDoubleTime;

  const baseSpeed = lerp(difficulty.speedStart, difficulty.speedEnd, curve);
  const baseInterval = lerp(
    difficulty.spawnIntervalStart,
    difficulty.spawnIntervalEnd,
    curve,
  );

  return {
    progress,
    curve,
    overtime,
    overdrive,
    speed: baseSpeed * overdrive,
    // Dividing by the same factor keeps shards-on-screen constant, so overtime
    // shortens the reaction window instead of burying the player in clutter.
    spawnInterval: baseInterval / overdrive,
    voidChance: voidChanceAt(elapsed, overtime),
    burstChance: burstChanceAt(curve, overtime),
    // Advanced threats stay rare early in a run even once unlocked, so the
    // opening minute always plays like the game the player already knows.
    advancedChance: lerp(0, difficulty.advancedChanceEnd, curve),
  };
}

/** Void shards stay out of the first few seconds so the rules land one at a time. */
function voidChanceAt(elapsed, overtime) {
  const { difficulty, endless } = CONFIG;
  const remaining = difficulty.rampDuration - difficulty.voidGraceTime;
  const progress = clamp((elapsed - difficulty.voidGraceTime) / remaining, 0, 1);
  const base = easeInOutSine(progress) * difficulty.voidChanceEnd;

  if (overtime <= 0) return base;
  return lerp(difficulty.voidChanceEnd, endless.voidChanceCap, hazardRamp(overtime));
}

function burstChanceAt(curve, overtime) {
  const { difficulty, endless } = CONFIG;
  const base = lerp(0, difficulty.burstChanceEnd, curve);

  if (overtime <= 0) return base;
  return lerp(difficulty.burstChanceEnd, endless.burstChanceCap, hazardRamp(overtime));
}

/** Hazard mix eases to its ceiling; only speed keeps rising forever. */
const hazardRamp = (overtime) =>
  easeInOutSine(clamp(overtime / CONFIG.endless.hazardRampTime, 0, 1));
