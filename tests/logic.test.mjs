/**
 * Logic tests for the DOM-free half of the game.
 *
 * Run with:  node --test tests/
 *
 * Rendering needs a browser, but the rules that decide whether a run is fair
 * or a hit counts are pure functions — and those are the ones worth pinning.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../game/src/config.js';
import { angleDelta, clamp, normalizeAngle } from '../game/src/math.js';
import { createShield, registerImpact, shieldCovers, updateShield } from '../game/src/entities/shield.js';
import { createProjectile, timeToRadius, updateProjectiles } from '../game/src/entities/projectiles.js';
import { resolveCollisions } from '../game/src/systems/collision.js';
import { createSpawner, updateSpawner } from '../game/src/systems/spawner.js';
import { difficultyAt } from '../game/src/systems/difficulty.js';

const SHIELD_RADIUS = CONFIG.world.shieldRadius;

function makeState({ projectiles = [], shieldAngle = 0 } = {}) {
  const shield = createShield();
  shield.angle = shieldAngle;
  return { shield, projectiles, viewport: { cornerDistance: 0.75 } };
}

function makeProjectile(type, angle, distance) {
  return createProjectile({ type, angle, distance, speed: 0.4 });
}

test('normalizeAngle wraps into -PI..PI', () => {
  assert.ok(Math.abs(normalizeAngle(Math.PI * 3)) - Math.PI < 1e-9);
  assert.ok(normalizeAngle(-Math.PI * 2.5) <= Math.PI);
  assert.ok(normalizeAngle(-Math.PI * 2.5) >= -Math.PI);
});

test('angleDelta takes the short way around the circle', () => {
  // From just below +PI to just above -PI is a small step, not a near-full turn.
  const delta = angleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(delta) < 0.3, `expected a short hop, got ${delta}`);
});

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test('shieldCovers works across the -PI/+PI seam', () => {
  const shield = createShield();
  shield.angle = Math.PI - 0.05;

  assert.equal(shieldCovers(shield, -Math.PI + 0.05), true);
  assert.equal(shieldCovers(shield, 0), false);
});

test('keyboard input rotates the shield, pointer input tracks it', () => {
  const shield = createShield();
  const startAngle = shield.angle;

  updateShield(shield, { mode: 'keyboard', turn: 1, hasPointer: false }, 0.1);
  assert.ok(shield.angle > startAngle, 'right turn should increase the angle');

  const tracking = createShield();
  tracking.angle = 0;
  updateShield(tracking, { mode: 'pointer', turn: 0, hasPointer: true, pointerAngle: 1 }, 0.1);
  assert.ok(tracking.angle > 0 && tracking.angle < 1, 'pointer tracking should ease toward the target');
});

test('registerImpact stays inside its clamps under repeated hits', () => {
  const shield = createShield();
  for (let i = 0; i < 20; i += 1) registerImpact(shield, 1.5);

  assert.ok(shield.flash <= 1.6);
  assert.ok(shield.recoil <= 0.02);
});

test('a shard in front of the shield is blocked', () => {
  const projectile = makeProjectile('shard', 0, SHIELD_RADIUS);
  const state = makeState({ projectiles: [projectile], shieldAngle: 0 });
  const events = [];

  resolveCollisions(state, events);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'block');
  assert.equal(projectile.alive, false);
});

test('a shard behind the shield passes the band and later hits the core', () => {
  const projectile = makeProjectile('shard', Math.PI, SHIELD_RADIUS);
  const state = makeState({ projectiles: [projectile], shieldAngle: 0 });
  const passing = [];

  resolveCollisions(state, passing);
  assert.equal(passing.length, 0, 'the shield must not block its own back side');

  projectile.distance = CONFIG.world.coreRadius;
  const landing = [];
  resolveCollisions(state, landing);

  assert.equal(landing.length, 1);
  assert.equal(landing[0].type, 'coreHit');
});

test('touching a void spike with the shield is a voidBlock', () => {
  const projectile = makeProjectile('void', 0, SHIELD_RADIUS);
  const state = makeState({ projectiles: [projectile], shieldAngle: 0 });
  const events = [];

  resolveCollisions(state, events);

  assert.equal(events[0].type, 'voidBlock');
});

test('a void spike reaching the core is absorbed, not damaging', () => {
  const projectile = makeProjectile('void', Math.PI, CONFIG.world.coreRadius);
  const state = makeState({ projectiles: [projectile], shieldAngle: 0 });
  const events = [];

  resolveCollisions(state, events);

  assert.equal(events[0].type, 'voidPass');
});

test('projectiles move inward and dead ones are removed', () => {
  const projectiles = [makeProjectile('shard', 0, 0.5), makeProjectile('shard', 1, 0.5)];
  projectiles[0].alive = false;

  updateProjectiles(projectiles, 0.1);

  assert.equal(projectiles.length, 1);
  assert.ok(projectiles[0].distance < 0.5, 'surviving shard should have travelled inward');
});

test('difficulty ramps monotonically up to the plateau', () => {
  const { rampDuration, speedEnd, spawnIntervalEnd, voidChanceEnd } = CONFIG.difficulty;
  const start = difficultyAt(0);
  const mid = difficultyAt(rampDuration / 2);
  const plateau = difficultyAt(rampDuration);

  assert.equal(start.voidChance, 0, 'no void spikes in the opening seconds');
  assert.ok(mid.speed > start.speed && plateau.speed > mid.speed);
  assert.ok(mid.spawnInterval < start.spawnInterval);

  // At the plateau exactly, overtime is zero and the ramp bounds still hold.
  assert.equal(plateau.overtime, 0);
  assert.ok(Math.abs(plateau.speed - speedEnd) < 1e-9);
  assert.ok(Math.abs(plateau.spawnInterval - spawnIntervalEnd) < 1e-9);
  assert.ok(plateau.voidChance <= voidChanceEnd + 1e-9);
});

test('overtime keeps raising speed so no run can last forever', () => {
  const { rampDuration } = CONFIG.difficulty;
  const { speedDoubleTime } = CONFIG.endless;

  const plateau = difficultyAt(rampDuration);
  const doubled = difficultyAt(rampDuration + speedDoubleTime);
  const muchLater = difficultyAt(rampDuration + speedDoubleTime * 6);

  assert.ok(
    Math.abs(doubled.speed - plateau.speed * 2) < 1e-9,
    'speed should double after one speedDoubleTime of overtime',
  );
  assert.ok(muchLater.speed > doubled.speed, 'speed must have no ceiling');
  assert.ok(doubled.spawnInterval < plateau.spawnInterval);
});

test('overtime holds shard density constant while narrowing the reaction window', () => {
  const { rampDuration } = CONFIG.difficulty;
  const plateau = difficultyAt(rampDuration);
  const later = difficultyAt(rampDuration + 500);

  // Shards on screen scale with travelTime / spawnInterval, and travelTime
  // scales with 1 / speed. Holding that product fixed is the design goal.
  const density = (d) => 1 / d.speed / d.spawnInterval;
  assert.ok(
    Math.abs(density(plateau) - density(later)) < 1e-9,
    'overtime must not bury the player in extra shards',
  );
});

test('overtime hazard mix rises but stays under its ceilings', () => {
  const { rampDuration } = CONFIG.difficulty;
  const plateau = difficultyAt(rampDuration);
  const later = difficultyAt(rampDuration + 500);

  assert.ok(later.voidChance > plateau.voidChance);
  assert.ok(later.burstChance > plateau.burstChance);
  assert.ok(later.voidChance <= CONFIG.endless.voidChanceCap + 1e-9);
  assert.ok(later.burstChance <= CONFIG.endless.burstChanceCap + 1e-9);
  assert.ok(
    later.voidChance < 0.5,
    'blockable shards must stay the majority or scoring stalls',
  );
});

/** Runs ~100 seconds of spawning at a fixed point on the difficulty curve. */
function simulateSpawns(elapsed) {
  const state = makeState();
  const spawner = createSpawner();
  const difficulty = difficultyAt(elapsed);

  for (let step = 0; step < 6000; step += 1) {
    updateSpawner(spawner, state, difficulty, 1 / 60);
    updateProjectiles(state.projectiles, 1 / 60);
  }
  return state.projectiles;
}

function assertNoUnreachablePairs(projectiles, label) {
  const blockable = projectiles.filter((p) => p.archetype.blockable);

  for (let i = 0; i < blockable.length; i += 1) {
    for (let j = i + 1; j < blockable.length; j += 1) {
      const gap = Math.abs(angleDelta(blockable[i].angle, blockable[j].angle));
      const timeGap = Math.abs(
        timeToRadius(blockable[i], SHIELD_RADIUS) - timeToRadius(blockable[j], SHIELD_RADIUS),
      );
      assert.ok(
        !(timeGap <= 0.32 && gap > 2.1),
        `${label}: unreachable pair, gap ${gap.toFixed(2)} rad within ${timeGap.toFixed(3)}s`,
      );
    }
  }
}

test('the spawner never creates an unreachable pair of blockable shards', () => {
  const { rampDuration } = CONFIG.difficulty;

  // Both phases matter: the plateau is where bursts peak, and deep overtime is
  // where speed is highest — fairness has to survive both.
  assertNoUnreachablePairs(simulateSpawns(rampDuration), 'plateau');
  assertNoUnreachablePairs(simulateSpawns(rampDuration + 400), 'deep overtime');
});

test('spawned shards always start outside the visible corner', () => {
  const state = makeState();
  const spawner = createSpawner();
  updateSpawner(spawner, state, difficultyAt(0), 5);

  assert.ok(state.projectiles.length > 0);
  for (const projectile of state.projectiles) {
    assert.ok(projectile.distance > state.viewport.cornerDistance);
  }
});
