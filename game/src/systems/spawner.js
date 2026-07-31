/**
 * Shard spawning.
 *
 * The fairness check is the important part: a shard is never placed where the
 * player physically cannot reach it in time, because a run that ends on an
 * impossible pattern feels broken rather than hard.
 */

import { CONFIG } from '../config.js';
import { createProjectile, timeToRadius } from '../entities/projectiles.js';
import { angleDelta, chance, rand } from '../math.js';

/** Two shards arriving within this window are treated as simultaneous. */
const SIMULTANEOUS_WINDOW = 0.32;
/** Angular gap the player cannot cross inside that window. */
const UNREACHABLE_GAP = 2.1;
const MAX_PLACEMENT_ATTEMPTS = 8;

export function createSpawner() {
  return { timer: 1.5 };
}

export function updateSpawner(spawner, state, difficulty, dt) {
  spawner.timer -= dt;
  if (spawner.timer > 0) return;

  spawner.timer = difficulty.spawnInterval * rand(0.85, 1.15);
  spawnShard(state, difficulty);

  if (chance(difficulty.burstChance)) {
    spawnShard(state, difficulty, state.projectiles[state.projectiles.length - 1]?.angle);
  }
}

function spawnShard(state, difficulty, companionAngle) {
  const type = rollType(difficulty);
  const distance = state.viewport.cornerDistance + CONFIG.world.spawnMargin;
  const speed = difficulty.speed;
  const angle = placeAngle(state, distance, speed, companionAngle);

  state.projectiles.push(createProjectile({ type, angle, distance, speed }));
}

function rollType(difficulty) {
  if (chance(difficulty.voidChance)) return 'void';
  if (chance(CONFIG.difficulty.goldChance)) return 'gold';
  return 'shard';
}

/**
 * Picks a spawn angle that stays reachable, retrying a bounded number of times
 * before falling back to a random angle (a slightly unfair shard beats a hang).
 */
function placeAngle(state, distance, speed, companionAngle) {
  const shieldRadius = CONFIG.world.shieldRadius;
  const arrival = (distance - shieldRadius) / speed;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const angle = companionAngle === undefined
      ? rand(-Math.PI, Math.PI)
      : companionAngle + rand(
        CONFIG.difficulty.burstMinSeparation,
        CONFIG.difficulty.burstMinSeparation + 1.2,
      ) * (chance(0.5) ? 1 : -1);

    if (isReachable(state.projectiles, angle, arrival, shieldRadius)) return angle;
  }

  return rand(-Math.PI, Math.PI);
}

function isReachable(projectiles, angle, arrival, shieldRadius) {
  for (const projectile of projectiles) {
    const otherArrival = timeToRadius(projectile, shieldRadius);
    if (Math.abs(otherArrival - arrival) > SIMULTANEOUS_WINDOW) continue;
    // A void shard is dodged, not blocked, so it never creates an impossible pair.
    if (!projectile.archetype.blockable) continue;
    if (Math.abs(angleDelta(projectile.angle, angle)) > UNREACHABLE_GAP) return false;
  }
  return true;
}
