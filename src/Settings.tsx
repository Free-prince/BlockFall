import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform, StatusBar, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser, useAuth } from '@clerk/clerk-expo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSfxEnabled, isMusicEnabled, isVibrationEnabled, setSfxEnabled, setMusicEnabled, setVibrationEnabled, playClick } from './sound';
import { APP_VERSION } from './version';

type Row = { score: number; lines: number; level: number; clears: number[]; created_at: string };

type SettingsProps = {
  sb: SupabaseClient;
  onBack: () => void;
  profile: { name: string; bestScore: number; soundEnabled: boolean; musicEnabled: boolean } | null;
  appVersion: string;
};

export default function Settings({
  sb,
  onBack,
  profile,
  appVersion,
}: SettingsProps) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [musicEnabled, setMusicEnabledState] = useState(true);
  const [vibrationEnabled, setVibrationEnabledState] = useState(true);

  useEffect(() => {
    sb.from('scores').select('score,lines,level,clears,created_at')
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);

  useEffect(() => {
    if (profile) {
      setSoundEnabledState(profile.soundEnabled);
      setMusicEnabledState(profile.musicEnabled);
    }
    // Load from sound system (persisted in SecureStore)
    setSoundEnabledState(isSfxEnabled());
    setMusicEnabledState(isMusicEnabled());
    setVibrationEnabledState(isVibrationEnabled());
  }, [profile]);

  const stats = useMemo(() => {
    const r = rows ?? [];
    return {
      games: r.length,
      best: Math.max(0, ...r.map(x => x.score)),
      avg: r.length ? Math.round(r.reduce((a, x) => a + x.score, 0) / r.length) : 0,
      lines: r.reduce((a, x) => a + x.lines, 0),
      level: Math.max(0, ...r.map(x => x.level)),
      tetrises: r.reduce((a, x) => a + (x.clears?.[3] ?? 0), 0),
      recent: r.slice(0, 10).reverse(),
    };
  }, [rows]);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    setSfxEnabled(enabled);
  };

  const handleMusicToggle = (enabled: boolean) => {
    setMusicEnabledState(enabled);
    setMusicEnabled(enabled);
  };

  const handleVibrationToggle = (enabled: boolean) => {
    setVibrationEnabledState(enabled);
    setVibrationEnabled(enabled);
  };

  const maxRecent = Math.max(1, ...stats.recent.map(x => x.score));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable onPress={() => { playClick(); onBack(); }} hitSlop={12}><Ionicons name="chevron-back" size={28} color="#fff" /></Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Account Section */}
        <Text style={styles.sec}>ACCOUNT</Text>
        {user ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Signed in as</Text>
                <Text style={styles.accountValue}>{user?.primaryEmailAddress?.emailAddress}</Text>
              </View>
            </View>
            <Pressable style={styles.signOutButton} onPress={() => { playClick(); signOut(); }}>
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.guestCard}>
              <Text style={styles.guestTitle}>Playing as Guest</Text>
              <Text style={styles.guestDesc}>Your progress is saved locally on this device. Create an account to sync across devices and compete on the global leaderboard.</Text>
              <Pressable style={styles.guestButton} onPress={() => { playClick(); }}>
                <Text style={styles.guestButtonText}>Create Account</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Sound Section */}
        <Text style={[styles.sec, { marginTop: 32 }]}>SOUND</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Sound Effects</Text>
          <Switch
            value={soundEnabled}
            onValueChange={handleSoundToggle}
            thumbColor="#fff"
            trackColor={{ false: '#334155', true: '#22d3ee' }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Music</Text>
          <Switch
            value={musicEnabled}
            onValueChange={handleMusicToggle}
            thumbColor="#fff"
            trackColor={{ false: '#334155', true: '#22d3ee' }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Vibration</Text>
          <Switch
            value={vibrationEnabled}
            onValueChange={handleVibrationToggle}
            thumbColor="#fff"
            trackColor={{ false: '#334155', true: '#22d3ee' }}
          />
        </View>

        {/* Progress Section */}
        <Text style={[styles.sec, { marginTop: 32 }]}>YOUR PROGRESS</Text>
        {rows === null ? <ActivityIndicator color="#22d3ee" /> : (
          <>
            <View style={styles.grid}>
              {[
                ['Games', stats.games], ['Best score', stats.best], ['Avg score', stats.avg],
                ['Total lines', stats.lines], ['Highest level', stats.level], ['Tetrises', stats.tetrises],
              ].map(([k, v]) => (
                <View key={k as string} style={styles.card}><Text style={styles.cardV}>{v}</Text><Text style={styles.cardK}>{k}</Text></View>
              ))}
            </View>
            {!!stats.recent.length && (
              <>
                <Text style={[styles.lbl, { marginTop: 20 }]}>Last {stats.recent.length} games</Text>
                <View style={styles.bars}>
                  {stats.recent.map((x, i) => (
                    <View key={i} style={[styles.bar, { height: 8 + (x.score / maxRecent) * 80 }]} />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* About Section */}
        <Text style={[styles.sec, { marginTop: 32 }]}>ABOUT</Text>
        <View style={styles.aboutCard}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>{appVersion}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Privacy Policy</Text>
            <Pressable onPress={() => { playClick(); }}>
              <Text style={styles.aboutLink}>View</Text>
            </Pressable>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Terms of Service</Text>
            <Pressable onPress={() => { playClick(); }}>
              <Text style={styles.aboutLink}>View</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f1a', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 6 : 54 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sec: { color: '#22d3ee', fontSize: 12, letterSpacing: 2, fontWeight: '700', marginBottom: 8 },
  lbl: { color: '#94a3b8', fontSize: 13, marginTop: 12, marginBottom: 4 },
  email: { color: '#e2e8f0', fontSize: 16 },
  input: { backgroundColor: '#1e293b', color: '#fff', padding: 14, borderRadius: 12, fontSize: 16 },
  cta: { backgroundColor: '#22d3ee', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 18 },
  ctaT: { color: '#0b0f1a', fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '31%', backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center' },
  cardV: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardK: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 96, marginTop: 6 },
  bar: { flex: 1, backgroundColor: '#22d3ee', borderRadius: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  toggleLabel: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  accountRow: { marginTop: 8 },
  accountInfo: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  accountLabel: { color: '#94a3b8', fontSize: 12, letterSpacing: 1, fontWeight: '700', marginBottom: 4 },
  accountValue: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  signOutButton: { backgroundColor: '#f87171', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  signOutButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  guestCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginTop: 8, borderWidth: 1, borderColor: '#22d3ee30' },
  guestTitle: { color: '#22d3ee', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  guestDesc: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  guestButton: { backgroundColor: '#22d3ee', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  guestButtonText: { color: '#0b0f1a', fontSize: 16, fontWeight: '800' },
  aboutCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginTop: 8 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  aboutLabel: { color: '#94a3b8', fontSize: 15 },
  aboutValue: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  aboutLink: { color: '#22d3ee', fontSize: 15, fontWeight: '600' },
});