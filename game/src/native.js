/**
 * Native shell integration.
 *
 * Everything here is a no-op on the web. The game is one codebase that runs as
 * a web page, a portal embed and an Android app, and the way that stays true is
 * by keeping every platform difference inside this file.
 *
 * Three things the native build needs and the web build does not:
 *
 *   1. **AdMob has to be initialised** before any ad request, unlike portal SDKs
 *      which are ready as soon as the script loads.
 *   2. **The hardware back button** must be handled, or it closes the app from
 *      the middle of a run. Android users expect back to mean "up one level".
 *   3. **App lifecycle** — a phone call or a home press must pause the run
 *      rather than let it play on unseen.
 */

const plugins = () => globalThis.Capacitor?.Plugins;

/** True inside a Capacitor build. */
export const isNative = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());

/**
 * Prepares the native ad SDK.
 *
 * Failure is swallowed on purpose: an uninitialised AdMob simply means the ad
 * service falls back to "no ad shown", which the game already handles. A
 * crashed launch would be a far worse outcome than a missed impression.
 */
export async function initNativeAds() {
  const admob = plugins()?.AdMob;
  if (!admob?.initialize) return false;

  try {
    await admob.initialize({ initializeForTesting: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wires the Android back button and app lifecycle to the game.
 *
 * `onBack` returns true when it consumed the press. When it returns false the
 * player is at the top level and the app should close — swallowing that press
 * would trap them in the app, which is worse than exiting by accident.
 */
export function bindNativeShell({ onBack, onPause }) {
  const app = plugins()?.App;
  if (!app?.addListener) return () => {};

  const listeners = [];

  listeners.push(app.addListener('backButton', () => {
    if (onBack()) return;
    app.exitApp?.();
  }));

  listeners.push(app.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) onPause();
  }));

  return () => {
    for (const listener of listeners) {
      Promise.resolve(listener).then((handle) => handle?.remove?.());
    }
  };
}
