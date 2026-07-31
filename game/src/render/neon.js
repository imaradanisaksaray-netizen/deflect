/**
 * Neon drawing primitives.
 *
 * Glow is built from stacked additive passes (wide+faint -> narrow+bright ->
 * white core) instead of `shadowBlur`. It looks better and costs a fraction of
 * the time, which is what keeps 60fps on mid-range phones.
 */

const alphaCache = new Map();

/** hex colour + alpha -> cached rgba() string, so no garbage per frame. */
export function withAlpha(hex, alpha) {
  const key = `${hex}|${alpha.toFixed(3)}`;
  const cached = alphaCache.get(key);
  if (cached) return cached;

  const value = Number.parseInt(hex.slice(1), 16);
  const rgba = `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
  alphaCache.set(key, rgba);
  return rgba;
}

const GLOW_LAYERS = [
  { scale: 5.5, alpha: 0.07 },
  { scale: 2.8, alpha: 0.15 },
  { scale: 1, alpha: 0.8 },
];

export function neonStroke(ctx, drawPath, { color, width = 2, intensity = 1, core = true }) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const layer of GLOW_LAYERS) {
    ctx.lineWidth = width * layer.scale;
    ctx.globalAlpha = layer.alpha * intensity;
    ctx.beginPath();
    drawPath(ctx);
    ctx.stroke();
  }

  if (core) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.6, width * 0.3);
    ctx.globalAlpha = 0.85 * intensity;
    ctx.beginPath();
    drawPath(ctx);
    ctx.stroke();
  }

  ctx.restore();
}

export function neonFill(ctx, drawPath, { color, intensity = 1, glowRadius = 0 }) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (glowRadius > 0) {
    ctx.globalAlpha = 0.35 * intensity;
    ctx.fillStyle = color;
    ctx.filter = 'none';
    ctx.beginPath();
    drawPath(ctx, glowRadius);
    ctx.fill();
  }

  ctx.globalAlpha = 0.95 * intensity;
  ctx.fillStyle = color;
  ctx.beginPath();
  drawPath(ctx, 1);
  ctx.fill();
  ctx.restore();
}

/** Soft radial halo — used for the core, impacts and the vignette highlights. */
export function radialGlow(ctx, x, y, radius, color, intensity = 1) {
  if (radius <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, withAlpha(color, 0.55 * intensity));
  gradient.addColorStop(0.45, withAlpha(color, 0.16 * intensity));
  gradient.addColorStop(1, withAlpha(color, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * Letter-spaced text drawn manually.
 * `ctx.letterSpacing` is still missing in older Safari/Firefox, and the wide
 * tracking is a core part of the retro look, so it is worth doing by hand.
 */
export function spacedText(ctx, text, x, y, spacing, align = 'center') {
  const characters = [...text];
  const widths = characters.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0)
    + spacing * Math.max(0, characters.length - 1);

  let cursor = x;
  if (align === 'center') cursor = x - total / 2;
  else if (align === 'right') cursor = x - total;

  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  characters.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index] + spacing;
  });
  ctx.textAlign = previousAlign;
}

/** Glowing text: a few offset passes under a bright core pass. */
export function neonText(ctx, text, x, y, { size, color, spacing = 0, weight = 700, font = 'sans', align = 'center', intensity = 1 }) {
  const family = font === 'mono'
    ? "ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace"
    : "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'lighter';

  // Offset passes build the halo.
  ctx.fillStyle = withAlpha(color, 0.14 * intensity);
  for (const offset of [3, 2, 1]) {
    ctx.globalAlpha = 0.5;
    spacedText(ctx, text, x + offset * 0.5, y, spacing, align);
    spacedText(ctx, text, x - offset * 0.5, y, spacing, align);
  }

  // The body is drawn with normal blending. Additive here would push a
  // saturated red past 255 on one channel only and turn it pink.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  spacedText(ctx, text, x, y, spacing, align);

  // A restrained additive white core keeps the glow hot without bleaching it.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = withAlpha('#ffffff', 0.14 * intensity);
  spacedText(ctx, text, x, y, spacing, align);
  ctx.restore();
}

/** Flat (non-glowing) text for secondary labels. */
export function plainText(ctx, text, x, y, { size, color, spacing = 0, weight = 500, font = 'sans', align = 'center', alpha = 1 }) {
  const family = font === 'mono'
    ? "ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace"
    : "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  spacedText(ctx, text, x, y, spacing, align);
  ctx.restore();
}
