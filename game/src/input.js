/**
 * Unified pointer + keyboard input.
 *
 * Design goal: one control, learnable in three seconds.
 *   - Desktop: the shield follows the mouse. No clicking required to steer.
 *   - Touch:   put a finger anywhere and the shield swings there; drag to aim.
 *   - Keyboard: arrows / A-D rotate the shield manually (accessibility + no mouse).
 *
 * The most recently used device wins, so switching mid-run never fights back.
 */

import { CONFIG } from './config.js';

const TURN_LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const TURN_RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const ACTION_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(canvas, viewport, handlers = {}) {
  const state = {
    mode: 'pointer',
    pointerAngle: -Math.PI / 2,
    hasPointer: false,
    turn: 0,
  };

  const heldKeys = new Set();

  const aimAt = (clientX, clientY) => {
    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left - viewport.centerX;
    const y = clientY - bounds.top - viewport.centerY;
    // Ignore jitter right on the centre point, where the angle is meaningless.
    if (Math.hypot(x, y) < viewport.unit * CONFIG.world.coreRadius * 0.35) return;

    state.pointerAngle = Math.atan2(y, x);
    state.hasPointer = true;
    state.mode = 'pointer';
  };

  const onPointerMove = (event) => aimAt(event.clientX, event.clientY);

  const onPointerDown = (event) => {
    aimAt(event.clientX, event.clientY);
    handlers.onAction?.();
    // Keeps the shield tracking a finger that slides outside the canvas.
    if (event.pointerId !== undefined && canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety; ignore browsers that refuse it.
      }
    }
  };

  const updateTurn = () => {
    const left = [...TURN_LEFT_KEYS].some((code) => heldKeys.has(code));
    const right = [...TURN_RIGHT_KEYS].some((code) => heldKeys.has(code));
    state.turn = (right ? 1 : 0) - (left ? 1 : 0);
  };

  const onKeyDown = (event) => {
    if (event.repeat) return;

    if (TURN_LEFT_KEYS.has(event.code) || TURN_RIGHT_KEYS.has(event.code)) {
      heldKeys.add(event.code);
      state.mode = 'keyboard';
      updateTurn();
      event.preventDefault();
      return;
    }
    if (ACTION_KEYS.has(event.code)) {
      handlers.onAction?.();
      event.preventDefault();
      return;
    }
    if (PAUSE_KEYS.has(event.code)) {
      handlers.onPause?.();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyM') {
      handlers.onMute?.();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyT') {
      handlers.onCycleTheme?.();
      event.preventDefault();
    }
  };

  const onKeyUp = (event) => {
    if (heldKeys.delete(event.code)) updateTurn();
  };

  const onContextMenu = (event) => event.preventDefault();

  const onBlur = () => {
    heldKeys.clear();
    state.turn = 0;
  };

  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const dispose = () => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };

  return { state, dispose };
}
