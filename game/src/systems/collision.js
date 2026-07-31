/**
 * Collision resolution.
 *
 * Returns a list of events rather than mutating score/audio directly, so the
 * rules stay readable and the consequences live in one place (game.js).
 *
 * Event types:
 *   block     — a blockable shard hit the shield (good)
 *   voidBlock — a void shard hit the shield (bad: the shield shatters)
 *   coreHit   — a blockable shard reached the core (bad)
 *   voidPass  — a void shard reached the core (harmless, by design)
 */

import { CONFIG } from '../config.js';
import { shieldCovers } from '../entities/shield.js';

export function resolveCollisions(state, events) {
  const { shieldRadius, shieldThickness, projectileRadius, coreRadius } = CONFIG.world;
  const shieldOuter = shieldRadius + shieldThickness / 2 + projectileRadius;
  const shieldInner = shieldRadius - shieldThickness / 2 - projectileRadius;
  const coreEdge = coreRadius + projectileRadius * 0.6;

  for (const projectile of state.projectiles) {
    if (!projectile.alive) continue;

    const inShieldBand = projectile.distance <= shieldOuter && projectile.distance > shieldInner;

    if (inShieldBand && shieldCovers(state.shield, projectile.angle)) {
      projectile.alive = false;
      events.push({
        type: projectile.archetype.blockable ? 'block' : 'voidBlock',
        projectile,
        distance: CONFIG.world.shieldRadius,
      });
      continue;
    }

    if (projectile.distance <= coreEdge) {
      projectile.alive = false;
      events.push({
        type: projectile.archetype.blockable ? 'coreHit' : 'voidPass',
        projectile,
        distance: coreEdge,
      });
    }
  }
}
