/**
 * Ad provider abstraction.
 *
 * The game never talks to a portal SDK directly. It asks this module for an
 * interstitial or a rewarded ad and gets a promise back; what happens behind
 * that promise — CrazyGames, Poki, or nothing at all — is decided once, here.
 *
 * Two rules hold for every provider:
 *
 *   1. **An ad can never break the game.** Every call resolves. A missing SDK,
 *      a thrown error, an ad blocker, a callback that never fires — all of them
 *      resolve to "no ad shown" rather than leaving the player on a frozen
 *      screen. This is why every request is wrapped in a timeout.
 *   2. **A rewarded ad only pays out if it was actually watched.** Errors,
 *      dismissals and timeouts all resolve to `false`.
 *
 * Detection is passive: a provider claims the session only if its SDK is
 * already on the page. Nothing is injected, so the same build runs unchanged on
 * a portal, on itch.io, and offline.
 */

import { resumeAudio, suspendAudio } from '../audio.js';

/** How long to wait for an SDK before giving up and letting the game continue. */
const AD_TIMEOUT_MS = 12_000;

/**
 * The provider used when no portal SDK is present.
 *
 * Not a stub to be replaced later — it is the correct provider for itch.io,
 * GitHub Pages and local development, and it is what keeps those builds free of
 * portal-specific behaviour.
 */
const noProvider = {
  id: 'none',
  showInterstitial: () => Promise.resolve(false),
  showRewarded: () => Promise.resolve(false),
  gameplayStart: () => {},
  gameplayStop: () => {},
  celebrate: () => {},
};

/** CrazyGames SDK v3. */
function crazyGamesProvider(sdk) {
  const request = (type) => new Promise((resolve) => {
    sdk.ad.requestAd(type, {
      adFinished: () => resolve(true),
      adError: () => resolve(false),
      // Not every build of the SDK reports a dismissal separately.
      adStarted: () => {},
    });
  });

  return {
    id: 'crazygames',
    showInterstitial: () => request('midgame'),
    showRewarded: () => request('rewarded'),
    gameplayStart: () => sdk.game?.gameplayStart?.(),
    gameplayStop: () => sdk.game?.gameplayStop?.(),
    celebrate: () => sdk.game?.happytime?.(),
  };
}

/** Poki SDK. */
function pokiProvider(sdk) {
  return {
    id: 'poki',
    // commercialBreak resolves whether or not an ad ran, which is exactly the
    // contract this layer promises.
    showInterstitial: () => sdk.commercialBreak().then(() => true),
    showRewarded: () => sdk.rewardedBreak().then((watched) => watched === true),
    gameplayStart: () => sdk.gameplayStart?.(),
    gameplayStop: () => sdk.gameplayStop?.(),
    celebrate: () => {},
  };
}

/**
 * Picks a provider from whatever is already on the page.
 *
 * Exported with an explicit `scope` so the choice can be tested without a
 * browser and without global state.
 */
export function detectProvider(scope = globalThis) {
  try {
    const crazy = scope.CrazyGames?.SDK;
    if (crazy?.ad?.requestAd) return crazyGamesProvider(crazy);

    const poki = scope.PokiSDK;
    if (poki?.commercialBreak && poki?.rewardedBreak) return pokiProvider(poki);
  } catch {
    // A malformed SDK is treated exactly like no SDK.
  }

  return noProvider;
}

/**
 * Resolves to `fallback` if the promise has not settled in time.
 *
 * Portal SDKs occasionally never invoke a callback — an ad blocker eats the
 * request, or a network stalls mid-fetch. Without this the game would sit on a
 * paused screen forever, which is worse than any missed impression.
 */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); finish(value); },
      () => { clearTimeout(timer); finish(fallback); },
    );
  });
}

/**
 * Wraps a provider so every call is safe, silent and time-bounded.
 *
 * Audio is suspended for the duration and restored afterwards no matter how the
 * ad ended — two soundtracks playing at once is the fastest way to fail a store
 * review, and a game left permanently silent is the fastest way to lose a player.
 */
export function createAdService(provider = detectProvider(), timeoutMs = AD_TIMEOUT_MS) {
  let busy = false;

  const run = async (call, fallback) => {
    // A second request while one is open would stack two ads on top of each
    // other; portals reject builds that do this.
    if (busy) return fallback;
    busy = true;
    suspendAudio();

    try {
      return await withTimeout(Promise.resolve().then(call), timeoutMs, fallback);
    } catch {
      return fallback;
    } finally {
      busy = false;
      resumeAudio();
    }
  };

  return {
    id: provider.id,
    isEnabled: provider.id !== 'none',
    /** Resolves true when an ad was shown. Never rejects. */
    showInterstitial: () => run(() => provider.showInterstitial(), false),
    /** Resolves true only when the ad was watched to the end. Never rejects. */
    showRewarded: () => run(() => provider.showRewarded(), false),
    /** Portal lifecycle signals. Safe to call on any provider. */
    gameplayStart: () => { try { provider.gameplayStart(); } catch { /* non-fatal */ } },
    gameplayStop: () => { try { provider.gameplayStop(); } catch { /* non-fatal */ } },
    celebrate: () => { try { provider.celebrate(); } catch { /* non-fatal */ } },
  };
}
