# Blockfall: product spec for Claude Code

Read this file fully before changing anything. Reference screenshots are in `design-refs/` (open them by file path).
If you cannot open images, the text below describes each one.
Work ONE PHASE AT A TIME (see "Phases"). After each phase: run `npx tsc --noEmit`, summarise what changed, and STOP so the owner can test on their phone.
The owner is a complete beginner: explain anything they must do by hand (dashboard clicks, commands) in plain, numbered steps.

## 0. Context
- Expo SDK 58 / React Native game. Files: `App.tsx`, `src/engine.ts` (pure game logic), `src/Game.tsx`, `src/Settings.tsx`, `src/ads.tsx`, `src/api.ts`, Supabase edge function `supabase/functions/score`.
- Stack: Clerk (auth), Supabase (DB), Upstash Redis (leaderboard), Pinecone (playstyle vectors), PostHog (analytics), AdMob (ads).
- The game's name is **Blockfall**. Do NOT use the word "Tetris" or its logo anywhere user-facing (app name, store listing, title art, strings). It is a trademark and Google Play removes such apps. Keep the internal slug unchanged; change only the display name.
- `design-refs/` 03, 05, 06, 07, 08 are screenshots of OTHER games used purely as mood and layout inspiration. Do not copy their art, characters, names or exact layouts. Create original look and assets.

## 1. App flow (no login wall)
1. **Native splash**: only the Blockfall logo, centred on a deep purple radial gradient (see `04`). Configure via the `expo-splash-screen` config plugin in app.json (image + backgroundColor). Needs a new native build to show; Expo Go will still show its own.
2. **Loading screen** (React screen, `src/screens/Loading.tsx`): full-screen art from the owner's splash image already in `assets/`, with a progress bar and percentage (see `05`). While it shows, really preload: fonts, sound effects, music, local profile, Clerk session check (never block on network longer than ~3 s). Minimum display ~1.5 s so it does not flash.
3. **Home** (see section 4). The user can press Play immediately. No sign-in required, ever, to play.

## 2. Guest-first data and accounts
- Everyone starts as a **guest**. Store profile locally (AsyncStorage): guest id (uuid), settings, best score, per-game history (last 500), aggregate stats. Show them in Settings/Progress exactly like signed-in users.
- Signing up is optional and offered gently, never at app open: a "Save your progress" card on Home, a non-blocking prompt after the 3rd game over, and a "Create account" button in Settings.
- **On first sign-in, claim guest progress**: upload local games to Supabase (`scores`) and merge. Add a `client_game_id uuid` column with a UNIQUE constraint so retries never duplicate. Validate server-side as the existing function does. Then mark local games as synced. A returning user on a NEW phone signs in and gets their cloud history, best score and stats back.
- Signed-in users: after each game, save locally first, then sync in the background (queue and retry offline).
- Guests are not on the global leaderboard until they have an account (the edge function requires a Clerk token).
- Remove the "Play as Guest (Dev)" button. Guest is now the default path.

## 3. Auth screens and the known bug
- Build custom Blockfall-styled auth screens (dark purple, rounded cards, same palette as Home). The current one (`09`) is too plain. `01`/`02` are Clerk's default web look, for reference only.
- One screen: enter email, receive code, enter code. Works for both new and returning users. Optional "Continue with Google" via Clerk `useSSO`.
- **BUG**: the emailed code is accepted ("verified") but the user is not taken in. Likely cause: the Clerk dashboard still requires Username and Password for sign-up (visible in `01`), so `signUp.status` ends as `missing_requirements`, not `complete`, and `setActive` is never called. Fix in code: after verifying, log `status` and `missingFields`; if `complete` call `setActive`; if `missing_requirements`, show a clear message or collect the missing field. Tell the owner the dashboard change that avoids it: Clerk Dashboard > Configure > User & authentication > turn OFF Username and Password, keep Email address + Email verification code; delete the half-created test user.

## 4. Home screen (see `08`, `04`, `07`)
Bright, playful, never dull. Original art only.
- Top: Blockfall logo/wordmark (see `04`), small player pill top-left (avatar or initial + name or "Guest" + best score), settings gear top-right.
- Centre: animated hero (blocks gently falling and stacking in the background, soft glow, gradient sky/purple). Under it a big, chunky, pressable **Play** button with a press animation.
- Left and right columns of round icon buttons with labels and small red badge dots: **Daily Bonus**, **Rewards**, **Leaderboard**, **Shop**, **Profile**. For now Daily Bonus, Rewards and Shop open a friendly "Coming soon" sheet. Leaderboard and Profile work.
- Bottom: banner ad slot only here, never on the game screen.
- Use `react-native-reanimated` (already in Expo) for animation. Keep 60 fps on a mid-range Android phone.

## 5. Gameplay and levels
Owner complaint: "it enters a level when you are still in the game playing." ASSUMPTION (confirm with owner if unclear): the HUD level number silently changes every 10 lines in the middle of a run. Replace with **Stages**:
- A stage has a goal (e.g. clear N lines, N rising with the stage number) shown as a progress bar in the HUD. The stage number itself never changes mid-run.
- When the goal is reached: pause, show a **Stage Complete** screen (score, bonus, "Next stage" button, optional double-reward ad later). Next stage starts only when the player taps.
- Speed increases per stage, not mid-stage. Keep `engine.ts` pure: add `stageGoal(stage)` and let the UI own stage transitions.
- Keep Restart, Pause, Quit icons and the bottom controls from the current `Game.tsx`.
- Fix the current top bar: it is overlapped by the Android status bar and notifications (`11`). Use `react-native-safe-area-context` insets, and `StatusBar` translucent handling, so the HUD labels (SCORE / LINES / LEVEL / NEXT) are fully visible.

## 6. Sound system (own sounds, no copyrighted files)
- Use `expo-audio` (expo-av is deprecated). Call `setAudioModeAsync({ playsInSilentMode: true })` for iOS.
- Ready-made, synthesised effects are in `assets/sfx/`: `move, rotate, softdrop, lock, harddrop, clear1, clear4, levelup, gameover, click` (.wav, mono, short). Do not replace them with downloaded sounds. They can be regenerated or tweaked with a small script if the owner wants a different feel.
- Mapping: every left/right step plays `move` (also for each swipe step, throttle >= 40 ms); `rotate` on rotate; `softdrop` throttled to ~120 ms while held; `lock` when a piece lands; `harddrop` on hard drop; `clear1` for 1-3 lines; `clear4` for four lines; `levelup` on stage complete; `gameover`; `click` for every UI button.
- Latency: create one player per effect once at startup (during the Loading screen). To replay: `player.seekTo(0); player.play()`. Never create players inside the game loop.
- Music: the owner's background track, loops, volume ~0.35, starts on Home, pauses when the app goes to the background or the game is paused, resumes after.
- Optional vibration: `expo-haptics` light tap on move/rotate, separate toggle.
- A single `src/sound.ts` module exposes `playSfx(name)`, `startMusic()`, `stopMusic()`, `setMusicEnabled`, `setSfxEnabled`.

## 7. Settings (see `10`)
- Sections: Account (guest state or email + Create account / Sign out), Profile (first/last name), Sound (TWO working toggles: Music, Sound effects; optional Vibration; all persisted and applied instantly), Progress (existing stat cards + last 10 games chart), About (version string, see 8, Privacy Policy link, Terms link).
- Remove the stray logout icon at the top-left of the screen. Keep one Sign out button at the bottom (only when signed in).
- Currently the sound toggle does nothing: wire it to `sound.ts`.

## 8. Versioning
- Display version is four parts: `1.0.0.1`, counting up through `1.x.x.x` to `2.0.0.0`. Keep it in ONE place, `src/version.ts`, e.g. `export const APP_VERSION = '1.0.0.1'`. Show it in Settings > About, send it to PostHog as a super property, and add `CHANGELOG.md` (one short entry per version: date, what changed).
- App stores: iOS only allows three numbers, and Android needs an integer `versionCode` that increases on every upload. So in app.json set `version` to the first three parts (`1.0.0`) and let EAS auto-increment the build number (`eas.json` > `cli.appVersionSource: "remote"`, `production.autoIncrement: true`). The fourth part is shown inside the app.
- Set this update as `1.0.0.1`.

## 9. Later phases (DO NOT build now, but design for them)
XP and player level, daily bonus calendar (`07`), free-reward popup using rewarded ads (`06`), spin wheel, daily check-in, coins, shop, leaderboard seasons. Keep local-profile and Supabase shapes extensible (a `profiles` table keyed by Clerk id will hold xp/coins later).

## 10. Rules
- Never put server secrets in the app (Upstash, Pinecone, service role). Only `EXPO_PUBLIC_*` values in the client.
- No ads on the gameplay screen. AdMob IDs come from env vars; test ads in `__DEV__`.
- Small, reviewable commits (`git init` if there is no repo). Do not rewrite files you were not asked to touch.
- Android first. Test targets: a mid-range Android phone.

## Phases
1. **Foundation**: rename to Blockfall, `src/version.ts` + CHANGELOG, native splash (logo only), Loading screen, guest-first local profile, new Home screen. No auth changes yet.
2. **Sound**: `src/sound.ts`, wire all effects and music, working toggles in Settings.
3. **Accounts**: custom auth screens, fix the verified-but-not-signed-in bug, claim-progress on sign-in, cloud restore, Settings account section.
4. **Gameplay**: stages, Stage Complete screen, safe-area/HUD fix.
