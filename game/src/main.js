/**
 * Entry point: canvas setup, resize handling and the main loop.
 */

import { CONFIG } from './config.js';
import { toggleMute, unlockAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer, render } from './render/renderer.js';
import { createGame, handleAction, pauseIfPlaying, togglePause, updateGame } from './state/game.js';
import { createViewport, resizeViewport } from './viewport.js';

const canvas = document.getElementById('stage');
// `alpha: false` lets the compositor skip blending the page behind the canvas.
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const viewport = createViewport();
resizeViewport(viewport, canvas, ctx);

const input = createInput(canvas, viewport, {
  onAction: () => {
    unlockAudio();
    handleAction(game);
  },
  onPause: () => togglePause(game),
  onMute: () => toggleMute(),
});

const game = createGame(viewport, input.state);
const renderer = createRenderer(ctx, viewport);

function applyResize() {
  resizeViewport(viewport, canvas, ctx);
}

if (window.ResizeObserver) new ResizeObserver(applyResize).observe(canvas);
window.addEventListener('resize', applyResize);
window.addEventListener('orientationchange', applyResize);

// Losing focus mid-run should never cost a life.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseIfPlaying(game);
    return;
  }
  // A page that loaded while hidden never ran layout, so the canvas can still
  // be at its 1x1 fallback size. Re-measure the moment it becomes visible.
  applyResize();
});
window.addEventListener('blur', () => pauseIfPlaying(game));

// Exposed so automated play-testing can drive a run and read the outcome.
// Read-mostly game state; nothing here changes how the game plays.
window.__deflect = { game, viewport };

let lastFrameTime = performance.now();

function frame(now) {
  // Clamping keeps a backgrounded tab from teleporting shards through the shield.
  const dt = Math.min((now - lastFrameTime) / 1000, CONFIG.feel.maxDeltaTime);
  lastFrameTime = now;

  updateGame(game, dt);
  render(renderer, game, dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
