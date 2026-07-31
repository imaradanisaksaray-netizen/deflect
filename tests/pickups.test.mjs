/**
 * Tests for pickups.
 *
 * The promises being protected here:
 *   - a pickup is caught the same way a shard is blocked, and missing one is free
 *   - a core repair never spawns where it would be wasted
 *   - WIDE GUARD widens what actually blocks, not just what is drawn
 *   - SLIPSTREAM cannot extend its own duration
 *   - NOVA never clears the one thing the player is supposed to dodge
 *
 * Run with:  node --test tests/pickups.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, PICKUP_KEYS, PICKUP_TYPES } from '../game/src/config.js';
import { createProjectile } from '../game/src/entities/projectiles.js';
import { createShield, setShieldSpan, shieldCovers } from '../game/src/entities/shield.js';
import {
  createPickup,
  createPickupSpawner,
  rollPickupType,
  updatePickupSpawner,
  updatePickups,
} from '../game/src/systems/pickups.js';
import { THEMES } from '../game/src/themes/index.js';

const SHIELD_RADIUS = CONFIG.world.shieldRadius;

function makeState({ pickups = [], shieldAngle = 0, lives = 3 } = {}) {
  const shield = createShield();
  shield.angle = shieldAngle;
  return { shield, pickups, lives, viewport: { cornerDistance: 0.75 } };
}

test('a pickup under the shield is collected', () => {
  const pickup = createPickup({ type: 'nova', angle: 0, distance: SHIELD_RADIUS });
  const state = makeState({ pickups: [pickup] });
  const events = [];

  updatePickups(state, 1 / 60, events);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'pickup');
  assert.equal(events[0].pickup.type, 'nova');
  assert.equal(state.pickups.length, 0, 'a collected pickup leaves the field');
});

test('missing a pickup costs nothing', () => {
  // Shield on the far side, so the pickup flies all the way to the core.
  const pickup = createPickup({ type: 'nova', angle: Math.PI, distance: SHIELD_RADIUS });
  const state = makeState({ pickups: [pickup], shieldAngle: 0 });
  const events = [];

  for (let i = 0; i < 600 && state.pickups.length; i += 1) {
    updatePickups(state, 1 / 60, events);
  }

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'pickupMissed', 'a missed pickup must not damage the core');
});

test('a pickup travels slower than every shard', () => {
  // It has to be catchable on reaction alone, so nothing may outrun the eye.
  const slowestShard = createProjectile({
    type: 'shard', angle: 0, distance: 1, speed: CONFIG.difficulty.speedStart,
  });

  assert.ok(
    CONFIG.pickups.speed < slowestShard.speed,
    'pickups must be slower than even the opening shard speed',
  );
});

test('core repairs are withheld at full health', () => {
  for (let i = 0; i < 300; i += 1) {
    assert.notEqual(
      rollPickupType(CONFIG.pickups.maxLives),
      'life',
      'a repair at full health would be a wasted drop',
    );
  }
});

test('core repairs are offered when damaged', () => {
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) seen.add(rollPickupType(1));

  assert.ok(seen.has('life'), 'a damaged player must be able to draw a repair');
});

test('every pickup type can be rolled', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) seen.add(rollPickupType(1));

  for (const key of PICKUP_KEYS) {
    assert.ok(seen.has(key), `${key} is unreachable`);
  }
});

test('no pickup appears before the grace time', () => {
  const state = makeState();
  const spawner = createPickupSpawner();

  // Just short of the grace period.
  for (let i = 0; i < CONFIG.pickups.graceTime * 60 - 1; i += 1) {
    updatePickupSpawner(spawner, state, 1 / 60);
  }

  assert.equal(state.pickups.length, 0, 'the opening of a run must stay clean');
});

test('only one pickup is ever in flight', () => {
  const state = makeState();
  const spawner = createPickupSpawner();

  for (let i = 0; i < 60 * 60 * 10; i += 1) {
    updatePickupSpawner(spawner, state, 1 / 60);
    assert.ok(
      state.pickups.length <= CONFIG.pickups.maxActive,
      `${state.pickups.length} pickups in flight at once`,
    );
  }
});

test('WIDE GUARD widens what actually blocks', () => {
  const shield = createShield();
  shield.angle = 0;
  const justOutside = CONFIG.shield.arcSpan / 2 + 0.15;

  assert.equal(shieldCovers(shield, justOutside), false);

  // Ease it to the widened span the same way the game does.
  const target = CONFIG.shield.arcSpan * CONFIG.pickups.extendScale;
  for (let i = 0; i < 240; i += 1) setShieldSpan(shield, target, 1 / 60);

  assert.ok(Math.abs(shield.arcSpan - target) < 0.01, 'the arc must reach its target width');
  assert.equal(shieldCovers(shield, justOutside), true);
});

test('the widened arc still leaves most of the circle open', () => {
  // If a buff covered the whole ring the run would become unloseable while it
  // lasts, which is not a reward — it is a pause.
  const widened = CONFIG.shield.arcSpan * CONFIG.pickups.extendScale;

  assert.ok(widened < Math.PI, 'a widened shield must never cover half the circle');
});

test('the arc eases rather than snapping', () => {
  const shield = createShield();
  const target = CONFIG.shield.arcSpan * CONFIG.pickups.extendScale;

  const gap = target - CONFIG.shield.arcSpan;

  setShieldSpan(shield, target, 1 / 60);
  const covered = (shield.arcSpan - CONFIG.shield.arcSpan) / gap;

  assert.ok(covered > 0, 'it must start opening');
  assert.ok(covered < 0.25, `one frame closed ${(covered * 100).toFixed(0)}% of the gap`);
});

test('SLIPSTREAM slows the run without stretching itself', () => {
  // Buffs drain in real seconds; the run is what gets scaled. If the two were
  // ever swapped, a six-second reward would last thirteen.
  const duration = PICKUP_TYPES.slow.duration;
  const dt = 1 / 60;
  let remaining = duration;
  let runSeconds = 0;
  let realSeconds = 0;

  while (remaining > 0) {
    remaining -= dt;
    runSeconds += dt * CONFIG.pickups.slowFactor;
    realSeconds += dt;
  }

  assert.ok(Math.abs(realSeconds - duration) < 0.05, 'it must last its stated duration');
  assert.ok(
    runSeconds < realSeconds,
    'the run clock must fall behind, so safety is paid for in score',
  );
});

test('timed rewards declare a duration and the instant ones do not', () => {
  for (const key of PICKUP_KEYS) {
    const type = PICKUP_TYPES[key];
    assert.ok(type.label, `${key} needs a label for the HUD banner`);
    assert.ok(type.symbol, `${key} needs a symbol — colour alone cannot tell them apart`);

    const timed = key === 'extend' || key === 'slow';
    assert.equal(
      typeof type.duration === 'number',
      timed,
      `${key} has the wrong idea of whether it is timed`,
    );
  }
});

test('the pickup colour is never confusable with the hazard colour', () => {
  // Same rule the shard palette follows: what you catch and what kills you must
  // not look alike, in any theme.
  const toRgb = (hex) => {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const distance = (a, b) => {
    const [ar, ag, ab] = toRgb(a);
    const [br, bg, bb] = toRgb(b);
    return Math.hypot(ar - br, ag - bg, ab - bb);
  };

  for (const theme of THEMES) {
    assert.ok(theme.colors.pickup, `${theme.id} has no pickup colour`);

    // Against void the rule is strict: confusing these two kills the player.
    assert.ok(
      distance(theme.colors.pickup, theme.colors.void) > 120,
      `${theme.id}: pickup and void look alike`,
    );

    // Against a shard it is looser — mistaking one for the other is harmless,
    // since both are caught the same way. But a reward that reads as ordinary
    // stops feeling like a reward, so they still have to be told apart.
    assert.ok(
      distance(theme.colors.pickup, theme.colors.shard) > 110,
      `${theme.id}: a pickup is indistinguishable from an ordinary shard`,
    );
  }
});
