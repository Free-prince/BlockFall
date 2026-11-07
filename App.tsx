import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  Platform,
  StatusBar,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import Game from './src/Game';
import Settings from './src/Settings';
import Tutorial from './src/Tutorial';
import HomeScreen from './src/screens/Home';
import LoadingScreen, { loadFonts, loadProfile, checkClerkSession } from './src/screens/Loading';
import AuthScreen from './src/screens/AuthScreen';
import { State } from './src/engine';
import { makeSupabase, submitScore, topScores, SubmitResult } from './src/api';
import { posthogApiKey, posthogOptions } from './src/posthog';
import { createGameLogger } from './src/posthog-logger';
import { initAds, Banner, maybeShowInterstitial } from './src/ads';
import { initializeSound, startMusic, stopMusic, unloadSounds, setSfxEnabled, setMusicEnabled, isSfxEnabled, isMusicEnabled, playClick } from './src/sound';
import { getOrCreateProfile, setSoundEnabled as setProfileSoundEnabled, setMusicEnabled as setProfileMusicEnabled } from './src/profile';
import { APP_VERSION } from './src/version';

type Screen = 'loading' | 'home' | 'play' | 'over' | 'settings' | 'tutorial' | 'leaderboard' | 'profile' | 'auth';

function Root() {
  const { getToken, signOut, isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const ph = usePostHog();
  const gameLogger = createGameLogger(ph);
  const sb = useMemo(() => makeSupabase(() => getToken()), []);
  const [screen, setScreen] = useState<Screen>('loading');
  const [top, setTop] = useState<{ name: string; score: number }[]>([]);
  const [best, setBest] = useState(0);
  const [last, setLast] = useState<State | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [profile, setProfile] = useState<{ name: string; bestScore: number; soundEnabled: boolean; musicEnabled: boolean } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [gameOverCount, setGameOverCount] = useState(0);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  const handleAuthComplete = async () => {
    setShowAuth(false);
    setScreen('home');
    // After sign in, sync guest progress to cloud
    try {
      const { syncGuestProgress } = await import('./src/profile');
      await syncGuestProgress(getToken);
    } catch (e) {
      console.warn('Failed to sync guest progress:', e);
    }
  };

  const handleOpenAuth = () => {
    setShowAuth(true);
  };

  // Load profile and sync sound settings
  useEffect(() => {
    getOrCreateProfile().then(p => {
      setProfile({
        name: p.name,
        bestScore: p.bestScore,
        soundEnabled: p.soundEnabled,
        musicEnabled: p.musicEnabled,
      });
      setSfxEnabled(p.soundEnabled);
      setMusicEnabled(p.musicEnabled);
    });
  }, []);

  const name = user?.username ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress.split('@')[0] ?? profile?.name ?? 'Guest';

  useEffect(() => {
    if (!user) return;

    const email = user.primaryEmailAddress?.emailAddress;
    ph?.identify(user.id, email ? { email } : undefined);
  }, [ph, user?.id]);

  // Fetch leaderboard when on home screen
  useEffect(() => {
    if (screen !== 'home' && screen !== 'leaderboard') return;
    topScores().then(setTop).catch(() => {});
    if (isSignedIn) {
      sb.from('scores').select('score').order('score', { ascending: false }).limit(1)
        .then(({ data }) => setBest(data?.[0]?.score ?? 0));
    } else {
      setBest(profile?.bestScore ?? 0);
    }
  }, [screen, isSignedIn, profile?.bestScore]);

  // Initialize ads once on app start
  useEffect(() => {
    initAds();
  }, []);

  // Initialize sounds once on app start
  useEffect(() => {
    initializeSound();
    return () => { unloadSounds(); };
  }, []);

  // Handle background music based on screen
  useEffect(() => {
    if (screen === 'play') {
      startMusic();
    } else {
      stopMusic();
    }
    return () => { stopMusic(); };
  }, [screen]);

  // Pause game when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        stopMusic();
      } else if (screen === 'play') {
        startMusic();
      }
    });
    return () => sub.remove();
  }, [screen]);

  const onOver = async (s: State) => {
    setLast(s); setResult(null); setScreen('over');
    const seconds = Math.round((Date.now() - s.start) / 1000);
    ph?.capture('game_over', { score: s.score, lines: s.lines, level: s.level, seconds });
    try {
      const submitted = await submitScore(await getToken(), {
        name, score: s.score, lines: s.lines, level: s.level,
        pieces: s.pieces, seconds, clears: s.clears,
      });
      setResult(submitted);
      const hasRank = submitted.rank !== null;
      ph?.capture('score_submitted', { has_rank: hasRank });
      gameLogger.scoreSubmitted(s.score, s.lines, s.level, hasRank);
    } catch (e) {
      ph?.capture('score_submit_failed');
      gameLogger.scoreSubmissionFailed();
    }

    // Track game overs for "Save your progress" prompt (guest only)
    if (!isSignedIn) {
      const newCount = gameOverCount + 1;
      setGameOverCount(newCount);
      if (newCount === 3) {
        setShowSavePrompt(true);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    ph?.capture('user_signed_out');
    ph?.reset();
    // Reload guest profile after sign out
    getOrCreateProfile().then(p => setProfile({
      name: p.name,
      bestScore: p.bestScore,
      soundEnabled: p.soundEnabled,
      musicEnabled: p.musicEnabled,
    }));
  };

  const handlePlayAgain = () => {
    maybeShowInterstitial();
    ph?.capture('game_restart');
    gameLogger.gameStarted();
    setScreen('play');
  };

  const handlePlay = () => {
    ph?.capture('game_start');
    gameLogger.gameStarted();
    setScreen('play');
  };

  const handleSettings = () => setScreen('settings');

  const handleLeaderboard = () => setScreen('leaderboard');

  const handleProfile = () => setScreen('profile');

  const handleComingSoon = (feature: string) => {
    ph?.capture('coming_soon_tapped', { feature });
    // The HomeScreen handles the coming soon sheet internally
  };

  // Loading screen done callback
  const onLoadingDone = () => {
    setScreen('home');
  };

  // Render auth screen
  if (showAuth) {
    return (
      <AuthScreen onComplete={handleAuthComplete} onBack={() => setShowAuth(false)} />
    );
  }

  // Render loading screen
  if (screen === 'loading') {
    return (
      <LoadingScreen
        tasks={[
          loadFonts,
          loadProfile,
          checkClerkSession,
        ]}
        minMs={1500}
        maxMs={3000}
        onDone={onLoadingDone}
      />
    );
  }

  // Render game screen
  if (screen === 'play') {
    return <Game onOver={onOver} onQuit={() => setScreen('home')} onRestart={() => { ph?.capture('game_restart'); gameLogger.gameStarted(); }} />;
  }

  // Header for non-play screens
  const Header = () => (
    <View style={styles.header}>
      {screen === 'home' ? (
        <>
          <View style={{ width: 44 }} />
          <View style={{ width: 44 }} />
        </>
      ) : (
        <>
          <Pressable onPress={() => { playClick(); setScreen('home'); }} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <Pressable onPress={() => { playClick(); handleSignOut(); }} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={24} color="#94a3b8" />
          </Pressable>
        </>
      )}
    </View>
  );

  // Full-screen content for settings/tutorial
  if (screen === 'settings') {
    return (
      <View style={styles.screenWrap}>
        <Header />
        <Settings
          sb={sb}
          onBack={() => setScreen('home')}
          profile={profile}
          appVersion={APP_VERSION}
        />
      </View>
    );
  }
  if (screen === 'tutorial') {
    return (
      <View style={styles.screenWrap}>
        <Header />
        <Tutorial onDone={() => setScreen('home')} />
      </View>
    );
  }

  // Leaderboard screen
  if (screen === 'leaderboard') {
    return (
      <View style={styles.screenWrap}>
        <Header />
        <LeaderboardScreen
          top={top}
          best={best}
          isSignedIn={isSignedIn}
          onBack={() => setScreen('home')}
        />
      </View>
    );
  }

  // Profile screen
  if (screen === 'profile') {
    return (
      <View style={styles.screenWrap}>
        <Header />
        <ProfileScreen
          profile={profile}
          isSignedIn={isSignedIn}
          user={user}
          onBack={() => setScreen('home')}
          onSignIn={handleOpenAuth}
        />
      </View>
    );
  }

  // Centered content for home/game-over
  return (
    <View style={styles.screenWrap}>
      {screen !== 'home' && <Header />}
      <View style={styles.center}>
        {screen === 'home' ? (
          <HomeScreen
            onPlay={handlePlay}
            onSettings={handleSettings}
            onLeaderboard={handleLeaderboard}
            onProfile={handleProfile}
            onComingSoon={handleComingSoon}
            onSaveProgress={handleOpenAuth}
            isSignedIn={!!isSignedIn}
          />
        ) : (
          <>
            {screen === 'over' && last ? (
              <>
                <Text style={styles.title}>GAME OVER</Text>
                <Text style={styles.big}>{last.score}</Text>
                <Text style={styles.sub}>{last.lines} lines · level {last.level}</Text>
                {result?.rank != null && <Text style={styles.sub}>Global rank #{result.rank}</Text>}
                {!!result?.similar.length && (
                  <>
                    <Text style={[styles.sub, { marginTop: 16 }]}>Players with a similar style</Text>
                    {result.similar.map((p, i) => <Text key={i} style={styles.row}>{p.name} · {p.score}</Text>)}
                  </>
                )}
              </>
            ) : null}
            <Pressable style={styles.cta} onPress={() => { playClick(); if (screen === 'over') handlePlayAgain(); else handlePlay(); }}>
              <Text style={styles.ctaT}>{screen === 'over' ? 'Play again' : 'Play'}</Text>
            </Pressable>
            {screen === 'over' && <Pressable onPress={() => { playClick(); setScreen('home'); }}><Text style={styles.link}>Menu</Text></Pressable>}

            {/* Save Progress Prompt (after 3rd game over for guests) */}
            {showSavePrompt && !isSignedIn && (
              <Pressable style={styles.sheetOverlay} onPress={() => setShowSavePrompt(false)}>
                <Pressable style={styles.savePromptSheet} onPress={(e) => e.stopPropagation()}>
                  <Ionicons name="cloud-upload-outline" size={36} color="#22d3ee" />
                  <Text style={styles.savePromptTitle}>Save your progress</Text>
                  <Text style={styles.savePromptDesc}>
                    Create an account to sync your scores across devices and compete on the global leaderboard.
                  </Text>
                  <View style={styles.savePromptButtons}>
                    <Pressable style={styles.savePromptSecondary} onPress={() => { playClick(); setShowSavePrompt(false); }}>
                      <Text style={styles.savePromptSecondaryText}>Not now</Text>
                    </Pressable>
                    <Pressable style={styles.savePromptPrimary} onPress={() => { playClick(); setShowSavePrompt(false); setShowAuth(true); }}>
                      <Text style={styles.savePromptPrimaryText}>Create Account</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Pressable>
            )}

            {/* Banner ad at bottom of game-over screen only (home screen has its own banner in HomeScreen) */}
            {screen === 'over' && <Banner />}
          </>
        )}
      </View>
    </View>
  );
}

// Leaderboard screen component
function LeaderboardScreen({
  top,
  best,
  isSignedIn,
  onBack,
}: { top: { name: string; score: number }[]; best: number; isSignedIn: boolean | undefined; onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.leaderboardContent}>
      <Text style={styles.leaderboardTitle}>LEADERBOARD</Text>
      <Text style={styles.leaderboardSub}>
        {isSignedIn ? 'Global rankings' : 'Sign in to compete globally'}
      </Text>
      <View style={styles.leaderboardList}>
        {top.length > 0 ? (
          top.map((p, i) => (
            <View key={i} style={styles.leaderboardItem}>
              <Text style={styles.leaderboardRank}>{i + 1}</Text>
              <Text style={styles.leaderboardName}>{p.name}</Text>
              <Text style={styles.leaderboardScore}>{p.score}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.leaderboardEmpty}>No scores yet. Be the first!</Text>
        )}
      </View>
      {!isSignedIn && (
        <View style={styles.signInPrompt}>
          <Text style={styles.signInText}>Sign in to save your scores and climb the leaderboard!</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Profile screen component
function ProfileScreen({
  profile,
  isSignedIn,
  user,
  onBack,
  onSignIn,
}: { profile: { name: string; bestScore: number } | null; isSignedIn: boolean | undefined; user: any; onBack: () => void; onSignIn: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.profileContent}>
      <Text style={styles.profileTitle}>PROFILE</Text>
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase() ?? profile?.name?.charAt(0).toUpperCase() ?? 'G'}
          </Text>
        </View>
        <Text style={styles.profileName}>
          {isSignedIn
            ? (user?.username ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'Player')
            : (profile?.name ?? 'Guest')}
        </Text>
        <Text style={styles.profileBest}>Best Score: {profile?.bestScore ?? 0}</Text>
        {!isSignedIn && (
          <Pressable style={styles.signInButton} onPress={() => { playClick(); onSignIn(); }}>
            <Text style={styles.signInButtonText}>Create Account</Text>
          </Pressable>
        )}
      </View>
      {isSignedIn && (
        <View style={styles.profileDetails}>
          <Text style={styles.profileDetailLabel}>Email</Text>
          <Text style={styles.profileDetailValue}>{user?.primaryEmailAddress?.emailAddress}</Text>
          <Text style={styles.profileDetailLabel}>User ID</Text>
          <Text style={styles.profileDetailValue} numberOfLines={1}>{user?.id}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Gate() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <View style={styles.loadingGate} />;
  }

  return <Root />;
}

export default function App() {
  const content = (
    <ClerkLoaded>
      <View style={{ flex: 1, backgroundColor: '#0b0f1a' }}><Gate /></View>
    </ClerkLoaded>
  );

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      {posthogApiKey && posthogOptions ? (
        <PostHogProvider projectToken={posthogApiKey} options={posthogOptions}>
          {content}
        </PostHogProvider>
      ) : content}
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loadingGate: { flex: 1, backgroundColor: '#0b0f1a', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  screenWrap: { flex: 1, backgroundColor: '#0b0f1a' },
  title: { color: '#22d3ee', fontSize: 40, fontWeight: '900', letterSpacing: 4, marginBottom: 12 },
  big: { color: '#fff', fontSize: 56, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 16, marginTop: 4 },
  row: { color: '#e2e8f0', fontSize: 15, marginTop: 4 },
  cta: { backgroundColor: '#22d3ee', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, marginTop: 24 },
  ctaT: { color: '#0b0f1a', fontSize: 18, fontWeight: '800' },
  link: { color: '#94a3b8', marginTop: 16 },
  leaderboardContent: { flex: 1, padding: 24, paddingTop: 16, alignItems: 'center' },
  leaderboardTitle: { color: '#22d3ee', fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  leaderboardSub: { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
  leaderboardList: { width: '100%', maxWidth: 400, gap: 8 },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  leaderboardRank: { color: '#22d3ee', fontSize: 18, fontWeight: '800', width: 36, textAlign: 'center' },
  leaderboardName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  leaderboardScore: { color: '#f59e0b', fontSize: 18, fontWeight: '800', fontFamily: 'monospace' },
  leaderboardEmpty: { color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 40 },
  signInPrompt: { marginTop: 24, padding: 16, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#22d3ee40' },
  signInText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  profileContent: { flex: 1, padding: 24, paddingTop: 16, alignItems: 'center' },
  profileTitle: { color: '#22d3ee', fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 20 },
  profileCard: { width: '100%', maxWidth: 360, backgroundColor: '#1e293b', borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#22d3ee30' },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#22d3ee', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#0b0f1a', fontSize: 32, fontWeight: '900' },
  profileName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileBest: { color: '#f59e0b', fontSize: 16, fontWeight: '700' },
  signInButton: { backgroundColor: '#22d3ee', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginTop: 8 },
  signInButtonText: { color: '#0b0f1a', fontSize: 16, fontWeight: '800' },
  profileDetails: { width: '100%', maxWidth: 360, marginTop: 20, backgroundColor: '#1e293b', borderRadius: 16, padding: 20, gap: 12 },
  profileDetailLabel: { color: '#64748b', fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  profileDetailValue: { color: '#e2e8f0', fontSize: 14, fontFamily: 'monospace' },
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 15, 26, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  savePromptSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  savePromptTitle: {
    color: '#22d3ee',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  savePromptDesc: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  savePromptButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  savePromptSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  savePromptSecondaryText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700',
  },
  savePromptPrimary: {
    flex: 1,
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  savePromptPrimaryText: {
    color: '#0b0f1a',
    fontSize: 16,
    fontWeight: '800',
  },
});