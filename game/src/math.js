/**
 * Small math helpers shared across the game.
 * Kept dependency-free and allocation-free so it is safe to call per frame.
 */

export const TAU = Math.PI * 2;

export const clamp = (value, min, max) =>
  value < min ? min : value > max ? max : value;

export const lerp = (from, to, t) => from + (to - from) * t;

export const rand = (min, max) => min + Math.random() * (max - min);

export const randInt = (min, max) => Math.floor(rand(min, max + 1));

export const pick = (items) => items[Math.floor(Math.random() * items.length)];

export const chance = (probability) => Math.random() < probability;

/** Normalizes any angle into the -PI..PI range. */
export function normalizeAngle(angle) {
  let normalized = (angle + Math.PI) % TAU;
  if (normalized < 0) normalized += TAU;
  return normalized - Math.PI;
}

/** Shortest signed rotation needed to get from angle `from` to angle `to`. */
export const angleDelta = (from, to) => normalizeAngle(to - from);

/**
 * Frame-rate independent exponential smoothing.
 * `stiffness` is roughly "how many times per second the gap is closed".
 */
export const damp = (from, to, stiffness, dt) =>
  lerp(from, to, 1 - Math.exp(-stiffness * dt));

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export const easeOutQuint = (t) => 1 - (1 - t) ** 5;

// Written as (1 - cos) rather than -(cos - 1) so that t = 0 yields +0, not -0.
export const easeInOutSine = (t) => (1 - Math.cos(Math.PI * t)) / 2;
