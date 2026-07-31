/**
 * Themes.
 *
 * A theme is more than a palette: it also carries an "atmosphere" that changes
 * how the backdrop behaves. Swapping only colours makes every theme feel like
 * the same room repainted; changing the drifting particles, spoke density and
 * ring speed makes it feel like a different place.
 *
 * Readability rules that every palette must respect:
 *   - `shard` (block me) and `void` (do not touch me) must never sit close on
 *     the colour wheel, because that pair decides whether the player lives.
 *   - `void` always reads as danger even when the theme itself is warm.
 *   - `gold` stays distinct from `shard`; shape helps, but colour must too.
 */

/** Particle behaviours a theme can ask the backdrop for. */
export const ATMOSPHERE = {
  none: 'none',
  ember: 'ember', // hot flecks drifting upward
  spore: 'spore', // slow rising motes with a lateral wobble
  snow: 'snow', // fine grains falling
  pull: 'pull', // dust drawn inward toward the core
  flare: 'flare', // bright motes pushed outward
};

export const THEMES = [
  {
    id: 'neon',
    name: 'NEON',
    tagline: 'Where it started',
    unlockAt: 0,
    colors: {
      background: '#07031a',
      backgroundGlow: '#1b0a44',
      horizon: '#ff2d95',
      grid: '#6a2bd9',
      star: '#c9b8ff',
      core: '#00f0ff',
      coreShell: '#7df9ff',
      shield: '#00f0ff',
      shieldEdge: '#ffffff',
      shard: '#22e8ff',
      gold: '#ffd24a',
      void: '#ff1f4b',
      text: '#eae4ff',
      textDim: '#8f81c6',
      pickup: '#4dff88',
      danger: '#ff1f4b',
    },
    backdrop: {
      atmosphere: ATMOSPHERE.none,
      particleColor: '#c9b8ff',
      spokeCount: 18,
      ringSpeed: 1,
      starDensity: 1,
      horizonStrength: 1,
    },
  },

  {
    id: 'ember',
    name: 'EMBER',
    tagline: 'The core runs hot',
    unlockAt: 500,
    colors: {
      background: '#1a0603',
      backgroundGlow: '#4a1205',
      horizon: '#ff6b1a',
      grid: '#a33208',
      star: '#ffd0a8',
      core: '#ffb03a',
      coreShell: '#ffd89a',
      shield: '#ffa726',
      shieldEdge: '#fff3d6',
      // Amber rather than orange: in a warm theme the block-me shard has to
      // pull toward yellow, otherwise it reads the same as the red spike.
      shard: '#ffb347',
      gold: '#fff3a0',
      void: '#ff1744',
      text: '#ffeede',
      textDim: '#c69377',
      pickup: '#3dffa0',
      danger: '#ff1744',
    },
    backdrop: {
      atmosphere: ATMOSPHERE.ember,
      particleColor: '#ff8a3d',
      spokeCount: 14,
      ringSpeed: 0.85,
      starDensity: 0.5,
      horizonStrength: 1.5,
    },
  },

  {
    id: 'toxic',
    name: 'TOXIC',
    tagline: 'Something is leaking',
    unlockAt: 1500,
    colors: {
      background: '#04140a',
      backgroundGlow: '#0d3d1c',
      horizon: '#7fff2a',
      grid: '#2d7a1f',
      star: '#d4ffb0',
      core: '#a8ff3a',
      coreShell: '#d6ff9a',
      shield: '#86f542',
      shieldEdge: '#f2ffd6',
      shard: '#86f542',
      gold: '#fff45c',
      // Magenta reads as alarm against a green field.
      void: '#ff1f6b',
      text: '#eaffde',
      textDim: '#84b877',
      pickup: '#3ce8ff',
      danger: '#ff1f6b',
    },
    backdrop: {
      atmosphere: ATMOSPHERE.spore,
      particleColor: '#9dff4a',
      spokeCount: 22,
      ringSpeed: 1.25,
      starDensity: 0.7,
      horizonStrength: 0.8,
    },
  },

  {
    id: 'ice',
    name: 'ICE',
    tagline: 'Everything slows down',
    unlockAt: 3000,
    colors: {
      background: '#030d1a',
      backgroundGlow: '#0a2847',
      horizon: '#5ad9ff',
      grid: '#1f5c96',
      star: '#e8f8ff',
      core: '#a8e8ff',
      coreShell: '#e0f7ff',
      shield: '#7fd4ff',
      shieldEdge: '#ffffff',
      shard: '#7fd4ff',
      gold: '#ffe9a8',
      void: '#ff4d6d',
      text: '#e8f6ff',
      textDim: '#7c9fbd',
      pickup: '#3dff7a',
      danger: '#ff4d6d',
    },
    backdrop: {
      atmosphere: ATMOSPHERE.snow,
      particleColor: '#dff2ff',
      spokeCount: 12,
      ringSpeed: 0.7,
      starDensity: 1.3,
      horizonStrength: 0.6,
    },
  },

  {
    id: 'void',
    name: 'VOID',
    tagline: 'It pulls at everything',
    unlockAt: 6000,
    colors: {
      background: '#0a0410',
      backgroundGlow: '#2a0f47',
      horizon: '#b45aff',
      grid: '#5f2a99',
      star: '#efdcff',
      core: '#d9a8ff',
      coreShell: '#f0dcff',
      shield: '#c07fff',
      shieldEdge: '#ffffff',
      shard: '#c07fff',
      gold: '#ffd98a',
      void: '#ff3355',
      text: '#f4e9ff',
      textDim: '#9a80b8',
      pickup: '#55ff88',
      danger: '#ff3355',
    },
    backdrop: {
      atmosphere: ATMOSPHERE.pull,
      particleColor: '#c9a0ff',
      spokeCount: 26,
      ringSpeed: 1.4,
      starDensity: 1.6,
      horizonStrength: 0.5,
    },
  },

  {
    id: 'solar',
    name: 'SOLAR',
    tagline: 'Nothing left to unlock',
    unlockAt: 10000,
    colors: {
      background: '#1a1203',
      backgroundGlow: '#4a3608',
      horizon: '#ffc61a',
      grid: '#a37a08',
      star: '#fff4cf',
      core: '#fff0a8',
      coreShell: '#fffbe0',
      shield: '#ffd956',
      shieldEdge: '#ffffff',
      // Deep amber so it separates from the near-white gold.
      shard: '#ffb020',
      gold: '#fffbe0',
      // Pushed toward crimson: an orange-red spike is indistinguishable from an
      // amber shard once both are glowing.
      void: '#ff1030',
      text: '#fff8e4',
      textDim: '#c4a866',
      pickup: '#2dffb0',
      danger: '#ff1030',
    },
    backdrop: {
      atmosphere: ATMOSPHERE.flare,
      particleColor: '#ffd76b',
      spokeCount: 20,
      ringSpeed: 1.15,
      starDensity: 0.4,
      horizonStrength: 1.3,
    },
  },
];

export const DEFAULT_THEME = THEMES[0];

export const getTheme = (id) => THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;

export const isThemeUnlocked = (theme, profile) => profile.totalBlocks >= theme.unlockAt;

export const unlockedThemes = (profile) =>
  THEMES.filter((theme) => isThemeUnlocked(theme, profile));

/** Blocks still needed before `theme` opens up. Zero once unlocked. */
export const blocksUntil = (theme, profile) =>
  Math.max(0, theme.unlockAt - profile.totalBlocks);
