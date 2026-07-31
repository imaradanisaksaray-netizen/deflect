/**
 * Tests for the v2 threat types.
 *
 * Each of these encodes a fairness promise, not just a behaviour:
 *   - a splitter's fragments must be catchable by a player who reacts
 *   - an armoured shard must not re-collide on the frame its shell breaks
 *   - a mimic must reveal itself with enough time left to pull away
 *   - locked threats must never reach the spawner
 *
 * Run with:  node --test tests/threats.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADVANCED_TYPES, CONFIG, SHARD_TYPES } from '../game/src/config.js';
import {
  colorKeyOf,
  createFragments,
  createProjectile,
  isBlockable,
  shapeOf,
  updateProjectiles,
} from '../game/src/entities/projectiles.js';
import { createShield, shieldCovers } from '../game/src/entities/shield.js';
import { resolveCollisions } from '../game/src/systems/collision.js';
import { createSpawner, updateSpawner } from '../game/src/systems/spawner.js';
import { difficultyAt } from '../game/src/systems/difficulty.js';
import { unlockedTypeKeys, nextThreatGoal } from '../game/src/progress/unlocks.js';

const SHIELD_RADIUS = CONFIG.world.shieldRadius;

function makeState({ projectiles = [], shieldAngle = 0, availableTypes } = {}) {
  const shield = createShield();
  shield.angle = shieldAngle;
  return { shield, projectiles, availableTypes, viewport: { cornerDistance: 0.75 } };
}

const spawn = (type, angle = 0, distance = SHIELD_RADIUS, speed = 0.4) =>
  createProjectile({ type, angle, distance, speed });

test('a splitter is destroyed in one block and releases fragments', () => {
  const splitter = spawn('splitter');
  const state = makeState({ projectiles: [splitter] });
  const events = [];

  resolveCollisions(state, events);

  assert.equal(events[0].type, 'block');
  assert.equal(splitter.alive, false);

  const fragments = createFragments(splitter, SHIELD_RADIUS + 0.07);
  assert.equal(fragments.length, SHARD_TYPES.splitter.splitInto);
});

test('splitter fragments stay inside the shield arc', () => {
  // Both fragments must be coverable without moving, otherwise a split is a
  // coin flip rather than a reaction test.
  const splitter = spawn('splitter', 0.4);
  const fragments = createFragments(splitter, SHIELD_RADIUS + 0.07);
  const shield = createShield();
  shield.angle = splitter.angle;

  for (const fragment of fragments) {
    assert.ok(
      shieldCovers(shield, fragment.angle),
      `fragment at ${fragment.angle.toFixed(2)} falls outside the arc centred on the parent`,
    );
  }
});

test('splitter fragments are released outside the shield band', () => {
  const splitter = spawn('splitter');
  const releaseDistance = SHIELD_RADIUS + 0.07;
  const fragments = createFragments(splitter, releaseDistance);

  const bandOuter = SHIELD_RADIUS + CONFIG.world.shieldThickness / 2 + CONFIG.world.projectileRadius;
  for (const fragment of fragments) {
    assert.ok(
      fragment.distance > bandOuter,
      'a fragment born inside the band would be blocked on the same frame it appears',
    );
  }
});

test('an armoured shard survives its first block and is pushed back out', () => {
  const shelled = spawn('shelled');
  const state = makeState({ projectiles: [shelled] });
  const events = [];

  resolveCollisions(state, events);

  assert.equal(events[0].type, 'shellCrack');
  assert.equal(shelled.alive, true, 'the shard survives');
  assert.equal(shelled.hitPoints, 1);

  const bandOuter = SHIELD_RADIUS + CONFIG.world.shieldThickness / 2 + CONFIG.world.projectileRadius;
  assert.ok(
    shelled.distance > bandOuter,
    'knockback must clear the band or the shard re-collides instantly',
  );
});

test('an armoured shard dies on the second block', () => {
  const shelled = spawn('shelled');
  const state = makeState({ projectiles: [shelled] });

  resolveCollisions(state, []);
  shelled.distance = SHIELD_RADIUS; // it flies back in

  const events = [];
  resolveCollisions(state, events);

  assert.equal(events[0].type, 'block');
  assert.equal(shelled.alive, false);
});

test('a mimic looks like an ordinary shard until it reveals', () => {
  const mimic = spawn('mimic', 0, 0.9);

  assert.equal(isBlockable(mimic), true, 'before the reveal it must be treated as blockable');
  assert.equal(colorKeyOf(mimic), 'shard');
  assert.equal(shapeOf(mimic), 'circle');
});

test('a revealed mimic becomes something you must not block', () => {
  const mimic = spawn('mimic', 0, 0.9);
  // Fly it in until the reveal triggers.
  for (let i = 0; i < 400 && !mimic.revealed; i += 1) updateProjectiles([mimic], 1 / 60);

  assert.equal(mimic.revealed, true, 'it must reveal before reaching the shield');
  assert.equal(isBlockable(mimic), false);
  assert.equal(colorKeyOf(mimic), 'void');
  assert.equal(shapeOf(mimic), 'spike');
});

test('blocking a revealed mimic damages the player', () => {
  const mimic = spawn('mimic', 0, 0.9);
  for (let i = 0; i < 400 && !mimic.revealed; i += 1) updateProjectiles([mimic], 1 / 60);

  mimic.distance = SHIELD_RADIUS;
  const state = makeState({ projectiles: [mimic] });
  const events = [];
  resolveCollisions(state, events);

  assert.equal(events[0].type, 'voidBlock');
});

test('letting a revealed mimic through is harmless', () => {
  const mimic = spawn('mimic', Math.PI, 0.9);
  for (let i = 0; i < 400 && !mimic.revealed; i += 1) updateProjectiles([mimic], 1 / 60);

  mimic.distance = CONFIG.world.coreRadius;
  const state = makeState({ projectiles: [mimic], shieldAngle: 0 });
  const events = [];
  resolveCollisions(state, events);

  assert.equal(events[0].type, 'voidPass', 'dodging a mimic must be the safe outcome');
});

test('a mimic reveal leaves a consistent share of the approach at every speed', () => {
  // The promise is proportional, not absolute: whatever the speed, the player
  // gets roughly the same fraction of the flight to react. A fixed lead time
  // cannot hold during OVERDRIVE, where the whole approach is under a second.
  const fraction = SHARD_TYPES.mimic.revealAtFraction;
  const spawnDistance = 1.1;

  for (const baseSpeed of [0.3, 0.78, 1.6, 2.5]) {
    const mimic = createProjectile({
      type: 'mimic', angle: 0, distance: spawnDistance, speed: baseSpeed,
    });
    const totalFlight = (spawnDistance - SHIELD_RADIUS) / mimic.speed;
    let revealDistance = null;

    for (let i = 0; i < 5000 && revealDistance === null; i += 1) {
      updateProjectiles([mimic], 1 / 240);
      if (mimic.revealed) revealDistance = mimic.distance;
    }

    assert.ok(revealDistance !== null, `no reveal at speed ${baseSpeed}`);

    const secondsLeft = (revealDistance - SHIELD_RADIUS) / mimic.speed;
    const share = secondsLeft / totalFlight;

    assert.ok(
      share >= fraction - 0.05,
      `speed ${baseSpeed}: only ${(share * 100).toFixed(0)}% of the flight left, expected ~${fraction * 100}%`,
    );
    assert.ok(
      share <= fraction + 0.05,
      `speed ${baseSpeed}: revealed too early (${(share * 100).toFixed(0)}% left), the disguise barely existed`,
    );
  }
});

test('a mimic stays disguised for the first half of its approach', () => {
  const mimic = createProjectile({ type: 'mimic', angle: 0, distance: 1.1, speed: 0.78 });

  updateProjectiles([mimic], 1 / 60);
  assert.equal(mimic.revealed, false, 'it must not give itself away at spawn');
});

test('a swarm spawns as a group on one bearing', () => {
  // Only a share of spawns picks an advanced type, so keep spawning until a
  // swarm actually appears rather than asserting on a single roll.
  const state = makeState({ availableTypes: ['swarm'] });
  const spawner = createSpawner();
  // Bursts off: a second shard arriving alongside the swarm would make the
  // member count depend on an unrelated dice roll.
  const difficulty = { ...difficultyAt(CONFIG.difficulty.rampDuration), burstChance: 0 };
  let swarm = null;

  for (let attempt = 0; attempt < 500 && !swarm; attempt += 1) {
    state.projectiles.length = 0;
    updateSpawner(spawner, state, difficulty, 5);
    if (state.projectiles.some((p) => p.type === 'swarm')) swarm = [...state.projectiles];
  }

  assert.ok(swarm, 'no swarm spawned in 500 attempts');
  assert.equal(swarm.length, SHARD_TYPES.swarm.burstSize);

  const angles = new Set(swarm.map((p) => p.angle.toFixed(6)));
  assert.equal(angles.size, 1, 'every swarm member shares the parent bearing');

  const distances = swarm.map((p) => p.distance).sort((a, b) => a - b);
  assert.ok(distances[1] - distances[0] > 0, 'members are staggered, not stacked');
});

test('locked threats never reach the spawner', () => {
  const state = makeState({ availableTypes: ['shard', 'gold', 'void'] });
  const spawner = createSpawner();
  const difficulty = difficultyAt(CONFIG.difficulty.rampDuration);

  for (let step = 0; step < 4000; step += 1) {
    updateSpawner(spawner, state, difficulty, 1 / 60);
    updateProjectiles(state.projectiles, 1 / 60);
  }

  const seen = new Set(state.projectiles.map((p) => p.type));
  for (const advanced of ADVANCED_TYPES) {
    assert.ok(!seen.has(advanced), `${advanced} spawned while still locked`);
  }
});

test('threat unlocks follow total survival time', () => {
  const at = (seconds) => unlockedTypeKeys({ totalSeconds: seconds, totalBlocks: 0 });

  assert.deepEqual(at(0).sort(), ['gold', 'shard', 'void']);
  assert.ok(at(600).includes('splitter'));
  assert.ok(!at(600).includes('shelled'));
  assert.ok(at(5000).length === Object.keys(SHARD_TYPES).length, 'everything opens eventually');
});

test('threat thresholds increase and each declares its briefing text', () => {
  let previous = 0;
  for (const key of ADVANCED_TYPES) {
    const type = SHARD_TYPES[key];
    assert.ok(type.unlockAtSeconds > previous, `${key} must unlock after the previous threat`);
    assert.ok(type.label && type.hint, `${key} needs a label and hint for the unlock card`);
    previous = type.unlockAtSeconds;
  }
});

test('nextThreatGoal reports the nearest locked threat', () => {
  const goal = nextThreatGoal({ totalSeconds: 700, totalBlocks: 0 });
  assert.equal(goal.type.key, 'shelled');
  assert.equal(goal.remaining, SHARD_TYPES.shelled.unlockAtSeconds - 700);

  assert.equal(nextThreatGoal({ totalSeconds: 99999, totalBlocks: 0 }), null);
});
