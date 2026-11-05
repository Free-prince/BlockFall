# Tetris (Expo + Supabase + Clerk + PostHog + Upstash + Pinecone)

Secrets for Upstash and Pinecone stay server-side in a Supabase Edge Function; the app never sees them.

## 1. Create the app and add files
```bash
npx create-expo-app@latest tetris --template blank-typescript
cd tetris
# copy App.tsx, src/, supabase/, .env.example from this bundle over the new project
npx expo install @clerk/clerk-expo expo-secure-store @supabase/supabase-js react-native-url-polyfill \
  posthog-react-native expo-file-system expo-application expo-device expo-localization
cp .env.example .env   # fill in values
```

## 2. Services
- **Clerk**: create an app, enable *Email* + *Email verification code* sign-in, and don't require username/password. Copy the publishable key. Then Dashboard → Integrations → Supabase (or Supabase → Auth → Third-party → Clerk) so Supabase accepts Clerk tokens. Your JWKS URL is `https://<your-clerk-domain>/.well-known/jwks.json`.
- **Supabase**: run `supabase/schema.sql` in the SQL editor.
- **Pinecone**: create a serverless index, dimension **8**, metric **cosine**. Copy its host URL.
- **Upstash**: create a Redis database, copy the REST URL and token.
- **PostHog**: copy the project API key.

## 3. Deploy the edge function
```bash
npm i -g supabase
supabase login && supabase link --project-ref YOUR_REF
supabase secrets set CLERK_JWKS_URL=... UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
  PINECONE_API_KEY=... PINECONE_INDEX_HOST=https://your-index-xxxx.svc.region.pinecone.io
supabase functions deploy score --no-verify-jwt   # function verifies the Clerk JWT itself
```

## 4. Play on your phone
- Quick: `npx expo start`, scan the QR with Expo Go.
- Installable build: `npm i -g eas-cli && eas login && eas build:configure`, then
  `eas build -p android --profile preview` (APK you can install), or
  `eas build -p ios --profile preview` (needs an Apple developer account).
  Add the five `EXPO_PUBLIC_*` vars with `eas env:create` so they're baked into the build.

## Controls
◀ ▶ move (hold to repeat) · ⟳ rotate · ▼ soft drop · ⤓ hard drop.

## How the services are used
- Clerk: email-code sign-in; its JWT authorizes both Supabase reads (RLS) and the edge function.
- Supabase: `scores` table (every game); your personal best is read with RLS.
- Upstash: global leaderboard (sorted set) + names hash.
- Pinecone: each game becomes an 8-dim playstyle vector; the game-over screen shows similar players.
- PostHog: `game_start`, `game_over`, identified by Clerk user id.
