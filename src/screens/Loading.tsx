import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Font from 'expo-font';
import { getOrCreateProfile } from '../profile';
import { initializeSound } from '../sound';

/**
 * Blockfall loading screen. The artwork (logo + city silhouettes) is a still image;
 * everything that moves is drawn in code: twinkling stars, falling cubes, and a
 * loading bar where cubes drop in and stack up as the real loading progresses.
 *
 * <Loading tasks={[loadFonts, loadProfile, checkClerkSession, loadSounds]} onDone={() => setReady(true)} />
 */
type Task = () => Promise<unknown>;
type Props = { tasks?: Task[]; minMs?: number; maxMs?: number; onDone: () => void };

const HEIGHTS = [1, 1, 1, 2, 1, 1, 2, 1, 2, 2, 3, 2, 3, 3];
const COLS = HEIGHTS.length;
const CUBES: { col: number; row: number }[] = [];
HEIGHTS.forEach((h, col) => { for (let row = 0; row < h; row++) CUBES.push({ col, row }); });
const TINTS = ['#38bdf8', '#818cf8', '#22d3ee', '#a78bfa'];

function Cube({ size, col, row, tint }: { size: number; col: number; row: number; tint: string }) {
  const y = useRef(new Animated.Value(-80)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(y, { toValue: 0, friction: 6, tension: 130, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: col * size, bottom: row * size, width: size - 2, height: size - 2,
        margin: 1, borderRadius: 3, backgroundColor: tint, borderWidth: 1, borderColor: '#bae6fd',
        opacity: o, transform: [{ translateY: y }],
      }}
    />
  );
}

function Twinkle({ x, y, i }: { x: number; y: number; i: number }) {
  const v = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700 + (i % 5) * 220, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.15, duration: 900 + (i % 4) * 260, useNativeDriver: true }),
    ]));
    const t = setTimeout(() => loop.start(), (i * 170) % 1400);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);
  const s = 3 + (i % 3);
  return (
    <Animated.View
      style={{ position: 'absolute', left: x, top: y, width: s, height: s, backgroundColor: '#c4b5fd', opacity: v, transform: [{ rotate: '45deg' }] }}
    />
  );
}

function Faller({ x, delay, duration, landY }: { x: number; delay: number; duration: number; landY: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: x, top: 0, alignItems: 'center',
        opacity: v.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-70, landY] }) }],
      }}>
      <View style={{ width: 2, height: 46, backgroundColor: '#38bdf8', opacity: 0.35 }} />
      <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: '#38bdf8', borderWidth: 1, borderColor: '#e0f2fe' }} />
    </Animated.View>
  );
}

export async function loadFonts(): Promise<void> {
  try {
    // Dynamically require fonts to avoid build errors if files don't exist yet
    const SpaceMonoRegular = require('../assets/fonts/SpaceMono-Regular.ttf');
    const SpaceMonoBold = require('../assets/fonts/SpaceMono-Bold.ttf');
    await Font.loadAsync({
      'SpaceMono-Regular': SpaceMonoRegular,
      'SpaceMono-Bold': SpaceMonoBold,
    });
  } catch {
    // Fonts not available yet, continue without them
  }
}

export async function loadProfile(): Promise<void> {
  await getOrCreateProfile();
}

export async function checkClerkSession(): Promise<void> {
  // Clerk session check - in Phase 1 we just ensure it doesn't block
  // The actual Clerk initialization happens in App.tsx
  await new Promise(r => setTimeout(r, 100));
}

export async function loadSounds(): Promise<void> {
  await initializeSound();
}

export default function Loading({ tasks = [], minMs = 1500, maxMs = 3000, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const [pct, setPct] = useState(0);

  // real progress = finished tasks; shown progress never runs faster than the minimum time
  useEffect(() => {
    const t0 = Date.now();
    let done = 0;
    tasks.forEach(t => t().catch(() => {}).finally(() => { done++; }));
    let finished = false;
    const id = setInterval(() => {
      const elapsed = Date.now() - t0;
      const time = Math.min(1, elapsed / minMs);
      const real = !tasks.length || elapsed > maxMs ? 1 : done / tasks.length;
      const next = Math.round(Math.min(time, real) * 100);
      setPct(p => Math.max(p, next));
      if (next >= 100 && !finished) { finished = true; clearInterval(id); setTimeout(onDone, 350); }
    }, 60);
    return () => clearInterval(id);
  }, []);

  const barW = width * 0.84;
  const size = (barW - 28) / COLS;
  const barH = size * 3 + 28;
  const barTop = height * 0.655;
  const stars = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      x: (((i * 53 + 7) % 100) / 100) * width,
      y: height * (0.08 + ((i * 29) % 34) / 100),
    })),
    [width, height],
  );

  return (
    <ImageBackground source={require('../../assets/loading-bg.png')} style={st.fill} resizeMode="cover">
      {stars.map((s, i) => <Twinkle key={i} i={i} x={s.x} y={s.y} />)}
      {[0.38, 0.5, 0.62, 0.45].map((r, i) => (
        <Faller key={i} x={width * r} delay={i * 650} duration={1700 + i * 250} landY={barTop - 30} />
      ))}

      <View style={[st.block, { top: barTop - 38 }]}>
        <Text style={st.title}>LOADING{'.'.repeat(1 + (Math.floor(pct / 8) % 3))}</Text>
      </View>
      <View style={[st.frame, { top: barTop, left: (width - barW) / 2, width: barW, height: barH }]}>
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, top: 12 }}>
          {CUBES.map((c, i) =>
            pct >= ((i + 1) / CUBES.length) * 100
              ? <Cube key={i} size={size} col={c.col} row={c.row} tint={TINTS[(c.col + c.row) % TINTS.length]} />
              : null)}
        </View>
      </View>
      <View style={[st.block, { top: barTop + barH + 14 }]}>
        <Text style={st.pct}>LOADING: {pct}%</Text>
      </View>
    </ImageBackground>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0c1325' },
  block: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  title: { color: '#a5f3fc', fontSize: 22, fontWeight: '800', letterSpacing: 2, textShadowColor: '#22d3ee', textShadowRadius: 10 },
  pct: { color: '#cbd5e1', fontSize: 15, fontWeight: '700', letterSpacing: 1.5 },
  frame: {
    position: 'absolute', borderWidth: 2, borderColor: '#22d3ee', borderRadius: 10,
    backgroundColor: 'rgba(34,211,238,0.06)', shadowColor: '#22d3ee', shadowOpacity: 0.9, shadowRadius: 12, elevation: 6,
  },
});