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

/**
 * Google AdMob via the Capacitor plugin, used by the Android build.
 *
 * Reached through `window.Capacitor.Plugins` rather than an import, which keeps
 * the web build free of a dependency it would never use — the same passive
 * detection every other provider here uses.
 *
 * AdMob needs each ad prepared before it can be shown, and a rewarded ad only
 * counts if the SDK hands back a reward item. Both are folded into the same
 * promise contract as the portals so the game cannot tell them apart.
 */
function admobProvider(admob, unitIds) {
  const interstitial = async () => {
    await admob.prepareInterstitial({ adId: unitIds.interstitial });
    await admob.showInterstitial();
    return true;
  };

  const rewarded = async () => {
    await admob.prepareRewardVideoAd({ adId: unitIds.rewarded });
    const reward = await admob.showRewardVideoAd();
    // No reward item means the user closed it early.
    return Boolean(reward && (reward.amount ?? 0) >= 0 && reward.type !== undefined);
  };

  return {
    id: 'admob',
    showInterstitial: interstitial,
    showRewarded: rewarded,
    gameplayStart: () => {},
    gameplayStop: () => {},
    celebrate: () => {},
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
export function detectProvider(scope = globalThis, unitIds = AD_UNITS) {
  try {
    // The native shell is checked first: inside a Capacitor build there is no
    // portal SDK to compete with, and AdMob is the only thing that can serve.
    const admob = scope.Capacitor?.Plugins?.AdMob;
    if (admob?.prepareInterstitial && admob?.showRewardVideoAd) {
      return admobProvider(admob, unitIds);
    }

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
 * AdMob ad unit ids.
 *
 * These are Google's public test units. They must be replaced with the real
 * ones before a production release — shipping test units means the app serves
 * ads that earn nothing, and serving *real* ads during development is a policy
 * violation that gets accounts suspended. See docs/android.md.
 */
export const AD_UNITS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

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
