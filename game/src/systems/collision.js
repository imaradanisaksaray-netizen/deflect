/**
 * Collision resolution.
 *
 * Returns a list of events rather than mutating score/audio directly, so the
 * rules stay readable and the consequences live in one place (game.js).
 *
 * Event types:
 *   block      — a blockable shard was destroyed (good)
 *   shellCrack — an armoured shard lost its shell but survives (good, not done)
 *   voidBlock  — a spike (or revealed mimic) hit the shield (bad)
 *   coreHit    — a blockable shard reached the core (bad)
 *   voidPass   — a spike reached the core (harmless, by design)
 */

import { CONFIG } from '../config.js';
import { shieldCovers } from '../entities/shield.js';
import { isBlockable } from '../entities/projectiles.js';

export function resolveCollisions(state, events) {
  const { shieldRadius, shieldThickness, projectileRadius, coreRadius } = CONFIG.world;
  const shieldOuter = shieldRadius + shieldThickness / 2 + projectileRadius;
  const shieldInner = shieldRadius - shieldThickness / 2 - projectileRadius;
  const coreEdge = coreRadius + projectileRadius * 0.6;

  for (const projectile of state.projectiles) {
    if (!projectile.alive) continue;

    const inShieldBand = projectile.distance <= shieldOuter && projectile.distance > shieldInner;

    if (inShieldBand && shieldCovers(state.shield, projectile.angle)) {
      resolveShieldContact(projectile, shieldRadius, events);
      continue;
    }

    if (projectile.distance <= coreEdge) {
      projectile.alive = false;
      events.push({
        type: isBlockable(projectile) ? 'coreHit' : 'voidPass',
        projectile,
        distance: coreEdge,
      });
    }
  }
}

function resolveShieldContact(projectile, shieldRadius, events) {
  // A revealed mimic answers false here even though its archetype is blockable.
  if (!isBlockable(projectile)) {
    projectile.alive = false;
    events.push({ type: 'voidBlock', projectile, distance: shieldRadius });
    return;
  }

  projectile.hitPoints -= 1;

  if (projectile.hitPoints > 0) {
    // Armoured shard: the shell breaks and the shard is pushed back out, far
    // enough that it cannot re-collide on the same frame.
    projectile.distance += projectile.archetype.knockback;
    events.push({ type: 'shellCrack', projectile, distance: shieldRadius });
    return;
  }

  projectile.alive = false;
  events.push({ type: 'block', projectile, distance: shieldRadius });
}
