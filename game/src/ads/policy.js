/**
 * When an ad is allowed to run.
 *
 * Kept as pure state and pure functions, separate from any SDK, because this is
 * the part that decides how the game *feels* — and feel is what a bad ad policy
 * destroys. The rules exist to protect three things:
 *
 *   - The first runs. A new player who is shown an ad before they understand
 *     the game simply leaves.
 *   - The retry loop. This is a game of ten-second runs; an ad on every death
 *     would spend more time selling than playing.
 *   - The player's sense of a fair deal. A rewarded ad is offered, never
 *     forced, and only pays out if it was actually watched to the end.
 *
 * Timestamps are passed in rather than read from the clock so the whole policy
 * is testable without waiting.
 */

export const AD_RULES = {
  /** Deaths before the first interstitial can appear at all. */
  graceDeaths: 3,
  /** An interstitial is only considered on every Nth death. */
  everyNthDeath: 3,
  /** Minimum gap between interstitials, in milliseconds. */
  minGapMs: 90_000,
  /** Rewarded continues allowed per run. */
  rewardedPerRun: 1,
};

export function createAdPolicy() {
  return {
    deaths: 0,
    /** When the last interstitial finished. Null means none has ever run. */
    lastInterstitialAt: null,
    /** Rewarded continues used in the current run. */
    rewardedUsed: 0,
  };
}

/** Called at the start of every run. */
export function beginRun(policy) {
  return { ...policy, rewardedUsed: 0 };
}

/** Called on every death, before asking whether to show an ad. */
export function recordDeath(policy) {
  return { ...policy, deaths: policy.deaths + 1 };
}

/**
 * Whether an interstitial should run for the death that just happened.
 *
 * Both conditions have to hold: the death count lands on the interval, and
 * enough real time has passed. The time floor matters more than the count —
 * a player dying quickly in a hard run can reach the third death in under a
 * minute, and back-to-back ads is what makes people close the tab.
 */
export function shouldShowInterstitial(policy, now) {
  if (policy.deaths < AD_RULES.graceDeaths) return false;
  if (policy.deaths % AD_RULES.everyNthDeath !== 0) return false;
  if (policy.lastInterstitialAt === null) return true;

  return now - policy.lastInterstitialAt >= AD_RULES.minGapMs;
}

/** Called after an interstitial finishes, however it finished. */
export function recordInterstitial(policy, now) {
  return { ...policy, lastInterstitialAt: now };
}

/**
 * Whether to offer "watch an ad to keep this run going".
 *
 * Once per run, and only while there is a run worth continuing — offering it on
 * a zero-score death would read as the game begging rather than bargaining.
 */
export function canOfferRewarded(policy, { score }) {
  return policy.rewardedUsed < AD_RULES.rewardedPerRun && score > 0;
}

export function recordRewarded(policy) {
  return { ...policy, rewardedUsed: policy.rewardedUsed + 1 };
}
