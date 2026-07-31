# Play Store listing

Copy for the Google Play listing. English, matching the game's own language.

Graphics come from `android-assets/` — run `npm run build:icons` to regenerate.

---

## App name (30 characters max)

```
DEFLECT — Neon Reflex Arcade
```

*28 characters.*

## Short description (80 characters max)

```
One shield. Endless light. Block what glows, dodge what doesn't.
```

*63 characters. It states the whole rule set, which is the point — a player who
reads this already knows how to play.*

## Full description (4000 characters max)

```
Your core is under attack from every direction. You have one shield. Move it.

DEFLECT is a reflex game stripped to a single decision, made over and over,
faster and faster: block it, or let it through.

BLOCK THE LIGHT
Cyan shards must be blocked. Gold ones are worth five times as much. Red
spikes must NOT be touched — let them pass through the core, which absorbs
them harmlessly. Colour tells you what to do. Shape tells you how.

IT NEVER STOPS GETTING HARDER
There is no final level and no plateau. After the first few minutes the game
enters OVERDRIVE, where speed climbs without a ceiling. Every run ends. The
only question is how long you last.

SIX THEMES, EARNED
Block enough shards and the whole game repaints itself — new palettes, new
atmospheres, new light. NEON, EMBER, TOXIC, ICE, VOID, SOLAR.

SEVEN THREATS, UNLOCKED BY SURVIVING
Start with three. Keep playing and the game introduces new ones: shards that
split in two when blocked, armoured shards that take two hits, mimics that
disguise themselves until the last moment, and swarms that arrive in a line.

FOUR REWARDS
Rare pickups drift in and are caught the same way you block: a core repair, a
wider shield, a slow field, and a nova that clears the screen.

TEN BEST RUNS
Your board is local — no account, no sign-in, no leaderboard full of scores
you will never approach. The rival is yesterday's run.

BUILT SMALL
No permissions beyond internet. No tracking of what you play. Works offline.
The whole game is under 30 KB of code.

One control. Learnable in three seconds. Not masterable.
```

*~1500 characters.*

---

## Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512×512 | `android-assets/play-icon-512.png` |
| Feature graphic | 1024×500 | `android-assets/play-feature-1024x500.png` |
| Phone screenshots | min 2, 16:9 or 9:16 | capture from a device — see below |

Screenshots worth taking, in this order — the first two are the only ones most
people see:

1. A crowded run with a high multiplier showing
2. The theme picker with several themes unlocked
3. The score board with a full ten entries
4. A run in a non-default theme (EMBER or TOXIC read very differently)
5. The how-to-play screen

Capture them with the emulator or a real device:

```bash
%ANDROID_HOME%\platform-tools\adb.exe exec-out screencap -p > shot.png
```

---

## Categorisation

- **Category**: Games → Arcade
- **Tags**: arcade, reflex, casual, one-touch, endless
- **Content rating**: Everyone. No violence, no user content, no purchases.
- **Contains ads**: Yes
- **In-app purchases**: No
- **Target audience**: 13+ and adults. Not directed at children — declaring
  otherwise obliges child-directed treatment in AdMob as well.

## Data safety form

The app collects the **advertising id**, and nothing else. Everything the game
stores — profile, scores, theme — stays in the browser storage of the device and
is never sent anywhere.

Declare:
- Data collected: Device or other IDs → Advertising ID
- Purpose: Advertising or marketing
- Shared with third parties: Yes (Google AdMob)
- Encrypted in transit: Yes
- Users can request deletion: N/A — nothing is stored on a server

If you would rather collect nothing at all, remove the `AD_ID` permission from
`AndroidManifest.xml`. Ads become untargeted and revenue drops materially, but
the data safety form becomes "no data collected", which is a genuine selling
point for some players.
