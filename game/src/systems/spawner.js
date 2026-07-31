/**
 * Shard spawning.
 *
 * Two rules govern everything here:
 *   1. Fairness — a shard is never placed where the player physically cannot
 *      reach it in time. A run that ends on an impossible pattern feels broken
 *      rather than hard.
 *   2. Familiarity — advanced threats stay rare early in a run even after they
 *      unlock, so the first minute always plays like the game already learned.
 */

import { ADVANCED_TYPES, CONFIG, SHARD_TYPES } from '../config.js';
import { createProjectile, isBlockable, timeToRadius } from '../entities/projectiles.js';
import { angleDelta, chance, pick, rand } from '../math.js';

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
  const type = rollType(difficulty, state.availableTypes);
  const archetype = SHARD_TYPES[type];
  const distance = state.viewport.cornerDistance + CONFIG.world.spawnMargin;
  const baseSpeed = difficulty.speed;
  // The fairness check needs the shard's real speed, which includes its
  // archetype multiplier — otherwise "do these arrive together?" is answered
  // for a shard that does not exist.
  const effectiveSpeed = baseSpeed * archetype.speedScale;
  const angle = placeAngle(state, distance, effectiveSpeed, companionAngle);

  // No fair placement this tick. Dropping the shard is strictly better than
  // spawning one the player cannot reach; the next tick tries again.
  if (angle === null) return;

  if (archetype.burstSize) {
    spawnSwarm(state, type, archetype, angle, distance, baseSpeed);
    return;
  }

  state.projectiles.push(createProjectile({ type, angle, distance, speed: baseSpeed }));
}

/**
 * A swarm arrives as a tight line from one bearing. Members are staggered by
 * distance rather than by time so they stay on the same line no matter what the
 * spawn interval is doing.
 */
function spawnSwarm(state, type, archetype, angle, distance, baseSpeed) {
  for (let i = 0; i < archetype.burstSize; i += 1) {
    state.projectiles.push(createProjectile({
      type,
      angle,
      distance: distance + i * archetype.burstGap,
      speed: baseSpeed,
    }));
  }
}

function rollType(difficulty, availableTypes) {
  const available = availableTypes ?? ['shard', 'gold', 'void'];

  if (available.includes('void') && chance(difficulty.voidChance)) return 'void';

  const advanced = ADVANCED_TYPES.filter((key) => available.includes(key));
  if (advanced.length && chance(difficulty.advancedChance)) return pick(advanced);

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
    // A spike is dodged, not blocked, so it never creates an impossible pair.
    // A disguised mimic still counts as blockable — the player will treat it as
    // one until it reveals, so it has to be reachable like any other shard.
    if (!isBlockable(projectile)) continue;
    if (Math.abs(angleDelta(projectile.angle, angle)) > FAIRNESS.unreachableGap) return false;
  }
  return true;
}
