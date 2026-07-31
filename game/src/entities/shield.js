/**
 * The player's shield: an arc orbiting the core at a fixed radius.
 * Only its angle is player-controlled.
 */

import { CONFIG } from '../config.js';
import { angleDelta, damp, normalizeAngle } from '../math.js';

export function createShield() {
  return {
    angle: -Math.PI / 2,
    /** Decays after every successful block; drives the impact flash. */
    flash: 0,
    /** Radial recoil in units, pushed outward on impact. */
    recoil: 0,
  };
}

/**
 * `idleSpin` (radians/second) drifts the shield when no pointer has been seen
 * yet — it keeps the menu alive and shows what the shield does before the
 * player touches anything.
 */
export function updateShield(shield, input, dt, idleSpin = 0) {
  if (idleSpin !== 0 && !input.hasPointer) {
    shield.angle = normalizeAngle(shield.angle + idleSpin * dt);
  } else if (input.mode === 'keyboard' && input.turn !== 0) {
    shield.angle = normalizeAngle(
      shield.angle + input.turn * CONFIG.shield.keyboardSpeed * dt,
    );
  } else if (input.mode === 'pointer' && input.hasPointer) {
    const delta = angleDelta(shield.angle, input.pointerAngle);
    shield.angle = normalizeAngle(
      damp(shield.angle, shield.angle + delta, CONFIG.shield.followStiffness, dt),
    );
  }

  shield.flash = Math.max(0, shield.flash - dt * 3.6);
  shield.recoil = damp(shield.recoil, 0, 12, dt);
}

/** True when `angle` falls inside the shield arc. */
export function shieldCovers(shield, angle) {
  return Math.abs(angleDelta(shield.angle, angle)) <= CONFIG.shield.arcSpan / 2;
}

export function registerImpact(shield, strength = 1) {
  shield.flash = Math.min(1.6, shield.flash + strength);
  shield.recoil = Math.min(0.02, shield.recoil + 0.011 * strength);
}
