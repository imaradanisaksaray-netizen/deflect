/**
 * Menu layout and navigation tests.
 *
 * These exist because menu bugs are the quiet kind. A button drawn where it
 * does not respond, or a row that slides under another one only once enough
 * content is unlocked, survives every code review and shows up months later in
 * someone's hand.
 *
 * Run with:  node --test tests/menu.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PICKUP_TYPES, SHARD_TYPES } from '../game/src/config.js';
import { HELP_LAYOUT } from '../game/src/render/screens.js';
import { createProfile } from '../game/src/progress/profile.js';
import { THEMES } from '../game/src/themes/index.js';
import {
  MENU_TABS,
  backButton,
  formatDuration,
  helpEntries,
  hitTest,
  statRows,
  tabButtons,
  themeButtons,
} from '../game/src/ui/menu.js';

/** Landscape and portrait, plus a phone-shaped extreme. */
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'portrait', width: 720, height: 1280 },
  { name: 'tall phone', width: 390, height: 844 },
  { name: 'wide', width: 1920, height: 810 },
].map((v) => ({ ...v, unit: Math.min(v.width, v.height) }));

const fullProfile = () => ({
  ...createProfile(),
  totalBlocks: 999999,
  totalSeconds: 999999,
});

test('every tab button stays inside the viewport', () => {
  for (const viewport of VIEWPORTS) {
    for (const button of tabButtons(viewport)) {
      assert.ok(button.x >= 0, `${viewport.name}: ${button.id} runs off the left edge`);
      assert.ok(
        button.x + button.w <= viewport.width,
        `${viewport.name}: ${button.id} runs off the right edge`,
      );
      assert.ok(
        button.y + button.h <= viewport.height,
        `${viewport.name}: ${button.id} runs off the bottom`,
      );
    }
  }
});

test('tab buttons never overlap each other', () => {
  for (const viewport of VIEWPORTS) {
    const buttons = tabButtons(viewport);
    for (let i = 1; i < buttons.length; i += 1) {
      assert.ok(
        buttons[i].x >= buttons[i - 1].x + buttons[i - 1].w,
        `${viewport.name}: ${buttons[i].id} overlaps ${buttons[i - 1].id}`,
      );
    }
  }
});

test('tab buttons are large enough to tap', () => {
  // 44px is the usual floor for a touch target; the smallest viewport here is
  // the one that has to clear it.
  const smallest = VIEWPORTS.reduce((a, b) => (a.unit < b.unit ? a : b));

  for (const button of tabButtons(smallest)) {
    assert.ok(button.h >= 40, `${button.id} is only ${button.h.toFixed(0)}px tall`);
    assert.ok(button.w >= 44, `${button.id} is only ${button.w.toFixed(0)}px wide`);
  }
});

test('hit test finds the button under a point and nothing under a gap', () => {
  const viewport = VIEWPORTS[0];
  const buttons = tabButtons(viewport);
  const target = buttons[1];

  const hit = hitTest(buttons, target.x + target.w / 2, target.y + target.h / 2);
  assert.equal(hit?.id, target.id);

  // The gap between two tabs must not belong to either of them.
  const gapX = (buttons[0].x + buttons[0].w + buttons[1].x) / 2;
  assert.equal(hitTest(buttons, gapX, target.y + target.h / 2), null);

  // Well above the strip is the "tap anywhere to play" area.
  assert.equal(hitTest(buttons, viewport.width / 2, viewport.height * 0.5), null);
});

test('the theme grid fits on every viewport', () => {
  const profile = fullProfile();

  for (const viewport of VIEWPORTS) {
    for (const button of themeButtons(viewport, profile)) {
      assert.ok(button.x >= 0 && button.x + button.w <= viewport.width,
        `${viewport.name}: ${button.id} overflows horizontally`);
      assert.ok(button.y >= 0 && button.y + button.h <= viewport.height,
        `${viewport.name}: ${button.id} overflows vertically`);
    }
  }
});

test('the theme grid never covers the back button', () => {
  const profile = fullProfile();

  for (const viewport of VIEWPORTS) {
    const back = backButton(viewport);
    const lowest = themeButtons(viewport, profile)
      .reduce((max, b) => Math.max(max, b.y + b.h), 0);

    assert.ok(
      lowest < back.y,
      `${viewport.name}: the grid reaches ${lowest.toFixed(0)}px, back starts at ${back.y.toFixed(0)}px`,
    );
  }
});

test('theme tiles report lock state and the distance to unlocking', () => {
  const buttons = themeButtons(VIEWPORTS[0], { ...createProfile(), totalBlocks: 600 });

  const unlocked = buttons.filter((b) => b.unlocked);
  assert.ok(unlocked.length >= 2, 'a player 600 blocks in has passed the first threshold');

  for (const button of buttons) {
    if (button.unlocked) {
      assert.equal(button.remaining, 0);
    } else {
      assert.ok(button.remaining > 0, `${button.id} is locked but asks for nothing`);
      assert.equal(button.remaining, button.theme.unlockAt - 600);
    }
  }
});

test('the fully unlocked help screen still ends above the back button', () => {
  // This is the layout that grows over months of play, so it is the one that
  // can overflow long after anybody last looked at it.
  const profile = fullProfile();
  const { threats, rewards } = helpEntries(profile);

  assert.equal(threats.length, Object.keys(SHARD_TYPES).length, 'every threat is listed');
  assert.equal(rewards.length, Object.keys(PICKUP_TYPES).length, 'every reward is listed');

  const { firstSectionY, headerOffset, rowHeight, sectionGap } = HELP_LAYOUT;

  for (const viewport of VIEWPORTS) {
    const { height, unit } = viewport;
    const threatsEnd = height * firstSectionY
      + unit * headerOffset + threats.length * unit * rowHeight;
    const rewardsEnd = threatsEnd + unit * sectionGap
      + unit * headerOffset + rewards.length * unit * rowHeight;

    assert.ok(
      rewardsEnd < backButton(viewport).y,
      `${viewport.name}: help content ends at ${rewardsEnd.toFixed(0)}px, `
      + `back button starts at ${backButton(viewport).y.toFixed(0)}px`,
    );
  }
});

test('the help screen only explains threats the player has met', () => {
  const { threats } = helpEntries(createProfile());

  assert.equal(threats.length, 3, 'a new player sees only the three base types');
  assert.ok(threats.every((t) => t.label && t.hint), 'every row needs a label and a hint');
});

test('stat rows are complete and never blank', () => {
  const rows = statRows({ ...createProfile(), totalBlocks: 1200, totalSeconds: 4000, runs: 9 });

  assert.ok(rows.length >= 6, 'the screen should be worth opening');
  for (const row of rows) {
    assert.ok(row.label.length > 0, 'a stat with no label is noise');
    assert.ok(row.value.length > 0, `${row.label} has no value`);
  }

  const themes = rows.find((r) => r.label === 'THEMES UNLOCKED');
  assert.match(themes.value, new RegExp(`/ ${THEMES.length}$`), 'the total must be shown');
});

test('durations read naturally at every scale', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(48), '48s');
  assert.equal(formatDuration(125), '2m 5s');
  assert.equal(formatDuration(3600), '1h 0m');
  assert.equal(formatDuration(11640), '3h 14m');
});

test('every tab maps to a real screen id', () => {
  // The tab id is used directly as the screen name, so a typo here would be a
  // button that silently does nothing.
  const screens = new Set(['themes', 'stats', 'help']);
  for (const tab of MENU_TABS) {
    assert.ok(screens.has(tab.id), `${tab.id} is not a screen`);
  }
});
