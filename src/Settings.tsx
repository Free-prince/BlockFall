import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform, StatusBar, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser, useAuth } from '@clerk/clerk-expo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSoundEnabled, setSoundEnabled } from './sounds';

type Row = { score: number; lines: number; level: number; clears: number[]; created_at: string };

export default function Settings({ sb, onBack }: { sb: SupabaseClient; onBack: () => void }) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [first, setFirst] = useState(user?.firstName ?? '');
  const [last, setLast] = useState(user?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    sb.from('scores').select('score,lines,level,clears,created_at')
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);

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

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await user.update({ firstName: first.trim(), lastName: last.trim() });
      Alert.alert('Saved', 'Your details were updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.errors?.[0]?.message ?? 'Please try again.');
    }
    setSaving(false);
  };

  const maxRecent = Math.max(1, ...stats.recent.map(x => x.score));

  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <Pressable onPress={onBack} hitSlop={12}><Ionicons name="chevron-back" size={28} color="#fff" /></Pressable>
        <Text style={st.title}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={st.sec}>YOUR DETAILS</Text>
        <Text style={st.lbl}>Email</Text>
        <Text style={st.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
        <Text style={st.lbl}>First name</Text>
        <TextInput style={st.input} value={first} onChangeText={setFirst} placeholder="First name" placeholderTextColor="#64748b" />
        <Text style={st.lbl}>Last name</Text>
        <TextInput style={st.input} value={last} onChangeText={setLast} placeholder="Last name" placeholderTextColor="#64748b" />
        <Pressable style={st.cta} onPress={save} disabled={saving}>
          <Text style={st.ctaT}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>

        <Text style={[st.sec, { marginTop: 32 }]}>SOUND</Text>
        <View style={st.toggleRow}>
          <Text style={st.toggleLabel}>Sound Effects & Music</Text>
          <Switch
            value={isSoundEnabled()}
            onValueChange={setSoundEnabled}
            thumbColor="#fff"
            trackColor={{ false: '#334155', true: '#22d3ee' }}
          />
        </View>

        <Text style={[st.sec, { marginTop: 32 }]}>YOUR PROGRESS</Text>
        {rows === null ? <ActivityIndicator color="#22d3ee" /> : (
          <>
            <View style={st.grid}>
              {[
                ['Games', stats.games], ['Best score', stats.best], ['Avg score', stats.avg],
                ['Total lines', stats.lines], ['Highest level', stats.level], ['Tetrises', stats.tetrises],
              ].map(([k, v]) => (
                <View key={k as string} style={st.card}><Text style={st.cardV}>{v}</Text><Text style={st.cardK}>{k}</Text></View>
              ))}
            </View>
            {!!stats.recent.length && (
              <>
                <Text style={[st.lbl, { marginTop: 20 }]}>Last {stats.recent.length} games</Text>
                <View style={st.bars}>
                  {stats.recent.map((x, i) => (
                    <View key={i} style={[st.bar, { height: 8 + (x.score / maxRecent) * 80 }]} />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <Pressable style={{ marginTop: 40, alignItems: 'center' }} onPress={() => signOut()}>
          <Text style={{ color: '#f87171', fontSize: 16 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
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
});
