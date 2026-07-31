/**
 * Radial synthwave backdrop.
 *
 * A classic horizon grid fights a centre-based game, so the grid is bent into
 * the playfield's own geometry: spokes converging on the core plus rings
 * flowing outward. The whole layer reacts to the run's energy (combo +
 * difficulty), which makes a hot streak visibly hotter.
 */

import { CONFIG } from '../config.js';
import { TAU, clamp, rand } from '../math.js';
import { withAlpha } from './neon.js';

const SPOKE_COUNT = 18;
const RING_COUNT = 6;
const STAR_COUNT = 90;

export function createBackground() {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      // Normalized coordinates so a resize never re-scatters the sky.
      x: Math.random(),
      y: Math.random(),
      size: rand(0.5, 1.7),
      phase: rand(0, TAU),
      twinkle: rand(0.5, 1.8),
    });
  }
  return { stars, rotation: 0 };
}

export function updateBackground(background, dt, energy) {
  background.rotation += dt * (0.035 + energy * 0.11);
}

export function drawBackground(ctx, background, viewport, { time, energy, danger }) {
  const { width, height, centerX, centerY, unit, cornerDistance } = viewport;

  drawBase(ctx, viewport, danger);
  drawStars(ctx, background, viewport, time);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawSpokes(ctx, background, centerX, centerY, unit, cornerDistance, energy);
  drawRings(ctx, centerX, centerY, unit, cornerDistance, time, energy);
  ctx.restore();

  drawHorizonGlow(ctx, width, height, energy);
  drawVignette(ctx, viewport, danger);
}

function drawBase(ctx, viewport, danger) {
  const { width, height, centerX, centerY, unit } = viewport;
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, unit * 1.05);
  gradient.addColorStop(0, danger > 0 ? '#2a0620' : CONFIG.colors.backgroundGlow);
  gradient.addColorStop(0.55, '#0d0530');
  gradient.addColorStop(1, CONFIG.colors.background);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(ctx, background, viewport, time) {
  const { width, height } = viewport;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = CONFIG.colors.star;

  for (const star of background.stars) {
    const flicker = 0.35 + 0.35 * Math.sin(time * star.twinkle + star.phase);
    ctx.globalAlpha = flicker;
    ctx.fillRect(star.x * width, star.y * height, star.size, star.size);
  }
  ctx.restore();
}

function drawSpokes(ctx, background, centerX, centerY, unit, cornerDistance, energy) {
  const length = cornerDistance * unit * 1.1;
  const inner = unit * 0.14;

  ctx.lineWidth = 1;
  for (let i = 0; i < SPOKE_COUNT; i += 1) {
    const angle = background.rotation + (i / SPOKE_COUNT) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const alternating = i % 2 === 0;

    const gradient = ctx.createLinearGradient(
      centerX + cos * inner,
      centerY + sin * inner,
      centerX + cos * length,
      centerY + sin * length,
    );
    const color = alternating ? CONFIG.colors.grid : CONFIG.colors.horizon;
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

function drawRings(ctx, centerX, centerY, unit, cornerDistance, time, energy) {
  const speed = 0.09 + energy * 0.13;

  for (let i = 0; i < RING_COUNT; i += 1) {
    const progress = ((time * speed) + i / RING_COUNT) % 1;
    const radius = unit * (0.12 + progress * cornerDistance * 1.15);
    // Fade in from the centre, fade out at the edge.
    const alpha = Math.sin(progress * Math.PI) * (0.14 + energy * 0.11);
    if (alpha <= 0.002) continue;

    ctx.strokeStyle = withAlpha(i % 2 === 0 ? CONFIG.colors.grid : CONFIG.colors.horizon, alpha);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.stroke();
  }
}

function drawHorizonGlow(ctx, width, height, energy) {
  const glowHeight = height * 0.32;
  const gradient = ctx.createLinearGradient(0, height - glowHeight, 0, height);
  gradient.addColorStop(0, withAlpha(CONFIG.colors.horizon, 0));
  gradient.addColorStop(1, withAlpha(CONFIG.colors.horizon, 0.1 + energy * 0.06));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - glowHeight, width, glowHeight);
  ctx.restore();
}

function drawVignette(ctx, viewport, danger) {
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
  dangerGradient.addColorStop(0, withAlpha(CONFIG.colors.danger, 0));
  dangerGradient.addColorStop(1, withAlpha(CONFIG.colors.danger, 0.3 * pulse));
  ctx.fillStyle = dangerGradient;
  ctx.fillRect(0, 0, width, height);
}
