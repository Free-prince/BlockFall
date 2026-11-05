import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClerkProvider, ClerkLoaded, useAuth, useUser, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import Game from './src/Game';
import Settings from './src/Settings';
import Tutorial from './src/Tutorial';
import { State } from './src/engine';
import { makeSupabase, submitScore, topScores, SubmitResult } from './src/api';
import { posthogApiKey, posthogOptions } from './src/posthog';
import { createGameLogger } from './src/posthog-logger';
import { initAds, Banner, maybeShowInterstitial } from './src/ads';
import { loadSounds, playBackgroundMusic, stopBackgroundMusic, unloadSounds } from './src/sounds';

function Auth({ onDevBypass }: { onDevBypass: () => void }) {
  const { signIn, setActive: setSI, isLoaded: a } = useSignIn();
  const { signUp, setActive: setSU, isLoaded: b } = useSignUp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [err, setErr] = useState('');

  const send = async () => {
    if (!a || !b) return;
    setErr('');
    try {
      await signIn!.create({ identifier: email.trim(), strategy: 'email_code' });
      setMode('in');
    } catch {
      try {
        await signUp!.create({ emailAddress: email.trim() });
        await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
        setMode('up');
      } catch (e: any) { setErr(e?.errors?.[0]?.message ?? 'Something went wrong'); return; }
    }
    setStep('code');
  };

  const verify = async () => {
    setErr('');
    try {
      if (mode === 'in') {
        const r = await signIn!.attemptFirstFactor({ strategy: 'email_code', code });
        if (r.status === 'complete') await setSI!({ session: r.createdSessionId });
      } else {
        const r = await signUp!.attemptEmailAddressVerification({ code });
        if (r.status === 'complete') await setSU!({ session: r.createdSessionId });
      }
    } catch (e: any) { setErr(e?.errors?.[0]?.message ?? 'Invalid code'); }
  };

  return (
    <View style={st.center}>
      <Text style={st.title}>TETRIS</Text>
      {step === 'email' ? (
        <>
          <TextInput style={st.input} placeholder="you@email.com" placeholderTextColor="#64748b"
            autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Pressable style={st.cta} onPress={send}><Text style={st.ctaT}>Email me a code</Text></Pressable>
        </>
      ) : (
        <>
          <TextInput style={st.input} placeholder="6-digit code" placeholderTextColor="#64748b"
            keyboardType="number-pad" value={code} onChangeText={setCode} />
          <Pressable style={st.cta} onPress={verify}><Text style={st.ctaT}>Verify</Text></Pressable>
        </>
      )}
      {!!err && <Text style={st.err}>{err}</Text>}
      <Pressable style={[st.cta, { backgroundColor: '#64748b', marginTop: 16 }]} onPress={onDevBypass}>
        <Text style={st.ctaT}>Play as Guest (Dev)</Text>
      </Pressable>
    </View>
  );
}

function Root() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const ph = usePostHog();
  const gameLogger = createGameLogger(ph);
  const sb = useMemo(() => makeSupabase(() => getToken()), []);
  const [screen, setScreen] = useState<'menu' | 'play' | 'over' | 'settings' | 'tutorial'>('menu');
  const [top, setTop] = useState<{ name: string; score: number }[]>([]);
  const [best, setBest] = useState(0);
  const [last, setLast] = useState<State | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const name = user?.username ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress.split('@')[0] ?? 'player';

  useEffect(() => {
    if (!user) return;

    const email = user.primaryEmailAddress?.emailAddress;
    ph?.identify(user.id, email ? { email } : undefined);
  }, [ph, user?.id]);

  useEffect(() => {
    if (screen !== 'menu') return;
    topScores().then(setTop).catch(() => {});
    sb.from('scores').select('score').order('score', { ascending: false }).limit(1)
      .then(({ data }) => setBest(data?.[0]?.score ?? 0));
  }, [screen]);

  // Initialize ads once on app start
  useEffect(() => {
    initAds();
  }, []);

  // Initialize sounds once on app start
  useEffect(() => {
    loadSounds();
    return () => unloadSounds();
  }, []);

  // Handle background music based on screen
  useEffect(() => {
    if (screen === 'play') {
      playBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
    return () => stopBackgroundMusic();
  }, [screen]);

  // Pause game when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        stopBackgroundMusic();
      } else if (screen === 'play') {
        playBackgroundMusic();
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
  };

  const handleSignOut = async () => {
    await signOut();
    ph?.capture('user_signed_out');
    ph?.reset();
  };

  const handlePlayAgain = () => {
    maybeShowInterstitial();
    ph?.capture('game_restart');
    gameLogger.gameStarted();
    setScreen('play');
  };

  if (screen === 'play') return <Game onOver={onOver} onQuit={() => setScreen('menu')} onRestart={() => { ph?.capture('game_restart'); gameLogger.gameStarted(); }} />;

  // Header at absolute top (only on non-play screens)
  const Header = () => (
    <View style={st.header}>
      {screen === 'menu' && (
        <View style={st.headerLeft}>
          <Pressable onPress={() => setScreen('settings')} hitSlop={12} style={st.iconBtn}>
            <Ionicons name="settings-outline" size={28} color="#22d3ee" />
          </Pressable>
          <Pressable onPress={() => setScreen('tutorial')} hitSlop={12} style={st.iconBtn}>
            <Ionicons name="help-circle-outline" size={26} color="#94a3b8" />
          </Pressable>
        </View>
      )}
      {screen !== 'play' && (
        <Pressable onPress={handleSignOut} hitSlop={12} style={st.iconBtn}>
          <Ionicons name="log-out-outline" size={24} color="#94a3b8" />
        </Pressable>
      )}
    </View>
  );

  // Full-screen content for settings/tutorial
  if (screen === 'settings') {
    return (
      <View style={st.screenWrap}>
        <Header />
        <Settings sb={sb} onBack={() => setScreen('menu')} />
      </View>
    );
  }
  if (screen === 'tutorial') {
    return (
      <View style={st.screenWrap}>
        <Header />
        <Tutorial onDone={() => setScreen('menu')} />
      </View>
    );
  }

  // Centered content for menu/game-over
  return (
    <View style={st.screenWrap}>
      <Header />
      <View style={st.center}>
        {screen === 'over' && last ? (
          <>
            <Text style={st.title}>GAME OVER</Text>
            <Text style={st.big}>{last.score}</Text>
            <Text style={st.sub}>{last.lines} lines · level {last.level}</Text>
            {result?.rank != null && <Text style={st.sub}>Global rank #{result.rank}</Text>}
            {!!result?.similar.length && (
              <>
                <Text style={[st.sub, { marginTop: 16 }]}>Players with a similar style</Text>
                {result.similar.map((p, i) => <Text key={i} style={st.row}>{p.name} · {p.score}</Text>)}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={st.title}>TETRIS</Text>
            <Text style={st.sub}>Hi {name} · your best {best}</Text>
            <Text style={[st.sub, { marginTop: 20 }]}>Leaderboard</Text>
            {top.map((p, i) => <Text key={i} style={st.row}>{i + 1}. {p.name} — {p.score}</Text>)}
          </>
        )}
        <Pressable style={st.cta} onPress={screen === 'over' ? handlePlayAgain : () => { ph?.capture('game_start'); gameLogger.gameStarted(); setScreen('play'); }}>
          <Text style={st.ctaT}>{screen === 'over' ? 'Play again' : 'Play'}</Text>
        </Pressable>
        {screen === 'over' && <Pressable onPress={() => setScreen('menu')}><Text style={st.link}>Menu</Text></Pressable>}

        {/* Banner ad at bottom of menu and game-over screens only */}
        {(screen === 'menu' || screen === 'over') && <Banner />}
      </View>
    </View>
  );
}

function Gate() {
  const { isSignedIn } = useAuth();
  const [devBypass, setDevBypass] = useState(false);

  if (devBypass) return <Root />;
  if (isSignedIn) return <Root />;

  return (
    <Auth onDevBypass={() => setDevBypass(true)} />
  );
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

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerLeft: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  screenWrap: { flex: 1, backgroundColor: '#0b0f1a' },
  title: { color: '#22d3ee', fontSize: 40, fontWeight: '900', letterSpacing: 4, marginBottom: 12 },
  big: { color: '#fff', fontSize: 56, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 16, marginTop: 4 },
  row: { color: '#e2e8f0', fontSize: 15, marginTop: 4 },
  input: { width: '100%', backgroundColor: '#1e293b', color: '#fff', padding: 14, borderRadius: 12, fontSize: 16, marginTop: 12 },
  cta: { backgroundColor: '#22d3ee', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, marginTop: 24 },
  ctaT: { color: '#0b0f1a', fontSize: 18, fontWeight: '800' },
  link: { color: '#94a3b8', marginTop: 16 },
  err: { color: '#f87171', marginTop: 12 },
});
