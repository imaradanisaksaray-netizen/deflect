/**
 * Core, shield and shard rendering.
 *
 * Off-screen shards paint a warning marker on the screen edge they will enter
 * from. Without it the game would be unfair on wide monitors, where shards
 * spawn far outside the visible area.
 */

import { CONFIG, SHARD_TYPES } from '../config.js';
import { TAU, clamp } from '../math.js';
import { toScreenX, toScreenY } from '../viewport.js';
import { neonStroke, radialGlow, withAlpha } from './neon.js';

/** Distance from the centre to the screen edge along `angle`, in units. */
function edgeDistance(angle, viewport) {
  const halfWidth = viewport.width / 2 / viewport.unit;
  const halfHeight = viewport.height / 2 / viewport.unit;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  const horizontal = cos < 1e-6 ? Infinity : halfWidth / cos;
  const vertical = sin < 1e-6 ? Infinity : halfHeight / sin;
  return Math.min(horizontal, vertical);
}

export function drawCore(ctx, game) {
  const { viewport, time, coreFlash, lives } = game;
  const { centerX, centerY, unit } = viewport;
  const pulse = 1 + Math.sin(time * 2.4) * 0.03;
  const radius = unit * CONFIG.world.coreRadius * pulse;
  const color = coreFlash > 0.05 ? CONFIG.colors.danger : CONFIG.colors.core;

  radialGlow(ctx, centerX, centerY, radius * 3.4, color, 0.6 + coreFlash * 0.6);

  const body = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
  body.addColorStop(0, withAlpha('#ffffff', 0.62));
  body.addColorStop(0.4, withAlpha(CONFIG.colors.coreShell, 0.5));
  body.addColorStop(1, withAlpha(color, 0.12));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TAU);
  ctx.fill();
  ctx.restore();

  neonStroke(ctx, (context) => {
    context.arc(centerX, centerY, radius, 0, TAU);
  }, { color, width: unit * 0.004, intensity: 0.9, core: false });

  drawIntegrityRing(ctx, viewport, lives, time, coreFlash);
}

/** Three arc segments around the core double as the life counter. */
function drawIntegrityRing(ctx, viewport, lives, time, coreFlash) {
  const { centerX, centerY, unit } = viewport;
  const radius = unit * CONFIG.world.coreRadius * 1.45;
  const segments = CONFIG.play.startLives;
  const gap = 0.28;
  const span = TAU / segments - gap;

  for (let i = 0; i < segments; i += 1) {
    const alive = i < lives;
    const start = -Math.PI / 2 + i * (TAU / segments) + gap / 2 + time * 0.25;
    const color = alive ? CONFIG.colors.coreShell : CONFIG.colors.textDim;
    const intensity = alive ? 1 - coreFlash * 0.4 : 0.18;

    // core: false — a white overlay here would wash the cyan out to grey.
    neonStroke(ctx, (context) => {
      context.arc(centerX, centerY, radius, start, start + span);
    }, { color, width: unit * 0.0095, intensity, core: false });
  }
}

export function drawShield(ctx, game) {
  const { viewport, shield, invulnerable, time } = game;
  const { centerX, centerY, unit } = viewport;
  const radius = (CONFIG.world.shieldRadius + shield.recoil) * unit;
  const half = CONFIG.shield.arcSpan / 2;
  const start = shield.angle - half;
  const end = shield.angle + half;

  // Blink while invulnerable so the grace period is readable.
  const blink = invulnerable > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 18)) : 1;
  const intensity = clamp(blink * (1 + shield.flash * 0.7), 0, 2);

  neonStroke(ctx, (context) => {
    context.arc(centerX, centerY, radius, start, end);
  }, {
    color: CONFIG.colors.shield,
    width: unit * CONFIG.world.shieldThickness,
    intensity: intensity * 0.75,
    core: false,
  });

  neonStroke(ctx, (context) => {
    context.arc(centerX, centerY, radius, start, end);
  }, {
    color: CONFIG.colors.shieldEdge,
    width: unit * CONFIG.world.shieldThickness * 0.22,
    intensity: intensity * 0.9,
    core: false,
  });

  // Tips: small caps that make the arc's reach unmistakable.
  for (const angle of [start, end]) {
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    radialGlow(ctx, x, y, unit * 0.035, CONFIG.colors.shield, 0.8 * blink);
  }

  if (shield.flash > 0.02) {
    const x = centerX + Math.cos(shield.angle) * radius;
    const y = centerY + Math.sin(shield.angle) * radius;
    radialGlow(ctx, x, y, unit * 0.12 * shield.flash, CONFIG.colors.shield, shield.flash);
  }
}

export function drawProjectiles(ctx, game) {
  const { viewport, projectiles, time } = game;

  for (const projectile of projectiles) {
    if (!projectile.alive) continue;

    const limit = edgeDistance(projectile.angle, viewport);
    if (projectile.distance > limit) {
      drawEdgeWarning(ctx, viewport, projectile, limit, time);
      continue;
    }
    drawShard(ctx, viewport, projectile, time);
  }
}

/** Marker pinned to the screen edge while a shard is still outside the view. */
function drawEdgeWarning(ctx, viewport, projectile, limit, time) {
  const { unit } = viewport;
  const distance = limit - 0.022;
  const x = toScreenX(viewport, projectile.angle, distance);
  const y = toScreenY(viewport, projectile.angle, distance);
  const proximity = clamp(1 - (projectile.distance - limit) / 0.35, 0, 1);
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin(time * 9));
  const size = unit * 0.03 * (0.6 + proximity * 0.8);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(projectile.angle);
  neonStroke(ctx, (context) => {
    context.moveTo(size * 0.5, 0);
    context.lineTo(-size * 0.3, -size * 0.75);
    context.lineTo(-size * 0.3, size * 0.75);
    context.closePath();
  }, {
    color: projectile.archetype.color,
    width: unit * 0.005,
    intensity: (0.35 + proximity * 0.65) * pulse,
    core: false,
  });
  ctx.restore();
}

function drawShard(ctx, viewport, projectile, time) {
  const { unit } = viewport;
  const { angle, distance, archetype } = projectile;
  const x = toScreenX(viewport, angle, distance);
  const y = toScreenY(viewport, angle, distance);
  const radius = unit * CONFIG.world.projectileRadius;
  const fadeIn = clamp(projectile.age * 4, 0, 1);

  drawTrail(ctx, viewport, projectile, fadeIn);
  radialGlow(ctx, x, y, radius * 2.6, archetype.color, 0.55 * fadeIn);

  ctx.save();
  ctx.translate(x, y);

  if (archetype.shape === 'circle') {
    ctx.rotate(projectile.spin * 0.4);
    neonStroke(ctx, (context) => {
      context.arc(0, 0, radius * 0.62, 0, TAU);
    }, { color: archetype.color, width: unit * 0.008, intensity: fadeIn });
  } else if (archetype.shape === 'diamond') {
    ctx.rotate(projectile.spin);
    neonStroke(ctx, (context) => {
      context.moveTo(0, -radius * 0.8);
      context.lineTo(radius * 0.62, 0);
      context.lineTo(0, radius * 0.8);
      context.lineTo(-radius * 0.62, 0);
      context.closePath();
    }, { color: archetype.color, width: unit * 0.008, intensity: fadeIn });
  } else {
    ctx.rotate(-projectile.spin * 1.3);
    const spikes = 3;
    const throb = 1 + Math.sin(time * 7 + projectile.spin) * 0.08;
    neonStroke(ctx, (context) => {
      for (let i = 0; i < spikes * 2; i += 1) {
        const spikeAngle = (i / (spikes * 2)) * TAU;
        const spikeRadius = (i % 2 === 0 ? radius * 0.95 : radius * 0.34) * throb;
        const px = Math.cos(spikeAngle) * spikeRadius;
        const py = Math.sin(spikeAngle) * spikeRadius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    }, { color: archetype.color, width: unit * 0.009, intensity: fadeIn });
  }

  ctx.restore();
}

function drawTrail(ctx, viewport, projectile, fadeIn) {
  const { unit } = viewport;
  const length = Math.min(0.16, projectile.speed * 0.22);
  const tail = Math.min(projectile.spawnDistance, projectile.distance + length);

  const fromX = toScreenX(viewport, projectile.angle, tail);
  const fromY = toScreenY(viewport, projectile.angle, tail);
  const toX = toScreenX(viewport, projectile.angle, projectile.distance);
  const toY = toScreenY(viewport, projectile.angle, projectile.distance);

  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, withAlpha(projectile.archetype.color, 0));
  gradient.addColorStop(1, withAlpha(projectile.archetype.color, 0.5 * fadeIn));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = gradient;
  ctx.lineWidth = unit * 0.012;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

/** Small preview shard used by the menu's how-to-play row. */
export function drawShardIcon(ctx, x, y, size, typeKey, spin = 0) {
  const archetype = SHARD_TYPES[typeKey];
  radialGlow(ctx, x, y, size * 2, archetype.color, 0.5);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);

  if (archetype.shape === 'circle') {
    neonStroke(ctx, (context) => context.arc(0, 0, size * 0.62, 0, TAU), {
      color: archetype.color, width: size * 0.2, intensity: 1,
    });
  } else if (archetype.shape === 'diamond') {
    neonStroke(ctx, (context) => {
      context.moveTo(0, -size * 0.8);
      context.lineTo(size * 0.62, 0);
      context.lineTo(0, size * 0.8);
      context.lineTo(-size * 0.62, 0);
      context.closePath();
    }, { color: archetype.color, width: size * 0.2, intensity: 1 });
  } else {
    neonStroke(ctx, (context) => {
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * TAU;
        const radius = i % 2 === 0 ? size * 0.95 : size * 0.34;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    }, { color: archetype.color, width: size * 0.22, intensity: 1 });
  }

  ctx.restore();
}
