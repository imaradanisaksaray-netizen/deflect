/**
 * Pickups: rare rewards that drift in like shards but are caught rather than
 * blocked.
 *
 * They reuse the shard's polar layout on purpose — same approach, same catching
 * motion, no new control to learn. What differs is the payoff and the fact that
 * missing one costs nothing: an uncaught pickup dissolves at the core.
 *
 * Spawning is deliberately restrained. One in flight at a time, nothing before
 * the run has found its rhythm, and a core repair is withheld at full health so
 * the rarest reward is never wasted.
 */

import { CONFIG, PICKUP_KEYS, PICKUP_TYPES } from '../config.js';
import { rand } from '../math.js';
import { shieldCovers } from '../entities/shield.js';

export function createPickupSpawner() {
  return {
    /** Seconds until the next attempt. The first one waits out the grace time. */
    timer: CONFIG.pickups.graceTime,
  };
}

export function createPickup({ type, angle, distance }) {
  return {
    type,
    archetype: PICKUP_TYPES[type],
    angle,
    distance,
    speed: CONFIG.pickups.speed,
    age: 0,
    spin: rand(0, Math.PI),
    alive: true,
  };
}

/**
 * Picks what to drop next.
 *
 * A core repair is only offered when it would actually do something; otherwise
 * the rarest reward would regularly land on a full-health player and vanish.
 */
export function rollPickupType(lives) {
  const candidates = PICKUP_KEYS.filter(
    (key) => key !== 'life' || lives < CONFIG.pickups.maxLives,
  );

  const total = candidates.reduce((sum, key) => sum + PICKUP_TYPES[key].weight, 0);
  let roll = Math.random() * total;

  for (const key of candidates) {
    roll -= PICKUP_TYPES[key].weight;
    if (roll <= 0) return key;
  }

  return candidates[candidates.length - 1];
}

/** Advances the drop timer and releases at most one pickup. */
export function updatePickupSpawner(spawner, state, dt) {
  spawner.timer -= dt;
  if (spawner.timer > 0) return;

  const { interval, intervalJitter, maxActive } = CONFIG.pickups;
  spawner.timer = interval + rand(-intervalJitter, intervalJitter);

  const active = state.pickups.filter((p) => p.alive).length;
  if (active >= maxActive) return;

  state.pickups.push(createPickup({
    type: rollPickupType(state.lives),
    angle: rand(-Math.PI, Math.PI),
    distance: state.viewport.cornerDistance + CONFIG.world.spawnMargin,
  }));
}

/**
 * Moves pickups inward and reports what happened to each one.
 *
 * Returns events rather than mutating game state so the rules stay in game.js,
 * matching how collisions already work.
 */
export function updatePickups(state, dt, events) {
  const { shieldRadius, shieldThickness } = CONFIG.world;
  const bandInner = shieldRadius - shieldThickness / 2 - CONFIG.pickups.radius;
  const bandOuter = shieldRadius + shieldThickness / 2 + CONFIG.pickups.radius;

  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.pickups[i];
    pickup.age += dt;
    pickup.distance -= pickup.speed * dt;
    pickup.spin += dt * 1.6;

    const inBand = pickup.distance <= bandOuter && pickup.distance >= bandInner;
    if (pickup.alive && inBand && shieldCovers(state.shield, pickup.angle)) {
      pickup.alive = false;
      events.push({ type: 'pickup', pickup, distance: pickup.distance });
    } else if (pickup.alive && pickup.distance <= CONFIG.world.coreRadius) {
      // Missing one is free — it simply dissolves into the core.
      pickup.alive = false;
      events.push({ type: 'pickupMissed', pickup, distance: pickup.distance });
    }

    if (!pickup.alive) {
      state.pickups[i] = state.pickups[state.pickups.length - 1];
      state.pickups.pop();
    }
  }
}
