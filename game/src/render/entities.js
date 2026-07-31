/**
 * Core, shield and shard rendering.
 *
 * Off-screen shards paint a warning marker on the screen edge they will enter
 * from. Without it the game would be unfair on wide monitors, where shards
 * spawn far outside the visible area.
 */

import { CONFIG, SHARD_TYPES } from '../config.js';
import { colorKeyOf, shapeOf } from '../entities/projectiles.js';
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
  const { theme } = game;
  const { viewport, time, coreFlash, lives } = game;
  const { centerX, centerY, unit } = viewport;
  const pulse = 1 + Math.sin(time * 2.4) * 0.03;
  const radius = unit * CONFIG.world.coreRadius * pulse;
  const color = coreFlash > 0.05 ? theme.colors.danger : theme.colors.core;

  radialGlow(ctx, centerX, centerY, radius * 3.4, color, 0.6 + coreFlash * 0.6);

  const body = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
  body.addColorStop(0, withAlpha('#ffffff', 0.62));
  body.addColorStop(0.4, withAlpha(theme.colors.coreShell, 0.5));
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

  drawIntegrityRing(ctx, viewport, lives, time, coreFlash, theme);
}

/** Three arc segments around the core double as the life counter. */
function drawIntegrityRing(ctx, viewport, lives, time, coreFlash, theme) {
  const { centerX, centerY, unit } = viewport;
  const radius = unit * CONFIG.world.coreRadius * 1.45;
  const segments = CONFIG.play.startLives;
  const gap = 0.28;
  const span = TAU / segments - gap;

  for (let i = 0; i < segments; i += 1) {
    const alive = i < lives;
    const start = -Math.PI / 2 + i * (TAU / segments) + gap / 2 + time * 0.25;
    const color = alive ? theme.colors.coreShell : theme.colors.textDim;
    const intensity = alive ? 1 - coreFlash * 0.4 : 0.18;

    // core: false — a white overlay here would wash the cyan out to grey.
    neonStroke(ctx, (context) => {
      context.arc(centerX, centerY, radius, start, start + span);
    }, { color, width: unit * 0.0095, intensity, core: false });
  }
}

export function drawShield(ctx, game) {
  const { theme } = game;
  const { viewport, shield, invulnerable, time } = game;
  const { centerX, centerY, unit } = viewport;
  const radius = (CONFIG.world.shieldRadius + shield.recoil) * unit;
  // Read from the shield, not the config: WIDE GUARD widens it at runtime and
  // what is drawn must match what actually blocks.
  const half = (shield.arcSpan ?? CONFIG.shield.arcSpan) / 2;
  const start = shield.angle - half;
  const end = shield.angle + half;

  // Blink while invulnerable so the grace period is readable.
  const blink = invulnerable > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 18)) : 1;
  const intensity = clamp(blink * (1 + shield.flash * 0.7), 0, 2);

  neonStroke(ctx, (context) => {
    context.arc(centerX, centerY, radius, start, end);
  }, {
    color: theme.colors.shield,
    width: unit * CONFIG.world.shieldThickness,
    intensity: intensity * 0.75,
    core: false,
  });

  neonStroke(ctx, (context) => {
    context.arc(centerX, centerY, radius, start, end);
  }, {
    color: theme.colors.shieldEdge,
    width: unit * CONFIG.world.shieldThickness * 0.22,
    intensity: intensity * 0.9,
    core: false,
  });

  // Tips: small caps that make the arc's reach unmistakable.
  for (const angle of [start, end]) {
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    radialGlow(ctx, x, y, unit * 0.035, theme.colors.shield, 0.8 * blink);
  }

  if (shield.flash > 0.02) {
    const x = centerX + Math.cos(shield.angle) * radius;
    const y = centerY + Math.sin(shield.angle) * radius;
    radialGlow(ctx, x, y, unit * 0.12 * shield.flash, theme.colors.shield, shield.flash);
  }
}

export function drawProjectiles(ctx, game) {
  const { theme } = game;
  const { viewport, projectiles, time } = game;

  for (const projectile of projectiles) {
    if (!projectile.alive) continue;

    const limit = edgeDistance(projectile.angle, viewport);
    if (projectile.distance > limit) {
      drawEdgeWarning(ctx, viewport, projectile, limit, time, theme);
      continue;
    }
    drawShard(ctx, viewport, projectile, time, theme);
  }
}

/**
 * Rewards drifting in.
 *
 * Drawn after the shards so a pickup is never hidden behind one, and given a
 * slow halo pulse no shard has — in a crowded frame the motion reads before the
 * shape does.
 */
export function drawPickups(ctx, game) {
  const { theme, viewport, pickups, time } = game;
  const { unit } = viewport;
  const color = theme.colors.pickup;

  for (const pickup of pickups) {
    if (!pickup.alive) continue;

    const limit = edgeDistance(pickup.angle, viewport);
    const distance = Math.min(pickup.distance, limit - 0.022);
    const x = toScreenX(viewport, pickup.angle, distance);
    const y = toScreenY(viewport, pickup.angle, distance);
    const radius = unit * CONFIG.pickups.radius;
    const fadeIn = clamp(pickup.age * 3, 0, 1);
    const pulse = 0.7 + 0.3 * Math.sin(time * 4 + pickup.spin);

    radialGlow(ctx, x, y, radius * 3.4 * pulse, color, 0.6 * fadeIn);

    ctx.save();
    ctx.translate(x, y);
    // A slowly counter-rotating ring frames every reward identically, so the
    // symbol inside is the only thing the player has to read.
    ctx.save();
    ctx.rotate(-pickup.spin * 0.5);
    neonStroke(ctx, (context) => {
      for (let i = 0; i < 3; i += 1) {
        const start = (i / 3) * TAU;
        context.moveTo(Math.cos(start) * radius * 1.25, Math.sin(start) * radius * 1.25);
        context.arc(0, 0, radius * 1.25, start, start + 0.72);
      }
    }, { color, width: unit * 0.005, intensity: fadeIn * 0.85, core: false });
    ctx.restore();

    drawPickupSymbol(ctx, pickup.archetype.symbol, radius, unit, color, fadeIn);
    ctx.restore();
  }
}

function drawPickupSymbol(ctx, symbol, radius, unit, color, intensity) {
  const stroke = unit * 0.008;

  if (symbol === 'cross') {
    neonStroke(ctx, (context) => {
      context.moveTo(-radius * 0.55, 0);
      context.lineTo(radius * 0.55, 0);
      context.moveTo(0, -radius * 0.55);
      context.lineTo(0, radius * 0.55);
    }, { color, width: stroke, intensity });
    return;
  }

  // WIDE GUARD: two chevrons pushing apart. An arc would have been the literal
  // shield silhouette, but it reads as part of the ring framing every pickup.
  if (symbol === 'arc') {
    neonStroke(ctx, (context) => {
      context.moveTo(-radius * 0.15, -radius * 0.42);
      context.lineTo(-radius * 0.6, 0);
      context.lineTo(-radius * 0.15, radius * 0.42);
      context.moveTo(radius * 0.15, -radius * 0.42);
      context.lineTo(radius * 0.6, 0);
      context.lineTo(radius * 0.15, radius * 0.42);
    }, { color, width: stroke, intensity });
    return;
  }

  if (symbol === 'hourglass') {
    neonStroke(ctx, (context) => {
      context.moveTo(-radius * 0.45, -radius * 0.5);
      context.lineTo(radius * 0.45, -radius * 0.5);
      context.lineTo(-radius * 0.45, radius * 0.5);
      context.lineTo(radius * 0.45, radius * 0.5);
      context.closePath();
    }, { color, width: stroke, intensity });
    return;
  }

  // NOVA: rays firing outward, matching what it does to the screen.
  neonStroke(ctx, (context) => {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU;
      context.moveTo(Math.cos(a) * radius * 0.2, Math.sin(a) * radius * 0.2);
      context.lineTo(Math.cos(a) * radius * 0.66, Math.sin(a) * radius * 0.66);
    }
  }, { color, width: stroke, intensity });
}

/** Marker pinned to the screen edge while a shard is still outside the view. */
function drawEdgeWarning(ctx, viewport, projectile, limit, time, theme) {
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
    color: theme.colors[colorKeyOf(projectile)],
    width: unit * 0.005,
    intensity: (0.35 + proximity * 0.65) * pulse,
    core: false,
  });
  ctx.restore();
}

function drawShard(ctx, viewport, projectile, time, theme) {
  const { unit } = viewport;
  const { angle, distance } = projectile;
  const x = toScreenX(viewport, angle, distance);
  const y = toScreenY(viewport, angle, distance);
  const radius = unit * CONFIG.world.projectileRadius * projectile.sizeScale;
  const fadeIn = clamp(projectile.age * 4, 0, 1);
  // A revealed mimic answers with the void colour and the spike shape.
  const color = theme.colors[colorKeyOf(projectile)];
  const shape = shapeOf(projectile);

  drawTrail(ctx, viewport, projectile, fadeIn, theme);
  radialGlow(ctx, x, y, radius * 2.6, color, 0.55 * fadeIn);

  // The moment of a reveal gets its own flare, so the switch is impossible to
  // miss even in a crowded frame.
  if (projectile.revealFlash > 0.01) {
    radialGlow(ctx, x, y, radius * (3 + projectile.revealFlash * 5), color, projectile.revealFlash);
  }

  ctx.save();
  ctx.translate(x, y);
  drawShardShape(ctx, shape, radius, unit, color, fadeIn, projectile, time);
  ctx.restore();
}

/** Shape drawing shared by in-flight shards and the menu icons. */
function drawShardShape(ctx, shape, radius, unit, color, intensity, projectile, time) {
  const spin = projectile ? projectile.spin : 0;
  const stroke = unit * 0.008;

  if (shape === 'circle') {
    ctx.rotate(spin * 0.4);
    neonStroke(ctx, (context) => {
      context.arc(0, 0, radius * 0.62, 0, TAU);
    }, { color, width: stroke, intensity });
    return;
  }

  if (shape === 'diamond') {
    ctx.rotate(spin);
    neonStroke(ctx, (context) => {
      context.moveTo(0, -radius * 0.8);
      context.lineTo(radius * 0.62, 0);
      context.lineTo(0, radius * 0.8);
      context.lineTo(-radius * 0.62, 0);
      context.closePath();
    }, { color, width: stroke, intensity });
    return;
  }

  // Splitter: concentric rings read as "there is another one inside".
  if (shape === 'ringed') {
    ctx.rotate(spin * 0.3);
    neonStroke(ctx, (context) => {
      context.arc(0, 0, radius * 0.82, 0, TAU);
    }, { color, width: stroke, intensity });
    neonStroke(ctx, (context) => {
      context.arc(0, 0, radius * 0.4, 0, TAU);
    }, { color, width: stroke * 0.8, intensity: intensity * 0.9 });
    return;
  }

  // Armoured: a heavy bracketed shell around a small core. Once the shell is
  // gone the brackets disappear and only the core is left, which tells the
  // player at a glance that one more hit finishes it.
  if (shape === 'shelled') {
    const intact = !projectile || projectile.hitPoints > 1;
    ctx.rotate(spin * 0.5);

    if (intact) {
      for (let i = 0; i < 4; i += 1) {
        const start = (i / 4) * TAU + 0.35;
        neonStroke(ctx, (context) => {
          context.arc(0, 0, radius * 0.9, start, start + 0.9);
        }, { color, width: stroke * 1.6, intensity, core: false });
      }
    }

    neonStroke(ctx, (context) => {
      context.arc(0, 0, radius * (intact ? 0.34 : 0.6), 0, TAU);
    }, { color, width: stroke, intensity });
    return;
  }

  // Spike (void, and revealed mimics).
  ctx.rotate(-spin * 1.3);
  const spikes = 3;
  const throb = 1 + Math.sin(time * 7 + spin) * 0.08;
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
  }, { color, width: unit * 0.009, intensity });
}

function drawTrail(ctx, viewport, projectile, fadeIn, theme) {
  const { unit } = viewport;
  const length = Math.min(0.16, projectile.speed * 0.22);
  const tail = Math.min(projectile.spawnDistance, projectile.distance + length);

  const fromX = toScreenX(viewport, projectile.angle, tail);
  const fromY = toScreenY(viewport, projectile.angle, tail);
  const toX = toScreenX(viewport, projectile.angle, projectile.distance);
  const toY = toScreenY(viewport, projectile.angle, projectile.distance);

  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, withAlpha(theme.colors[colorKeyOf(projectile)], 0));
  gradient.addColorStop(1, withAlpha(theme.colors[colorKeyOf(projectile)], 0.5 * fadeIn));

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
export function drawShardIcon(ctx, x, y, size, typeKey, spin, theme) {
  const archetype = SHARD_TYPES[typeKey];
  const color = theme.colors[archetype.colorKey];
  radialGlow(ctx, x, y, size * 2, color, 0.5);

  ctx.save();
  ctx.translate(x, y);
  // Icons reuse the in-flight shapes so the menu can never drift from the game.
  drawShardShape(ctx, archetype.shape, size, size * 4, color, 1, { spin, hitPoints: archetype.hitPoints ?? 1 }, 0);
  ctx.restore();
}

