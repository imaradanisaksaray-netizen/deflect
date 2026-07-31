/**
 * Projectiles ("shards") travel in polar space: a fixed angle and a distance
 * that shrinks toward the core. Polar storage makes shield collision a single
 * angle comparison instead of per-frame geometry.
 *
 * Beyond the three base types, some shards carry state:
 *   - shelled  keeps hit points and survives its first block
 *   - mimic    disguises itself and flips to a spike near the shield
 *   - splitter releases fragments when destroyed
 */

import { CONFIG, SHARD_TYPES } from '../config.js';

export function createProjectile({ type, angle, distance, speed }) {
  const archetype = SHARD_TYPES[type];
  return {
    type,
    archetype,
    angle,
    distance,
    speed: speed * archetype.speedScale,
    spawnDistance: distance,
    /** Counts up; used to fade in the shard and its telegraph beam. */
    age: 0,
    spin: Math.random() * Math.PI,
    alive: true,
    /** Blocks still needed to destroy it (armoured shards start above 1). */
    hitPoints: archetype.hitPoints ?? 1,
    /** True once a mimic has shown its real nature. */
    revealed: false,
    /** Decays after a reveal; drives the warning flash. */
    revealFlash: 0,
    /** Rendered radius multiplier — swarm members and fragments are smaller. */
    sizeScale: archetype.sizeScale ?? 1,
  };
}

/**
 * Fragments released when a splitter is destroyed.
 *
 * They inherit the parent's bearing and fan out by a fixed spread. The spread
 * stays inside the shield arc on purpose: a split must be catchable by a player
 * who reacts, not a coin flip.
 */
export function createFragments(parent, distance) {
  const { splitSpread, splitInto } = parent.archetype;
  const fragments = [];

  for (let i = 0; i < splitInto; i += 1) {
    // Two fragments become -spread and +spread; more would spread evenly.
    const offset = splitInto === 1 ? 0 : (i / (splitInto - 1) - 0.5) * 2 * splitSpread;
    const fragment = createProjectile({
      type: 'shard',
      angle: parent.angle + offset,
      distance,
      speed: parent.speed * 0.62,
    });
    fragment.sizeScale = 0.66;
    fragment.spawnDistance = distance;
    fragments.push(fragment);
  }

  return fragments;
}

export function updateProjectiles(projectiles, dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    projectile.age += dt;
    projectile.distance -= projectile.speed * dt;
    projectile.spin += dt * 2.4;
    projectile.revealFlash = Math.max(0, projectile.revealFlash - dt * 2.6);

    maybeReveal(projectile);

    if (!projectile.alive || projectile.distance < -0.1) {
      // Swap-remove keeps the array compact without reallocating.
      projectiles[i] = projectiles[projectiles.length - 1];
      projectiles.pop();
    }
  }
}

/**
 * Flips a mimic once it has covered enough of its approach.
 *
 * The trigger is a fraction of the shard's own flight, not a fixed distance or
 * a fixed number of seconds. A constant lead time breaks at speed: during
 * OVERDRIVE the entire approach lasts under a second, so a 0.75s promise would
 * force the reveal at spawn and the disguise would never exist.
 */
function maybeReveal(projectile) {
  const { archetype } = projectile;
  if (!archetype.revealsAsVoid || projectile.revealed) return;

  const shieldRadius = CONFIG.world.shieldRadius;
  const approach = projectile.spawnDistance - shieldRadius;
  const revealDistance = shieldRadius + approach * archetype.revealAtFraction;

  if (projectile.distance <= revealDistance) {
    projectile.revealed = true;
    projectile.revealFlash = 1;
  }
}

/**
 * Whether blocking this shard is currently the right move.
 * A revealed mimic answers false even though its archetype says otherwise.
 */
export const isBlockable = (projectile) =>
  projectile.archetype.revealsAsVoid ? !projectile.revealed : projectile.archetype.blockable;

/** Theme colour key to draw this shard with, accounting for a revealed mimic. */
export const colorKeyOf = (projectile) =>
  projectile.archetype.revealsAsVoid && projectile.revealed ? 'void' : projectile.archetype.colorKey;

/** Shape to draw, accounting for a revealed mimic. */
export const shapeOf = (projectile) =>
  projectile.archetype.revealsAsVoid && projectile.revealed ? 'spike' : projectile.archetype.shape;

/** Seconds until this shard reaches `radius`. Used for fairness checks. */
export const timeToRadius = (projectile, radius) =>
  (projectile.distance - radius) / projectile.speed;
