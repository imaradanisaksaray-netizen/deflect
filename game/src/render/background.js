/**
 * Radial backdrop, driven by the active theme.
 *
 * A theme changes two things here: the palette, and the "atmosphere" — a layer
 * of drifting particles with its own physics. Repainting colours alone makes
 * every theme feel like the same room in a different light; the atmosphere is
 * what makes EMBER feel hot and ICE feel still.
 *
 * Particles live in normalized 0..1 space so a resize never re-scatters them.
 */

import { ATMOSPHERE } from '../themes/index.js';
import { TAU, clamp, rand } from '../math.js';
import { withAlpha } from './neon.js';

const RING_COUNT = 6;
const STAR_BASE = 90;
const PARTICLE_BASE = 70;

export function createBackground(theme) {
  return {
    rotation: 0,
    stars: createStars(theme),
    particles: createParticles(theme),
    atmosphere: theme.backdrop.atmosphere,
  };
}

function createStars(theme) {
  const count = Math.round(STAR_BASE * theme.backdrop.starDensity);
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: rand(0.5, 1.7),
      phase: rand(0, TAU),
      twinkle: rand(0.5, 1.8),
    });
  }
  return stars;
}

function createParticles(theme) {
  if (theme.backdrop.atmosphere === ATMOSPHERE.none) return [];
  const particles = [];
  for (let i = 0; i < PARTICLE_BASE; i += 1) particles.push(spawnParticle(theme, true));
  return particles;
}

/** `anywhere` seeds the initial field; later respawns enter from an edge. */
function spawnParticle(theme, anywhere) {
  const type = theme.backdrop.atmosphere;
  const base = {
    x: Math.random(),
    y: Math.random(),
    size: rand(0.6, 2.2),
    life: rand(0.5, 1),
    speed: rand(0.5, 1.4),
    phase: rand(0, TAU),
  };

  if (type === ATMOSPHERE.ember || type === ATMOSPHERE.spore) {
    return { ...base, y: anywhere ? Math.random() : 1.05 };
  }
  if (type === ATMOSPHERE.snow) {
    return { ...base, y: anywhere ? Math.random() : -0.05 };
  }
  if (type === ATMOSPHERE.pull) {
    // Start near the rim so the inward drift is visible.
    const angle = rand(0, TAU);
    const radius = anywhere ? rand(0.2, 0.7) : rand(0.6, 0.75);
    return { ...base, x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius };
  }
  if (type === ATMOSPHERE.flare) {
    const angle = rand(0, TAU);
    const radius = anywhere ? rand(0.05, 0.6) : rand(0.02, 0.08);
    return { ...base, x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius, angle };
  }
  return base;
}

export function updateBackground(background, dt, energy, theme) {
  background.rotation += dt * (0.035 + energy * 0.11) * theme.backdrop.ringSpeed;
  updateParticles(background, dt, energy, theme);
}

function updateParticles(background, dt, energy, theme) {
  const type = background.atmosphere;
  if (type === ATMOSPHERE.none) return;

  const boost = 1 + energy * 0.6;

  for (let i = 0; i < background.particles.length; i += 1) {
    const p = background.particles[i];
    p.phase += dt * p.speed;

    if (type === ATMOSPHERE.ember) {
      p.y -= dt * 0.09 * p.speed * boost;
      p.x += Math.sin(p.phase * 1.6) * dt * 0.012;
      if (p.y < -0.05) background.particles[i] = spawnParticle(theme, false);
    } else if (type === ATMOSPHERE.spore) {
      p.y -= dt * 0.045 * p.speed * boost;
      p.x += Math.sin(p.phase) * dt * 0.03;
      if (p.y < -0.05) background.particles[i] = spawnParticle(theme, false);
    } else if (type === ATMOSPHERE.snow) {
      p.y += dt * 0.055 * p.speed * boost;
      p.x += Math.sin(p.phase * 0.7) * dt * 0.02;
      if (p.y > 1.05) background.particles[i] = spawnParticle(theme, false);
    } else if (type === ATMOSPHERE.pull) {
      const dx = 0.5 - p.x;
      const dy = 0.5 - p.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      // Acceleration rises as the particle nears the core, so it visibly falls in.
      const pullSpeed = dt * (0.05 + (0.35 - Math.min(dist, 0.35)) * 0.55) * p.speed * boost;
      p.x += (dx / dist) * pullSpeed;
      p.y += (dy / dist) * pullSpeed;
      if (dist < 0.04) background.particles[i] = spawnParticle(theme, false);
    } else if (type === ATMOSPHERE.flare) {
      const angle = p.angle ?? 0;
      const push = dt * 0.13 * p.speed * boost;
      p.x += Math.cos(angle) * push;
      p.y += Math.sin(angle) * push;
      if (Math.hypot(p.x - 0.5, p.y - 0.5) > 0.8) background.particles[i] = spawnParticle(theme, false);
    }
  }
}

export function drawBackground(ctx, background, viewport, { time, energy, danger, theme }) {
  const { width, height, centerX, centerY, unit, cornerDistance } = viewport;
  const colors = theme.colors;

  drawBase(ctx, viewport, danger, colors);
  drawStars(ctx, background, viewport, time, colors);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawSpokes(ctx, background, centerX, centerY, unit, cornerDistance, energy, theme);
  drawRings(ctx, centerX, centerY, unit, cornerDistance, time, energy, theme);
  drawAtmosphere(ctx, background, width, height, unit, theme);
  ctx.restore();

  drawHorizonGlow(ctx, width, height, energy, theme);
  drawVignette(ctx, viewport, danger, colors);
}

function drawBase(ctx, viewport, danger, colors) {
  const { width, height, centerX, centerY, unit } = viewport;
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, unit * 1.05);
  gradient.addColorStop(0, danger > 0 ? withAlpha(colors.danger, 0.14) : colors.backgroundGlow);
  gradient.addColorStop(0.55, colors.backgroundGlow);
  gradient.addColorStop(1, colors.background);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(ctx, background, viewport, time, colors) {
  const { width, height } = viewport;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = colors.star;

  for (const star of background.stars) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * star.twinkle + star.phase);
    ctx.fillRect(star.x * width, star.y * height, star.size, star.size);
  }
  ctx.restore();
}

function drawAtmosphere(ctx, background, width, height, unit, theme) {
  if (background.atmosphere === ATMOSPHERE.none) return;

  const color = theme.backdrop.particleColor;
  const scale = unit * 0.0032;

  for (const p of background.particles) {
    const alpha = 0.10 + 0.35 * p.life;
    ctx.fillStyle = withAlpha(color, alpha);
    const r = p.size * scale;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, r, 0, TAU);
    ctx.fill();
  }
}

function drawSpokes(ctx, background, centerX, centerY, unit, cornerDistance, energy, theme) {
  const { spokeCount } = theme.backdrop;
  const colors = theme.colors;
  const length = cornerDistance * unit * 1.1;
  const inner = unit * 0.14;

  ctx.lineWidth = 1;
  for (let i = 0; i < spokeCount; i += 1) {
    const angle = background.rotation + (i / spokeCount) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const color = i % 2 === 0 ? colors.grid : colors.horizon;

    const gradient = ctx.createLinearGradient(
      centerX + cos * inner,
      centerY + sin * inner,
      centerX + cos * length,
      centerY + sin * length,
    );
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(0.35, withAlpha(color, 0.21 + energy * 0.15));
    gradient.addColorStop(1, withAlpha(color, 0));

    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(centerX + cos * inner, centerY + sin * inner);
    ctx.lineTo(centerX + cos * length, centerY + sin * length);
    ctx.stroke();
  }
}

function drawRings(ctx, centerX, centerY, unit, cornerDistance, time, energy, theme) {
  const speed = (0.09 + energy * 0.13) * theme.backdrop.ringSpeed;
  const colors = theme.colors;

  for (let i = 0; i < RING_COUNT; i += 1) {
    const progress = ((time * speed) + i / RING_COUNT) % 1;
    const radius = unit * (0.12 + progress * cornerDistance * 1.15);
    const alpha = Math.sin(progress * Math.PI) * (0.14 + energy * 0.11);
    if (alpha <= 0.002) continue;

    ctx.strokeStyle = withAlpha(i % 2 === 0 ? colors.grid : colors.horizon, alpha);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.stroke();
  }
}

function drawHorizonGlow(ctx, width, height, energy, theme) {
  const strength = theme.backdrop.horizonStrength;
  if (strength <= 0) return;

  const glowHeight = height * 0.32;
  const gradient = ctx.createLinearGradient(0, height - glowHeight, 0, height);
  gradient.addColorStop(0, withAlpha(theme.colors.horizon, 0));
  gradient.addColorStop(1, withAlpha(theme.colors.horizon, (0.1 + energy * 0.06) * strength));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - glowHeight, width, glowHeight);
  ctx.restore();
}

function drawVignette(ctx, viewport, danger, colors) {
  const { width, height, centerX, centerY } = viewport;
  const outer = Math.hypot(width, height) / 2;
  const gradient = ctx.createRadialGradient(centerX, centerY, outer * 0.42, centerX, centerY, outer);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.72)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const pulse = clamp(danger, 0, 1);
  if (pulse <= 0) return;

  const dangerGradient = ctx.createRadialGradient(
    centerX, centerY, outer * 0.3, centerX, centerY, outer,
  );
  dangerGradient.addColorStop(0, withAlpha(colors.danger, 0));
  dangerGradient.addColorStop(1, withAlpha(colors.danger, 0.3 * pulse));
  ctx.fillStyle = dangerGradient;
  ctx.fillRect(0, 0, width, height);
}
