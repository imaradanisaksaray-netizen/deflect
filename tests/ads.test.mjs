/**
 * Ad policy and provider tests.
 *
 * Two separate concerns, both worth protecting:
 *
 *   - The **policy** decides how often a player is interrupted. Get it wrong and
 *     the game is unplayable long before anyone notices the revenue.
 *   - The **provider** is the only place a third-party SDK can break the game.
 *     Every test here is a way that SDK can misbehave: throwing, never calling
 *     back, resolving twice, not existing at all.
 *
 * Run with:  node --test tests/ads.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AD_RULES,
  beginRun,
  canOfferRewarded,
  createAdPolicy,
  recordDeath,
  recordInterstitial,
  recordRewarded,
  shouldShowInterstitial,
} from '../game/src/ads/policy.js';
import { AD_UNITS, createAdService, detectProvider } from '../game/src/ads/provider.js';

const T0 = 1_000_000;

/** Kills the player `count` times, showing an ad whenever the policy allows. */
function playDeaths(count, { start = T0, msBetweenDeaths = 30_000 } = {}) {
  let policy = createAdPolicy();
  const shown = [];

  for (let i = 0; i < count; i += 1) {
    const now = start + i * msBetweenDeaths;
    policy = recordDeath(policy);
    if (shouldShowInterstitial(policy, now)) {
      shown.push(policy.deaths);
      policy = recordInterstitial(policy, now);
    }
  }

  return { policy, shown };
}

test('the first runs are never interrupted', () => {
  // A player who meets an ad before they understand the game just leaves.
  const { shown } = playDeaths(AD_RULES.graceDeaths - 1);
  assert.deepEqual(shown, [], 'no ad before the grace period is over');
});

test('an ad appears on the third death, not before', () => {
  const { shown } = playDeaths(3);
  assert.deepEqual(shown, [3]);
});

test('quick successive deaths do not stack ads', () => {
  // Ten deaths in ten seconds hits the death interval repeatedly, but the time
  // floor is what actually protects the player.
  const { shown } = playDeaths(12, { msBetweenDeaths: 1_000 });

  assert.deepEqual(shown, [3], 'only the first one clears the gap');
});

test('the gap is measured in real time, not deaths', () => {
  // Three deaths at this pace span 60s — inside the 90s gap — so the death
  // counter alone would show an ad that the clock has to veto.
  const perDeath = AD_RULES.minGapMs / 4.5;
  const { shown } = playDeaths(9, { msBetweenDeaths: perDeath });

  assert.deepEqual(shown, [3, 9], 'death 6 arrives too soon after death 3');
});

test('a long session shows ads at a sane rate', () => {
  const { shown } = playDeaths(30, { msBetweenDeaths: 45_000 });

  assert.ok(shown.length <= 10, `${shown.length} ads in 30 runs is too many`);
  assert.ok(shown.length >= 4, `${shown.length} ads in 30 runs is unrealistically few`);
});

test('the first ad can run without waiting for a gap', () => {
  let policy = createAdPolicy();
  for (let i = 0; i < AD_RULES.graceDeaths; i += 1) policy = recordDeath(policy);

  assert.equal(policy.lastInterstitialAt, null);
  assert.equal(shouldShowInterstitial(policy, 0), true, 'time 0 must not read as "too soon"');
});

test('the rewarded continue is offered once per run', () => {
  let policy = createAdPolicy();
  const run = { score: 500 };

  assert.equal(canOfferRewarded(policy, run), true);
  policy = recordRewarded(policy);
  assert.equal(canOfferRewarded(policy, run), false, 'a run gets one continue, not two');

  policy = beginRun(policy);
  assert.equal(canOfferRewarded(policy, run), true, 'a new run restores the offer');
});

test('a scoreless run is not offered a continue', () => {
  // There is nothing to save, so the offer would read as the game begging.
  assert.equal(canOfferRewarded(createAdPolicy(), { score: 0 }), false);
});

test('policy updates never mutate the policy they were given', () => {
  const policy = createAdPolicy();
  const snapshot = JSON.stringify(policy);

  recordDeath(policy);
  recordInterstitial(policy, T0);
  recordRewarded(policy);
  beginRun(policy);

  assert.equal(JSON.stringify(policy), snapshot);
});

test('no SDK on the page means no ads, silently', async () => {
  const service = createAdService(detectProvider({}));

  assert.equal(service.id, 'none');
  assert.equal(service.isEnabled, false);
  assert.equal(await service.showInterstitial(), false);
  assert.equal(await service.showRewarded(), false);

  // Lifecycle calls have to be harmless no-ops, not conditionals at every site.
  service.gameplayStart();
  service.gameplayStop();
  service.celebrate();
});

test('a malformed SDK is treated as no SDK', () => {
  assert.equal(detectProvider({ CrazyGames: {} }).id, 'none');
  assert.equal(detectProvider({ CrazyGames: { SDK: { ad: {} } } }).id, 'none');
  assert.equal(detectProvider({ PokiSDK: { commercialBreak: () => {} } }).id, 'none',
    'a half-implemented SDK must not be trusted');
});

test('a real SDK shape is detected', () => {
  const crazy = {
    CrazyGames: { SDK: { ad: { requestAd: () => {} }, game: {} } },
  };
  assert.equal(detectProvider(crazy).id, 'crazygames');

  const poki = {
    PokiSDK: { commercialBreak: () => {}, rewardedBreak: () => {} },
  };
  assert.equal(detectProvider(poki).id, 'poki');
});

test('an SDK that throws cannot break the game', async () => {
  const service = createAdService({
    id: 'exploding',
    showInterstitial: () => { throw new Error('boom'); },
    showRewarded: () => { throw new Error('boom'); },
    gameplayStart: () => { throw new Error('boom'); },
    gameplayStop: () => { throw new Error('boom'); },
    celebrate: () => { throw new Error('boom'); },
  });

  assert.equal(await service.showInterstitial(), false);
  assert.equal(await service.showRewarded(), false, 'a crash must never pay out');
  // These are called from hot paths and must not need try/catch at every site.
  service.gameplayStart();
  service.gameplayStop();
  service.celebrate();
});

test('an SDK that rejects cannot break the game', async () => {
  const service = createAdService({
    id: 'rejecting',
    showInterstitial: () => Promise.reject(new Error('no fill')),
    showRewarded: () => Promise.reject(new Error('no fill')),
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
  });

  assert.equal(await service.showInterstitial(), false);
  assert.equal(await service.showRewarded(), false);
});

test('an SDK that never calls back gives up instead of hanging', async () => {
  // The failure that matters most: an ad blocker eats the request and the
  // callback never fires. Without a timeout the player is stuck forever.
  const service = createAdService({
    id: 'silent',
    showInterstitial: () => new Promise(() => {}),
    showRewarded: () => new Promise(() => {}),
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
  }, 20);

  assert.equal(await service.showInterstitial(), false);
  assert.equal(await service.showRewarded(), false, 'a timeout must never pay out');
});

test('a second request while one is open is refused', async () => {
  // Two ads stacked on top of each other fails portal review.
  let open = 0;
  let maxOpen = 0;

  const service = createAdService({
    id: 'counting',
    showInterstitial: () => {
      open += 1;
      maxOpen = Math.max(maxOpen, open);
      return new Promise((resolve) => setTimeout(() => { open -= 1; resolve(true); }, 20));
    },
    showRewarded: () => Promise.resolve(true),
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
  });

  const [first, second] = await Promise.all([
    service.showInterstitial(),
    service.showInterstitial(),
  ]);

  assert.equal(maxOpen, 1, 'only one ad may be open at a time');
  assert.equal(first, true);
  assert.equal(second, false, 'the overlapping request resolves rather than queueing');
});

test('the service recovers after a failure', async () => {
  let calls = 0;
  const service = createAdService({
    id: 'flaky',
    showInterstitial: () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('first fails')) : Promise.resolve(true);
    },
    showRewarded: () => Promise.resolve(true),
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
  });

  assert.equal(await service.showInterstitial(), false);
  assert.equal(await service.showInterstitial(), true, 'one failure must not disable ads forever');
});

test('a watched rewarded ad reports true', async () => {
  const service = createAdService({
    id: 'working',
    showInterstitial: () => Promise.resolve(true),
    showRewarded: () => Promise.resolve(true),
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
  });

  assert.equal(await service.showRewarded(), true);
});

test('a dismissed rewarded ad reports false', async () => {
  const service = createAdService({
    id: 'dismissed',
    showInterstitial: () => Promise.resolve(true),
    showRewarded: () => Promise.resolve(false),
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
  });

  assert.equal(await service.showRewarded(), false, 'closing an ad early must pay nothing');
});

test('the native shell is detected and takes priority', () => {
  // Inside a Capacitor build AdMob is the only thing that can serve, so it must
  // win even if a portal SDK somehow lingers on the page.
  const admob = {
    prepareInterstitial: () => Promise.resolve(),
    showInterstitial: () => Promise.resolve(),
    prepareRewardVideoAd: () => Promise.resolve(),
    showRewardVideoAd: () => Promise.resolve({ type: 'life', amount: 1 }),
  };

  assert.equal(detectProvider({ Capacitor: { Plugins: { AdMob: admob } } }).id, 'admob');
  assert.equal(
    detectProvider({
      Capacitor: { Plugins: { AdMob: admob } },
      CrazyGames: { SDK: { ad: { requestAd: () => {} } } },
    }).id,
    'admob',
  );
});

test('a half-loaded AdMob plugin is ignored', () => {
  assert.equal(detectProvider({ Capacitor: { Plugins: { AdMob: {} } } }).id, 'none');
  assert.equal(detectProvider({ Capacitor: {} }).id, 'none');
});

test('an AdMob rewarded ad pays out only with a reward item', async () => {
  const make = (reward) => createAdService(detectProvider({
    Capacitor: {
      Plugins: {
        AdMob: {
          prepareInterstitial: () => Promise.resolve(),
          showInterstitial: () => Promise.resolve(),
          prepareRewardVideoAd: () => Promise.resolve(),
          showRewardVideoAd: () => Promise.resolve(reward),
        },
      },
    },
  }));

  assert.equal(await make({ type: 'life', amount: 1 }).showRewarded(), true);
  assert.equal(await make(null).showRewarded(), false, 'closing early pays nothing');
  assert.equal(await make(undefined).showRewarded(), false);
});

test('ad unit ids are present and well formed', () => {
  for (const [slot, id] of Object.entries(AD_UNITS)) {
    assert.match(id, /^ca-app-pub-\d+\/\d+$/, `${slot} is not a valid AdMob unit id`);
  }
});
