/**
 * Particle and shockwave rendering. Everything is additive, so overlapping
 * sparks bloom into white the way real neon does.
 */

import { TAU } from '../math.js';
import { withAlpha } from './neon.js';

export function drawEffects(ctx, effects) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const particle of effects.particles) {
    const life = particle.life / particle.maxLife;
    ctx.globalAlpha = life * 0.9;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * (0.3 + life * 0.7), 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  for (const wave of effects.waves) {
    const life = wave.life / wave.maxLife;
    ctx.strokeStyle = withAlpha(wave.color, life * 0.55);
    ctx.lineWidth = wave.thickness * life;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();
}
