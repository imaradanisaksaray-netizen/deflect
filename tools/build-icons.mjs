/**
 * Generates the Android icon and splash source images.
 *
 * Run with:  node tools/build-icons.mjs
 * Output:    android-assets/  (icon.png, icon-foreground.png, icon-background.png,
 *                              splash.png, plus the Play Store graphics)
 *
 * The art is drawn here rather than exported from a design tool so the store
 * icon can never drift from the game: both are the same shield-and-core shape,
 * built from the same theme colours in game/src/themes.
 *
 * PNGs are written by hand on top of node:zlib, for the same reason the ZIP
 * writer is — this project has no dependencies and adding one for six images
 * would be a poor trade.
 */

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'android-assets');

/** NEON theme, kept in sync with game/src/themes/index.js. */
const COLORS = {
  background: [0x07, 0x03, 0x1a],
  backgroundGlow: [0x1b, 0x0a, 0x44],
  core: [0x00, 0xf0, 0xff],
  coreShell: [0x7d, 0xf9, 0xff],
  shield: [0x00, 0xf0, 0xff],
  horizon: [0xff, 0x2d, 0x95],
};

// ---------------------------------------------------------------- PNG writing

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA pixel buffer -> PNG file bytes. */
function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;    // bit depth
  header[9] = 6;    // colour type: RGBA
  header[10] = 0;   // deflate
  header[11] = 0;   // adaptive filtering
  header[12] = 0;   // no interlace

  // One filter byte per scanline; filter 0 (none) keeps this simple and the
  // images compress well anyway because they are mostly smooth gradients.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- Drawing

/** A simple RGBA canvas with the few operations these images need. */
function createCanvas(width, height) {
  const pixels = Buffer.alloc(width * height * 4);

  const blend = (x, y, [r, g, b], alpha) => {
    if (alpha <= 0 || x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    const a = Math.min(1, alpha);
    pixels[i] = Math.round(pixels[i] * (1 - a) + r * a);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + g * a);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + b * a);
    pixels[i + 3] = Math.max(pixels[i + 3], Math.round(255 * a));
  };

  return { width, height, pixels, blend };
}

const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

/** Fills the canvas with the game's radial backdrop. */
function paintBackdrop(canvas, { transparent = false } = {}) {
  const { width, height, blend } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const maxDistance = Math.hypot(cx, cy);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = Math.hypot(x - cx, y - cy) / maxDistance;
      // Glow at the centre falling off to near-black at the corners, the same
      // shape the in-game background has.
      const color = mix(COLORS.backgroundGlow, COLORS.background, Math.min(1, t * 1.35));
      blend(x, y, color, transparent ? 0 : 1);
    }
  }
}

/**
 * Draws an anti-aliased arc band.
 *
 * Coverage is sampled on a 3x3 grid per pixel — enough to look clean at icon
 * sizes without the cost of a real rasteriser.
 */
function paintArc(canvas, { cx, cy, radius, thickness, from, to, color, glow = 0 }) {
  const { width, height, blend } = canvas;
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  const reach = outer + glow;

  const inSweep = (angle) => {
    let a = angle;
    while (a < from) a += Math.PI * 2;
    return a <= to;
  };

  for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(height, Math.ceil(cy + reach)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(width, Math.ceil(cx + reach)); x += 1) {
      let covered = 0;
      let glowHit = 0;

      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const px = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          const d = Math.hypot(px - cx, py - cy);
          if (!inSweep(Math.atan2(py - cy, px - cx))) continue;

          if (d >= inner && d <= outer) covered += 1;
          else if (glow > 0 && d > outer && d <= outer + glow) {
            glowHit += 1 - (d - outer) / glow;
          }
        }
      }

      if (covered > 0) blend(x, y, color, covered / 9);
      else if (glowHit > 0) blend(x, y, color, (glowHit / 9) * 0.4);
    }
  }
}

/** Draws a filled circle with a soft edge and optional outer glow. */
function paintDisc(canvas, { cx, cy, radius, color, glow = 0, glowColor = color }) {
  const { width, height, blend } = canvas;
  const reach = radius + glow;

  for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(height, Math.ceil(cy + reach)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(width, Math.ceil(cx + reach)); x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);

      if (d <= radius - 1) {
        // A bright centre falling to the edge, so the core reads as lit rather
        // than as a flat dot.
        const t = d / radius;
        blend(x, y, mix([255, 255, 255], color, Math.min(1, t * 1.6)), 1);
      } else if (d <= radius) {
        blend(x, y, color, radius - d);
      } else if (glow > 0 && d <= reach) {
        blend(x, y, glowColor, (1 - (d - radius) / glow) * 0.45);
      }
    }
  }
}

/**
 * The game's mark: a lit core inside a broken shield ring, with one heavier arc
 * standing in for the player's shield.
 */
function paintMark(canvas, { scale = 1, transparent = false } = {}) {
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const unit = Math.min(width, height) * scale;

  if (!transparent) paintBackdrop(canvas);

  // The thin segmented ring.
  const segments = [
    [-2.9, -1.9],
    [-1.5, -0.5],
    [-0.1, 0.9],
  ];
  for (const [from, to] of segments) {
    paintArc(canvas, {
      cx, cy, radius: unit * 0.3, thickness: unit * 0.035,
      from, to, color: COLORS.coreShell, glow: unit * 0.02,
    });
  }

  // The player's shield: heavier, and offset so the mark has a direction.
  paintArc(canvas, {
    cx, cy, radius: unit * 0.42, thickness: unit * 0.075,
    from: 1.15, to: 2.55, color: COLORS.shield, glow: unit * 0.05,
  });

  // A single hostile spike, in the danger colour, opposite the shield.
  paintArc(canvas, {
    cx, cy, radius: unit * 0.42, thickness: unit * 0.05,
    from: -1.75, to: -1.45, color: COLORS.horizon, glow: unit * 0.04,
  });

  paintDisc(canvas, {
    cx, cy, radius: unit * 0.17, color: COLORS.core,
    glow: unit * 0.1, glowColor: COLORS.core,
  });
}

// --------------------------------------------------------------------- Output

async function write(name, canvas) {
  const png = encodePng(canvas.width, canvas.height, canvas.pixels);
  await writeFile(join(OUT, name), png);
  return { name, bytes: png.length, size: `${canvas.width}x${canvas.height}` };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];

  // Legacy square icon. Kept inside a safe margin because launchers round the
  // corners, and the hostile spike sits at the outermost radius of the mark.
  const icon = createCanvas(1024, 1024);
  paintMark(icon, { scale: 0.86 });
  written.push(await write('icon.png', icon));

  // Adaptive icon: the mark alone, drawn small enough to survive the circular
  // mask Android applies — the outer 1/3 of an adaptive foreground can be
  // cropped on any given device.
  const foreground = createCanvas(1024, 1024);
  paintMark(foreground, { scale: 0.62, transparent: true });
  written.push(await write('icon-foreground.png', foreground));

  const background = createCanvas(1024, 1024);
  paintBackdrop(background);
  written.push(await write('icon-background.png', background));

  // Splash: a wide canvas so Capacitor can centre-crop it on any aspect ratio.
  const splash = createCanvas(2732, 2732);
  paintMark(splash, { scale: 0.42 });
  written.push(await write('splash.png', splash));

  // Play Store listing graphics.
  const storeIcon = createCanvas(512, 512);
  paintMark(storeIcon, { scale: 0.86 });
  written.push(await write('play-icon-512.png', storeIcon));

  const feature = createCanvas(1024, 500);
  paintMark(feature, { scale: 0.7 });
  written.push(await write('play-feature-1024x500.png', feature));

  console.log(`wrote ${written.length} images to ${OUT}`);
  for (const file of written) {
    console.log(`  ${file.name.padEnd(30)} ${file.size.padStart(10)}  ${(file.bytes / 1024).toFixed(1)} KB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
