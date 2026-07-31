/**
 * Produces a portal-specific copy of the game.
 *
 * Run with:  node tools/build-portal.mjs crazygames
 * Output:    dist/portal-<name>/  (upload this folder's contents unarchived)
 *
 * The only difference from the plain build is one <script> tag: the portal's
 * SDK. The game detects it at runtime and enables ads; without it the exact
 * same code runs ad-free, which is what ships to itch.io and GitHub Pages.
 *
 * Keeping the tag out of game/index.html matters for two reasons. A build with
 * a portal SDK baked in would try to load a third-party script everywhere it is
 * hosted, and each portal forbids shipping another portal's SDK.
 */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE = join(ROOT, 'game');

const PORTALS = {
  crazygames: {
    name: 'CrazyGames',
    // Loaded before the module so the SDK global exists by first detection.
    script: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
    notes: 'Upload the folder contents unarchived, with index.html at the root.',
  },
  poki: {
    name: 'Poki',
    script: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
    notes: 'Poki also requires PokiSDK.init() to resolve before gameplay starts.',
  },
  none: {
    name: 'No portal',
    script: '',
    notes: 'Identical to the plain build. Useful for verifying the ad-free path.',
  },
};

async function build(target) {
  const portal = PORTALS[target];
  if (!portal) {
    console.error(`unknown portal: ${target}`);
    console.error(`known portals: ${Object.keys(PORTALS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const outDir = join(ROOT, 'dist', `portal-${target}`);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(SOURCE, outDir, { recursive: true });

  const indexPath = join(outDir, 'index.html');
  const html = await readFile(indexPath, 'utf8');

  const marker = '<script type="module" src="src/main.js"></script>';
  if (!html.includes(marker)) {
    console.error('index.html no longer contains the module script tag — update this tool.');
    process.exitCode = 1;
    return;
  }

  const injected = portal.script
    ? html.replace(marker, `${portal.script}\n${marker}`)
    : html;

  await writeFile(indexPath, injected);

  console.log(`built ${portal.name} package`);
  console.log(`  output  ${outDir}`);
  console.log(`  sdk     ${portal.script || '(none)'}`);
  console.log(`  note    ${portal.notes}`);
}

build(process.argv[2] ?? 'crazygames').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
