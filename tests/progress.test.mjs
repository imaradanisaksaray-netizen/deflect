/**
 * Tests for the v2 progression layer: profile persistence, unlock detection and
 * theme palette safety.
 *
 * Run with:  node --test tests/progress.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// profile.js talks to window.localStorage; stub it before importing.
function createStorageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

globalThis.window = { localStorage: createStorageStub() };

const { createProfile, loadProfile, markUnlocksSeen, recordRun, saveProfile, selectTheme } =
  await import('../game/src/progress/profile.js');
const { collectUnlocks, nextThemeGoal } = await import('../game/src/progress/unlocks.js');
const { THEMES, blocksUntil, getTheme, isThemeUnlocked, unlockedThemes } =
  await import('../game/src/themes/index.js');

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const colorDistance = (a, b) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};

test('a fresh profile starts empty and on the default theme', () => {
  const profile = createProfile();

  assert.equal(profile.totalBlocks, 0);
  assert.equal(profile.runs, 0);
  assert.equal(profile.themeId, 'neon');
  assert.deepEqual(profile.seenUnlocks, []);
});

test('recordRun accumulates without mutating the input', () => {
  const before = createProfile();
  const after = recordRun(before, { blocks: 40, streak: 9, seconds: 88, score: 1200 });

  assert.equal(before.totalBlocks, 0, 'input profile must not change');
  assert.equal(after.totalBlocks, 40);
  assert.equal(after.longestStreak, 9);
  assert.equal(after.totalSeconds, 88);
  assert.equal(after.runs, 1);
  assert.equal(after.bestScore, 1200);
});

test('recordRun keeps the best streak and score, not the latest', () => {
  const first = recordRun(createProfile(), { blocks: 10, streak: 30, seconds: 60, score: 5000 });
  const second = recordRun(first, { blocks: 10, streak: 4, seconds: 20, score: 900 });

  assert.equal(second.longestStreak, 30, 'a worse run must not lower the record');
  assert.equal(second.bestScore, 5000);
  assert.equal(second.totalBlocks, 20, 'cumulative counters still add up');
});

test('a corrupt stored profile falls back to a fresh one', () => {
  window.localStorage.setItem('deflect.profile.v2', '{not valid json');
  const profile = loadProfile();

  assert.equal(profile.totalBlocks, 0);
  assert.equal(profile.themeId, 'neon');
});

test('a partial stored profile is repaired rather than trusted', () => {
  window.localStorage.setItem(
    'deflect.profile.v2',
    JSON.stringify({ totalBlocks: 'lots', seenUnlocks: 'nope', bestScore: -5 }),
  );
  const profile = loadProfile();

  assert.equal(profile.totalBlocks, 0, 'non-numeric counter resets');
  assert.equal(profile.bestScore, 0, 'negative score resets');
  assert.deepEqual(profile.seenUnlocks, [], 'non-array unlock list resets');
  assert.equal(profile.runs, 0);
});

test('a saved profile round-trips', () => {
  const saved = selectTheme(
    recordRun(createProfile(), { blocks: 700, streak: 15, seconds: 300, score: 4000 }),
    'ember',
  );
  saveProfile(saved);

  const loaded = loadProfile();
  assert.equal(loaded.totalBlocks, 700);
  assert.equal(loaded.themeId, 'ember');
  assert.equal(loaded.bestScore, 4000);
});

test('a v1 high score is carried into a new v2 profile', () => {
  window.localStorage.removeItem('deflect.profile.v2');
  window.localStorage.setItem('deflect.highScore.v1', '21616');

  const profile = loadProfile();
  assert.equal(profile.bestScore, 21616, 'returning players keep their record');
  window.localStorage.removeItem('deflect.highScore.v1');
});

test('crossing a threshold reports exactly that unlock', () => {
  const before = { ...createProfile(), totalBlocks: 499 };
  const after = { ...before, totalBlocks: 505 };

  const unlocks = collectUnlocks(before, after);
  assert.equal(unlocks.length, 1);
  assert.equal(unlocks[0].title, 'EMBER');
  assert.equal(unlocks[0].kind, 'theme');
});

test('a run that clears several thresholds reports all of them', () => {
  const before = { ...createProfile(), totalBlocks: 0 };
  const after = { ...before, totalBlocks: 3200 };

  const titles = collectUnlocks(before, after).map((u) => u.title);
  assert.deepEqual(titles, ['EMBER', 'TOXIC', 'ICE']);
});

test('already-unlocked themes are not celebrated again', () => {
  const before = { ...createProfile(), totalBlocks: 900 };
  const after = { ...before, totalBlocks: 1100 };

  assert.deepEqual(collectUnlocks(before, after), [], 'no threshold crossed, no unlock');
});

test('markUnlocksSeen never duplicates ids', () => {
  const once = markUnlocksSeen(createProfile(), ['theme:ember']);
  const twice = markUnlocksSeen(once, ['theme:ember', 'theme:toxic']);

  assert.deepEqual(twice.seenUnlocks.sort(), ['theme:ember', 'theme:toxic']);
});

test('nextThemeGoal points at the nearest locked theme', () => {
  const profile = { ...createProfile(), totalBlocks: 600 };
  const goal = nextThemeGoal(profile);

  assert.equal(goal.theme.id, 'toxic');
  assert.equal(goal.remaining, 900);
});

test('nextThemeGoal returns null once everything is open', () => {
  const profile = { ...createProfile(), totalBlocks: 999999 };
  assert.equal(nextThemeGoal(profile), null);
});

test('theme unlock helpers agree with each other', () => {
  const profile = { ...createProfile(), totalBlocks: 1500 };

  assert.equal(unlockedThemes(profile).length, 3, 'neon, ember, toxic');
  assert.equal(isThemeUnlocked(getTheme('toxic'), profile), true);
  assert.equal(isThemeUnlocked(getTheme('ice'), profile), false);
  assert.equal(blocksUntil(getTheme('ice'), profile), 1500);
  assert.equal(blocksUntil(getTheme('neon'), profile), 0);
});

test('an unknown theme id falls back to the default instead of throwing', () => {
  assert.equal(getTheme('does-not-exist').id, 'neon');
  assert.equal(getTheme(undefined).id, 'neon');
});

test('the first theme is always available', () => {
  assert.equal(THEMES[0].unlockAt, 0);
  assert.equal(unlockedThemes(createProfile()).length, 1);
});

test('every theme defines a complete palette', () => {
  const required = [
    'background', 'backgroundGlow', 'horizon', 'grid', 'star',
    'core', 'coreShell', 'shield', 'shieldEdge',
    'shard', 'gold', 'void', 'text', 'textDim', 'danger',
  ];

  for (const theme of THEMES) {
    for (const key of required) {
      assert.ok(
        /^#[0-9a-f]{6}$/i.test(theme.colors[key] ?? ''),
        `${theme.id}.${key} must be a 6-digit hex colour, got ${theme.colors[key]}`,
      );
    }
  }
});

test('block-me and do-not-touch colours never look alike', () => {
  // This is a gameplay rule, not a style preference: if `shard` and `void` read
  // as the same colour the player dies to something they could not distinguish.
  const MIN_DISTANCE = 120;

  for (const theme of THEMES) {
    const distance = colorDistance(theme.colors.shard, theme.colors.void);
    assert.ok(
      distance >= MIN_DISTANCE,
      `${theme.id}: shard ${theme.colors.shard} and void ${theme.colors.void} are only ${Math.round(distance)} apart`,
    );
  }
});

test('bonus shards stay distinguishable from ordinary ones', () => {
  const MIN_DISTANCE = 60;

  for (const theme of THEMES) {
    const distance = colorDistance(theme.colors.shard, theme.colors.gold);
    assert.ok(
      distance >= MIN_DISTANCE,
      `${theme.id}: shard and gold are only ${Math.round(distance)} apart`,
    );
  }
});

test('theme unlock thresholds increase monotonically', () => {
  for (let i = 1; i < THEMES.length; i += 1) {
    assert.ok(
      THEMES[i].unlockAt > THEMES[i - 1].unlockAt,
      `${THEMES[i].id} must unlock after ${THEMES[i - 1].id}`,
    );
  }
});

test('every theme declares a backdrop character', () => {
  for (const theme of THEMES) {
    assert.ok(theme.backdrop.atmosphere, `${theme.id} is missing an atmosphere`);
    assert.ok(theme.backdrop.spokeCount > 0);
    assert.ok(theme.backdrop.ringSpeed > 0);
    assert.ok(theme.name && theme.tagline, `${theme.id} needs a name and tagline`);
  }
});
