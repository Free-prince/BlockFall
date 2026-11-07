# BlockFall Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0.2] - 2026-11-07

### Added
- **Stages System**: Replaced mid-game level changes with 10 fixed stages (10, 20, 30, 40, 50, 60, 70, 80, 90, 100 lines per stage)
- **Stage Progress Bar**: Added visual progress bar in HUD showing current stage progress (e.g., "STAGE 3 - 15 / 30 LINES")
- **Stage Complete Screen**: Full-screen modal celebrating stage completion with "CONTINUE" button
- **Android Status Bar Fix**: Implemented `react-native-safe-area-context` for proper safe-area insets on Android, preventing status bar overlap
- **Stage Logic in Engine**: Added `stageGoal()`, `stageFromLines()`, and `stageProgress()` pure functions to `src/engine.ts`

### Changed
- **Level → Stage**: HUD now displays "STAGE" instead of "LEVEL" with fixed progression milestones
- **Gravity Scaling**: Game speed now scales based on stage number instead of level
- **Sound Trigger**: Level-up sound now plays on stage advancement

### Fixed
- **Android Status Bar Overlap**: Game content no longer renders under the Android status bar

## [1.0.0.1] - 2026-11-07

### Added
- **Guest-First Authentication**: Play immediately as Guest with local progress persistence
- **Clerk v2.x Custom Auth**: Email → 6-digit code flow using `prepareFirstFactor`/`attemptFirstFactor` for SignIn, `prepareVerification`/`attemptVerification` for SignUp
- **Supabase Integration**: PostgreSQL database with `scores` table, RLS policies, and Edge Function for score submission
- **Guest Progress Sync**: Automatic sync of local high scores to cloud when Guest creates account (deduplication via `client_game_id`)
- **Home Screen "Save Progress" Card**: Prompts Guests to create account after 3 game overs
- **Profile System**: Local profile (AsyncStorage/SecureStore) with name, best score, sound/music preferences
- **Supabase Edge Function**: Score submission with Upstash Redis leaderboard, Pinecone playstyle vectors, Clerk JWT verification
- **Database Migration**: `client_game_id` column with unique index for deduplication

### Changed
- **Auth Flow**: Simplified to email-only (no username/password requirements)
- **Settings Screen**: Streamlined account section with clear sign-in/out actions

### Fixed
- **Clerk v2.x API Compatibility**: Fixed `prepareVerification`/`attemptVerification` removed from SignInResource
- **"Verified but not Signed In" Bug**: Added status checks and proper `setActive` calls after verification
- **TypeScript Errors**: All strict mode errors resolved

## [1.0.0.0] - 2026-11-06

### Added
- **Core Gameplay**: Tetris engine with 7-bag randomizer, ghost piece, hold, hard/soft drop
- **Sound System**: expo-audio with 10 SFX (move, rotate, drops, clears 1-4, levelup, gameover), background music, haptics
- **Touch Controls**: Swipe board for move/rotate/drop, bottom button pad
- **Home Screen**: Animated background, Play button, icon grid (Daily, Rewards, Leaderboard, Shop, Profile)
- **Game Over Screen**: Final stats, global rank, similar playstyle players
- **Leaderboard**: Global top 10 from Upstash Redis
- **Settings**: Sound/music toggles, haptics, account section
- **AdMob Integration**: Banner ads (test IDs in dev), interstitial on game restart
- **PostHog Analytics**: Event tracking for gameplay, auth, monetization
- **Expo SDK 58 / React Native 0.88 / TypeScript Strict Mode**