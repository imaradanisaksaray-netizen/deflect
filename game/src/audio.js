/**
 * Fully procedural audio — no asset files, no network requests, no bundle cost.
 *
 * The AudioContext is created lazily and resumed on the first user gesture,
 * which is what browsers (and the Playables container) require.
 */

import { clamp } from './math.js';
import { readMuted, writeMuted } from './storage.js';

let context = null;
let masterGain = null;
let noiseBuffer = null;
let muted = readMuted();

function ensureContext() {
  if (context) return context;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  context = new AudioContextClass();
  masterGain = context.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(context.destination);
  return context;
}

function createNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;

  const length = Math.floor(ctx.sampleRate * 0.4);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Call from a user gesture handler so audio is allowed to start. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  writeMuted(muted);
  if (masterGain && context) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
  }
  return muted;
}

/**
 * Silences the game for the duration of an ad, without touching the player's
 * own mute preference — an ad must never leave the sound toggle in a state the
 * player did not choose.
 *
 * Every portal requires this: two audio sources playing at once is the fastest
 * way to fail a store review.
 */
export function suspendAudio() {
  if (context && context.state === 'running') context.suspend();
}

export function resumeAudio() {
  if (context && context.state === 'suspended') context.resume();
}

/**
 * Plays a single shaped tone.
 * `glideTo` sweeps the frequency across the note, which is what gives the
 * blips their arcade character.
 */
function tone({ freq, glideTo, type = 'square', duration = 0.12, gain = 0.2, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx || muted) return;

  const startTime = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, startTime);
  if (glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, glideTo),
      startTime + duration,
    );
  }

  envelope.gain.setValueAtTime(0.0001, startTime);
  envelope.gain.exponentialRampToValueAtTime(gain, startTime + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function noise({ duration = 0.25, gain = 0.25, frequency = 900, q = 1.2, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx || muted) return;

  const startTime = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, startTime);
  filter.Q.value = q;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, startTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(masterGain);
  source.start(startTime);
  source.stop(startTime + duration + 0.02);
}

/** Pitch climbs with the combo so a long streak audibly builds. */
export function playBlock(comboStep) {
  const step = clamp(comboStep, 0, 12);
  const base = 320 * 1.0595 ** (step * 2);
  tone({ freq: base, glideTo: base * 1.6, type: 'square', duration: 0.09, gain: 0.16 });
}

/**
 * Armoured shell breaking: a short metallic tick, deliberately unlike the block
 * blip so the player hears "not done yet" rather than "destroyed".
 */
export function playShellCrack() {
  tone({ freq: 1400, glideTo: 700, type: 'square', duration: 0.05, gain: 0.12 });
  noise({ duration: 0.12, gain: 0.14, frequency: 2600, q: 2.4 });
}

/** A mimic dropping its disguise — a short downward warning. */
export function playReveal() {
  tone({ freq: 900, glideTo: 220, type: 'sawtooth', duration: 0.18, gain: 0.16 });
}

/**
 * Catching a reward — a rising four-note figure.
 *
 * Everything else in the game falls in pitch or stays flat, so an unmistakable
 * climb tells the player something good happened without them looking away from
 * the shards still on screen.
 */
export function playPickup() {
  const steps = [523, 659, 784, 1047];
  steps.forEach((freq, i) => {
    tone({ freq, type: 'triangle', duration: 0.14, gain: 0.17, delay: i * 0.055 });
  });
}

export function playGold() {
  tone({ freq: 660, type: 'triangle', duration: 0.09, gain: 0.2 });
  tone({ freq: 880, type: 'triangle', duration: 0.12, gain: 0.18, delay: 0.06 });
  tone({ freq: 1320, type: 'triangle', duration: 0.16, gain: 0.14, delay: 0.12 });
}

export function playDamage() {
  tone({ freq: 180, glideTo: 60, type: 'sawtooth', duration: 0.34, gain: 0.24 });
  noise({ duration: 0.3, gain: 0.2, frequency: 420 });
}

export function playVoidPass() {
  noise({ duration: 0.22, gain: 0.1, frequency: 220, q: 0.7 });
}

export function playStart() {
  tone({ freq: 220, glideTo: 660, type: 'square', duration: 0.22, gain: 0.16 });
}

export function playGameOver() {
  tone({ freq: 440, glideTo: 110, type: 'sawtooth', duration: 0.7, gain: 0.22 });
  tone({ freq: 220, glideTo: 55, type: 'square', duration: 0.9, gain: 0.16, delay: 0.08 });
}

export function playNewRecord() {
  [523, 659, 784, 1046].forEach((freq, index) => {
    tone({ freq, type: 'triangle', duration: 0.2, gain: 0.16, delay: index * 0.09 });
  });
}
