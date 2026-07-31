# DEFLECT on Android

The Android app is the same web build in a Capacitor shell. There is no second
codebase: `game/` is copied into the APK verbatim, and every platform difference
lives in `game/src/native.js`, which is a set of no-ops on the web.

---

## What is already done

- Capacitor project generated in `android/`, app id `com.acube.deflect`
- Icons, adaptive icons and splash screens generated for every density
- AdMob plugin wired through the existing ad layer — no new ad code paths
- Hardware back button goes up one level instead of closing the app
- App lifecycle pauses a run when the phone is backgrounded
- Display cutout handled: the game paints under the notch instead of leaving a
  black band
- A debug APK builds and runs

## What you have to do before release

These need your accounts and cannot be done from the repo.

### 1. Replace the AdMob test ids

Three places, all currently holding Google's public test ids:

| What | Where |
|---|---|
| App id | `android/app/src/main/AndroidManifest.xml` → `com.google.android.gms.ads.APPLICATION_ID` |
| Interstitial unit | `game/src/ads/provider.js` → `AD_UNITS.interstitial` |
| Rewarded unit | `game/src/ads/provider.js` → `AD_UNITS.rewarded` |

Get them from [AdMob console](https://apps.admob.com) → Apps → Ad units.

**Both directions of this are a real problem.** Shipping test ids means the app
serves ads that earn nothing. Serving *real* ads while developing is a policy
violation that gets AdMob accounts suspended — so keep the test ids until the
release build, and never run a debug build against live units.

### 2. Create a signing key

```bash
keytool -genkey -v -keystore deflect-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias deflect
```

Keep the `.jks` file and its passwords somewhere you will still have them in
five years. **If you lose this key you cannot update the app** — Play will not
accept a build signed with a different one, and the listing has to be
re-published from zero under a new package name.

Then create `android/keystore.properties` (already git-ignored):

```properties
storeFile=../deflect-release.jks
storePassword=...
keyAlias=deflect
keyPassword=...
```

### 3. Build the release bundle

```bash
npm run android:sync
cd android && gradlew.bat bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` — this is
what Play accepts. APKs are for local testing only.

### 4. Play Console setup

- Create the app, package name `com.acube.deflect`
- **Data safety form**: the app collects the advertising id (declared in the
  manifest for AdMob). Declare it, or remove the `AD_ID` permission and accept
  untargeted ads with materially lower revenue.
- **Content rating**: fill the questionnaire. The game has no violence, no user
  content and no purchases; it will rate as suitable for everyone.
- **Ads declaration**: yes, the app contains ads.
- **Target audience**: not directed at children — if you declare otherwise,
  AdMob has to be configured for child-directed treatment as well.

Listing text and graphics: `docs/play-listing.md` and `android-assets/`.

---

## Day-to-day commands

```bash
npm run build:icons      # regenerate icon and splash sources
npx @capacitor/assets generate --android
npm run android:sync     # copy game/ into the Android project
npm run android:open     # open in Android Studio
npm run android:build    # debug APK
npm run android:bundle   # release AAB
```

After any change under `game/`, run `android:sync` — the Android project holds a
**copy** of the web assets, not a reference to them. Forgetting this is the most
common way to spend an hour debugging a fix that is already in the source.

---

## Testing on an emulator

```bash
%ANDROID_HOME%\emulator\emulator.exe -avd Pixel_4
%ANDROID_HOME%\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
%ANDROID_HOME%\platform-tools\adb.exe shell am start -n com.acube.deflect/.MainActivity
```

Logs, including anything the game prints:

```bash
%ANDROID_HOME%\platform-tools\adb.exe logcat -s Capacitor:V chromium:V
```

---

## Play Games Services (not set up)

Optional and deliberately left out. It would replace the local leaderboard with
a global one and add achievements, at the cost of requiring sign-in and an OAuth
consent screen.

For a game whose scores are measured in seconds, the local board is the better
default — the rival that matters is yesterday's run, not a stranger with a
score you cannot approach. If you want it later, the work is: enable Play Games
in the Play Console, add the plugin, and mirror `progress/leaderboard.js` calls
to it. The board's shape already matches what Play Games expects.
