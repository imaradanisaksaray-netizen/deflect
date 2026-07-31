/**
 * Viewport handling and the polar -> screen mapping.
 *
 * The playfield is sized from `unit = min(width, height)`, so the game is
 * identical on a phone in portrait, a desktop in landscape, and every aspect
 * ratio in between. Playables requires exactly that.
 */

export function createViewport() {
  return {
    width: 1,
    height: 1,
    centerX: 0.5,
    centerY: 0.5,
    unit: 1,
    dpr: 1,
    /** Distance from the centre to the furthest corner, in units. */
    cornerDistance: 1,
  };
}

/**
 * Resizes the backing store to the device pixel ratio and rescales the context
 * so all drawing code can keep working in CSS pixels.
 */
export function resizeViewport(viewport, canvas, ctx) {
  const width = Math.max(1, canvas.clientWidth || window.innerWidth);
  const height = Math.max(1, canvas.clientHeight || window.innerHeight);
  // Cap the ratio: beyond 2x the extra pixels cost more than they show.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  viewport.width = width;
  viewport.height = height;
  viewport.centerX = width / 2;
  viewport.centerY = height / 2;
  viewport.unit = Math.min(width, height);
  viewport.dpr = dpr;
  viewport.cornerDistance = Math.hypot(width, height) / 2 / viewport.unit;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export const toScreenX = (viewport, angle, distance) =>
  viewport.centerX + Math.cos(angle) * distance * viewport.unit;

export const toScreenY = (viewport, angle, distance) =>
  viewport.centerY + Math.sin(angle) * distance * viewport.unit;
