/**
 * Particle and shockwave effects.
 *
 * Both pools live in screen space (pixels) and use swap-remove so no garbage is
 * generated per frame. Counts scale down when the user prefers reduced motion.
 */

import { rand, randInt, TAU } from '../math.js';

const MAX_PARTICLES = 480;
const MAX_WAVES = 24;

export function createEffects(intensity = 1) {
  return { particles: [], waves: [], intensity };
}

export function emitBurst(effects, { x, y, color, count = 14, speed = 260, spread = TAU, direction = 0, size = 3 }) {
  const total = Math.max(2, Math.round(count * effects.intensity));

  for (let i = 0; i < total; i += 1) {
    if (effects.particles.length >= MAX_PARTICLES) break;

    const angle = direction + rand(-spread / 2, spread / 2);
    const velocity = speed * rand(0.35, 1.15);
    const life = rand(0.28, 0.62);

    effects.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life,
      maxLife: life,
      size: size * rand(0.6, 1.5),
      color,
    });
  }
}

export function emitSparkTrail(effects, { x, y, color, count = 3 }) {
  emitBurst(effects, { x, y, color, count: randInt(1, count), speed: 90, size: 2 });
}

export function emitWave(effects, { x, y, color, radius = 30, thickness = 4, life = 0.45, growth = 520 }) {
  if (effects.waves.length >= MAX_WAVES) return;
  effects.waves.push({ x, y, color, radius, thickness, life, maxLife: life, growth });
}

export function updateEffects(effects, dt) {
  const { particles, waves } = effects;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;

    if (particle.life <= 0) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    // Air drag: sparks decelerate fast, which reads as "energy dissipating".
    const drag = Math.exp(-3.2 * dt);
    particle.vx *= drag;
    particle.vy *= drag;
  }

  for (let i = waves.length - 1; i >= 0; i -= 1) {
    const wave = waves[i];
    wave.life -= dt;

    if (wave.life <= 0) {
      waves[i] = waves[waves.length - 1];
      waves.pop();
      continue;
    }

    wave.radius += wave.growth * dt;
    wave.growth *= Math.exp(-2.4 * dt);
  }
}

export function clearEffects(effects) {
  effects.particles.length = 0;
  effects.waves.length = 0;
}
