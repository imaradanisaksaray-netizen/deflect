/**
 * Leaderboard tests.
 *
 * The board is the one piece of state a player would genuinely miss if it broke:
 * progress can be re-earned, but a record of runs cannot. So these tests care
 * less about formatting and more about never losing or corrupting an entry.
 *
 * Run with:  node --test tests/leaderboard.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_SIZE,
  addRun,
  createBoard,
  cutoffScore,
  formatAge,
  normalizeBoard,
} from '../game/src/progress/leaderboard.js';
import { rankSubtitle } from '../game/src/render/hud.js';
import { SCORE_LAYOUT } from '../game/src/render/screens.js';
import { backButton } from '../game/src/ui/menu.js';

const run = (score, at = 1000, extra = {}) => ({
  score, seconds: 60, blocks: 20, streak: 5, themeId: 'neon', at, ...extra,
});

/** Fills a board with descending scores, oldest first. */
function fullBoard() {
  let board = createBoard();
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    board = addRun(board, run(1000 - i * 10, 100 + i)).board;
  }
  return board;
}

test('a first run takes first place', () => {
  const { board, rank } = addRun(createBoard(), run(500));

  assert.equal(rank, 1);
  assert.equal(board.length, 1);
  assert.equal(board[0].score, 500);
});

test('entries stay ordered best first', () => {
  let board = createBoard();
  for (const score of [300, 900, 100, 700]) board = addRun(board, run(score)).board;

  assert.deepEqual(board.map((e) => e.score), [900, 700, 300, 100]);
});

test('the rank returned is where the run actually landed', () => {
  let board = createBoard();
  for (const score of [900, 700, 300]) board = addRun(board, run(score)).board;

  const { rank } = addRun(board, run(500));
  assert.equal(rank, 3, '500 sits between 700 and 300');
});

test('the board never grows past its size', () => {
  let board = fullBoard();
  assert.equal(board.length, BOARD_SIZE);

  board = addRun(board, run(99999)).board;
  assert.equal(board.length, BOARD_SIZE, 'adding to a full board must evict, not append');
  assert.equal(board[0].score, 99999);
});

test('a run that misses the cut reports rank 0 and changes nothing', () => {
  const board = fullBoard();
  const { board: after, rank } = addRun(board, run(1));

  assert.equal(rank, 0);
  assert.deepEqual(after.map((e) => e.score), board.map((e) => e.score));
});

test('adding a run never mutates the board it was given', () => {
  const board = fullBoard();
  const snapshot = JSON.stringify(board);

  addRun(board, run(99999));

  assert.equal(JSON.stringify(board), snapshot, 'the input board must be untouched');
});

test('a tie keeps the earlier run ahead', () => {
  // Arcade convention: whoever got there first keeps the better place.
  let board = addRun(createBoard(), run(500, 100)).board;
  const { board: after, rank } = addRun(board, run(500, 200));

  assert.equal(rank, 2);
  assert.equal(after[0].at, 100, 'the older run holds first place');
});

test('a run is stored with everything that made it', () => {
  const { board } = addRun(createBoard(), run(500, 42, {
    seconds: 214, blocks: 88, streak: 19, themeId: 'toxic',
  }));

  assert.deepEqual(board[0], {
    score: 500, seconds: 214, blocks: 88, streak: 19, themeId: 'toxic', at: 42,
  });
});

test('a zero-score run is refused', () => {
  // It carries no information and would push a real run off the bottom.
  const board = fullBoard();
  const { rank, board: after } = addRun(board, run(0));

  assert.equal(rank, 0);
  assert.equal(after.length, BOARD_SIZE);
});

test('corrupt storage degrades to a usable board instead of breaking', () => {
  assert.deepEqual(normalizeBoard(null), []);
  assert.deepEqual(normalizeBoard('nonsense'), []);
  assert.deepEqual(normalizeBoard([null, 42, 'x']), []);

  const repaired = normalizeBoard([
    { score: 100 },                               // missing every other field
    { score: 300, seconds: -5, blocks: NaN },     // impossible values
    { score: 'high' },                            // wrong type
  ]);

  assert.equal(repaired.length, 2, 'salvageable entries survive');
  assert.deepEqual(repaired.map((e) => e.score), [300, 100]);
  assert.equal(repaired[0].seconds, 0, 'a negative duration becomes zero, not NaN');
  assert.equal(repaired[0].themeId, 'neon', 'a missing theme falls back rather than breaking');
});

test('a stored board is re-sorted rather than trusted', () => {
  // Hand-edited or half-written storage must not produce an out-of-order board.
  const repaired = normalizeBoard([run(100), run(900), run(400)]);

  assert.deepEqual(repaired.map((e) => e.score), [900, 400, 100]);
});

test('the cutoff is zero until the board is full', () => {
  let board = createBoard();
  assert.equal(cutoffScore(board), 0, 'any score gets in while there is room');

  for (let i = 0; i < BOARD_SIZE - 1; i += 1) board = addRun(board, run(500 + i)).board;
  assert.equal(cutoffScore(board), 0);

  board = addRun(board, run(499)).board;
  assert.equal(cutoffScore(board), 499, 'once full, the last place sets the bar');
});

test('ages read naturally at every scale', () => {
  const now = 1_000_000_000_000;
  const ago = (ms) => formatAge(now - ms, now);

  assert.equal(ago(5_000), 'JUST NOW');
  assert.equal(ago(90_000), '1M AGO');
  assert.equal(ago(3 * 3600_000), '3H AGO');
  assert.equal(ago(2 * 86400_000), '2D AGO');
  assert.equal(ago(10 * 86400_000), '1W AGO');
  assert.equal(ago(90 * 86400_000), '3MO AGO');
  assert.equal(formatAge(0, now), '', 'an entry with no timestamp says nothing');
});

test('a full board of rows still ends above the back button', () => {
  // Ten rows is a state most players only reach after weeks, so an overflow
  // here would go unnoticed for a long time.
  const viewports = [
    { width: 1280, height: 720 },
    { width: 720, height: 1280 },
    { width: 390, height: 844 },
    { width: 1920, height: 810 },
  ].map((v) => ({ ...v, unit: Math.min(v.width, v.height) }));

  for (const viewport of viewports) {
    const lastRowY = viewport.height * SCORE_LAYOUT.firstRowY
      + (BOARD_SIZE - 1) * viewport.unit * SCORE_LAYOUT.rowHeight;

    assert.ok(
      lastRowY < backButton(viewport).y,
      `${viewport.width}x${viewport.height}: last row at ${lastRowY.toFixed(0)}px, `
      + `back button at ${backButton(viewport).y.toFixed(0)}px`,
    );
  }
});

test('the game over subtitle says the most useful thing available', () => {
  const board = fullBoard();
  const base = { newRecord: false, lastRank: 0, highScore: 5000, board };

  assert.deepEqual(
    rankSubtitle({ ...base, newRecord: true }),
    { text: 'NEW RECORD', celebrate: true },
  );

  assert.deepEqual(
    rankSubtitle({ ...base, lastRank: 3 }),
    { text: `RANK 3 OF ${BOARD_SIZE}`, celebrate: true },
  );

  // Full board, run missed it: name the target rather than the verdict.
  assert.deepEqual(
    rankSubtitle(base),
    { text: `${board[board.length - 1].score} TO REACH THE BOARD`, celebrate: false },
  );

  // Board not yet full: there is no barrier to name, so do not invent one.
  assert.deepEqual(
    rankSubtitle({ ...base, board: board.slice(0, 3) }),
    { text: 'BEST 5000', celebrate: false },
  );

  assert.deepEqual(
    rankSubtitle({ ...base, board: [] }),
    { text: 'BEST 5000', celebrate: false },
  );
});
