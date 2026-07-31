/**
 * Projectiles ("shards") travel in polar space: a fixed angle and a distance
 * that shrinks toward the core. Polar storage makes shield collision a single
 * angle comparison instead of per-frame geometry.
 */

import { SHARD_TYPES } from '../config.js';

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
  };
}

export function updateProjectiles(projectiles, dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    projectile.age += dt;
    projectile.distance -= projectile.speed * dt;
    projectile.spin += dt * 2.4;

    if (!projectile.alive || projectile.distance < -0.1) {
      // Swap-remove keeps the array compact without reallocating.
      projectiles[i] = projectiles[projectiles.length - 1];
      projectiles.pop();
    }
  }
}

/** Seconds until this shard reaches `radius`. Used for fairness checks. */
export const timeToRadius = (projectile, radius) =>
  (projectile.distance - radius) / projectile.speed;
