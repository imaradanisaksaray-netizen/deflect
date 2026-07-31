/**
 * Shard spawning.
 *
 * The fairness check is the important part: a shard is never placed where the
 * player physically cannot reach it in time, because a run that ends on an
 * impossible pattern feels broken rather than hard.
 */

import { CONFIG, SHARD_TYPES } from '../config.js';
import { createProjectile, timeToRadius } from '../entities/projectiles.js';
import { angleDelta, chance, rand } from '../math.js';

/**
 * Fairness limits, exported so the tests assert against the real numbers
 * instead of a copy that can silently drift.
 */
export const FAIRNESS = {
  /** Two shards arriving within this window are treated as simultaneous. */
  simultaneousWindow: 0.32,
  /** Angular gap the player cannot cross inside that window. */
  unreachableGap: 2.1,
};

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
  // Each archetype flies at its own multiple of the base speed, so the arrival
  // time used for the fairness check must include that multiplier. Using the
  // base speed here made "do these arrive together?" answer for a shard that
  // does not exist, and let genuinely unreachable pairs through.
  const effectiveSpeed = difficulty.speed * SHARD_TYPES[type].speedScale;
  const angle = placeAngle(state, distance, effectiveSpeed, companionAngle);

  // No fair placement this tick. Dropping the shard is strictly better than
  // spawning one the player cannot reach; the next tick tries again.
  if (angle === null) return;

  state.projectiles.push(createProjectile({ type, angle, distance, speed: difficulty.speed }));
}

function rollType(difficulty) {
  if (chance(difficulty.voidChance)) return 'void';
  if (chance(CONFIG.difficulty.goldChance)) return 'gold';
  return 'shard';
}

/**
 * Picks a spawn angle that stays reachable, or returns null when every attempt
 * conflicts. Returning null is deliberate: an earlier version fell back to a
 * random angle, which quietly broke the fairness guarantee under heavy load.
 */
function placeAngle(state, distance, speed, companionAngle) {
  const shieldRadius = CONFIG.world.shieldRadius;
  const arrival = (distance - shieldRadius) / speed;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const angle = companionAngle === undefined
      ? rand(-Math.PI, Math.PI)
      : companionAngle + rand(
        CONFIG.difficulty.burstMinSeparation,
        CONFIG.difficulty.burstMaxSeparation,
      ) * (chance(0.5) ? 1 : -1);

    if (isReachable(state.projectiles, angle, arrival, shieldRadius)) return angle;
  }

  return null;
}

function isReachable(projectiles, angle, arrival, shieldRadius) {
  for (const projectile of projectiles) {
    const otherArrival = timeToRadius(projectile, shieldRadius);
    if (Math.abs(otherArrival - arrival) > FAIRNESS.simultaneousWindow) continue;
    // A void shard is dodged, not blocked, so it never creates an impossible pair.
    if (!projectile.archetype.blockable) continue;
    if (Math.abs(angleDelta(projectile.angle, angle)) > FAIRNESS.unreachableGap) return false;
  }
  return true;
}
