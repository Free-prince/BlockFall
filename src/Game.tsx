import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, PanResponder, Alert, Platform, StatusBar, AppState, LayoutChangeEvent, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, H, W, SHAPES, State, ghostY, hardDrop, init, move, rotate, tick, stageProgress, STAGE_GOALS, stageFromLines } from './engine';
import { playMove, playRotate, playSoftDrop, playHardDrop, playClear, playLevelUp, playGameOver, playClick, isSfxEnabled } from './sound';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Btn({ icon, onPress, repeat, big }: { icon: IconName; onPress: () => void; repeat?: boolean; big?: boolean }) {
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const iv = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => { clearTimeout(delay.current); clearInterval(iv.current); };
  useEffect(() => stop, []);
  return (
    <Pressable
      style={({ pressed }) => [st.btn, big && st.btnBig, pressed && { backgroundColor: '#334155' }]}
      onPressIn={() => {
        playClick();
        onPress();
        if (repeat) delay.current = setTimeout(() => { iv.current = setInterval(onPress, 70); }, 170);
      }}
      onPressOut={stop}>
      <Ionicons name={icon} size={big ? 34 : 30} color="#fff" />
    </Pressable>
  );
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={st.stat}>
    <Text style={st.lbl}>{label}</Text>
    <Text style={st.val}>{value}</Text>
  </View>
);

function StageProgressBar({ lines, stage }: { lines: number; stage: number }) {
  const progress = stageProgress(lines);
  const currentGoal = STAGE_GOALS[stage - 1];
  const prevGoal = stage > 1 ? STAGE_GOALS[stage - 2] : 0;
  const linesInStage = lines - prevGoal;
  const linesNeeded = currentGoal - prevGoal;

  return (
    <View style={st.stageBarContainer}>
      <View style={st.stageBarTrack}>
        <Animated.View
          style={[
            st.stageBarFill,
            { width: `${progress * 100}%` },
          ]}
        />
      </View>
      <View style={st.stageBarLabels}>
        <Text style={st.stageBarLabel}>STAGE {stage}</Text>
        <Text style={st.stageBarLabel}>{linesInStage} / {linesNeeded} LINES</Text>
      </View>
    </View>
  );
}

function StageCompleteScreen({ stage, onContinue }: { stage: number; onContinue: () => void }) {
  return (
    <View style={st.stageCompleteOverlay}>
      <View style={st.stageCompleteCard}>
        <Text style={st.stageCompleteTitle}>STAGE {stage} COMPLETE!</Text>
        <Text style={st.stageCompleteSubtitle}>Next stage: {stage + 1}</Text>
        <Pressable style={st.cta} onPress={onContinue}>
          <Text style={st.ctaT}>CONTINUE</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Game({
  onOver, onQuit, onRestart,
}: { onOver: (s: State) => void; onQuit: () => void; onRestart?: () => void }) {
  const [s, setS] = useState<State>(init);
  const [paused, setPaused] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [showStageComplete, setShowStageComplete] = useState(false);
  const [completedStage, setCompletedStage] = useState(1);

  const insets = useSafeAreaInsets();

  const cell = Math.max(8, Math.floor(Math.min((area.w - 4) / W, (area.h - 4) / H)));
  const cellRef = useRef(cell); cellRef.current = cell;
  const pausedRef = useRef(false); pausedRef.current = paused;

  // Refs to track previous state for sound triggers
  const prevLinesRef = useRef(s.lines);
  const prevLevelRef = useRef(s.level);
  const prevStageRef = useRef(s.stage);
  const prevOverRef = useRef(s.over);

  // Sound triggers - detect line clears, level ups (stage ups), game over
  useEffect(() => {
    if (!isSfxEnabled()) return;
    if (s.lines > prevLinesRef.current) {
      const cleared = s.lines - prevLinesRef.current;
      playClear(cleared);
    }
    if (s.stage > prevStageRef.current) {
      playLevelUp();
    }
    if (s.over && !prevOverRef.current) {
      playGameOver();
    }
    prevLinesRef.current = s.lines;
    prevLevelRef.current = s.level;
    prevStageRef.current = s.stage;
    prevOverRef.current = s.over;
  }, [s.lines, s.stage, s.over]);

  // Detect stage completion to show modal
  useEffect(() => {
    if (s.stageComplete && s.stage > completedStage) {
      setCompletedStage(s.stage);
      setShowStageComplete(true);
    }
  }, [s.stageComplete, s.stage]);

  // gravity
  useEffect(() => {
    if (s.over || paused || showStageComplete) return;
    const id = setInterval(() => {
      setS(prev => {
        if (prev.over || pausedRef.current) return prev;
        return tick(prev);
      });
    }, Math.max(100, 800 - (s.stage - 1) * 70));
    return () => clearInterval(id);
  }, [s.stage, s.over, paused, showStageComplete]);

  useEffect(() => { if (s.over) onOver(s); }, [s.over]);

  // auto-pause when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', a => { if (a !== 'active') setPaused(true); });
    return () => sub.remove();
  }, []);

  // swipe controls on the board: drag = move/soft drop, tap = rotate, fast flick down = hard drop
  const pan = useMemo(() => {
    const a = { x: 0, y: 0, moved: false };
    const TAP_THRESHOLD = 18;
    const HARD_DROP_VY = 1.5;
    const HARD_DROP_DY = 60;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !s.over && !paused && !showStageComplete,
      onMoveShouldSetPanResponder: () => !s.over && !paused && !showStageComplete,
      onPanResponderGrant: () => { a.x = 0; a.y = 0; a.moved = false; },
      onPanResponderMove: (_, g) => {
        if (pausedRef.current || s.over || showStageComplete) return;
        const step = cellRef.current;
        let movedX = false;
        while (g.dx - a.x >= step) { a.x += step; a.moved = true; movedX = true; setS(p => move(p, 1)); }
        while (g.dx - a.x <= -step) { a.x -= step; a.moved = true; movedX = true; setS(p => move(p, -1)); }
        if (movedX && isSfxEnabled()) playMove();
        while (g.dy - a.y >= step) { a.y += step; a.moved = true; setS(p => tick(p, true)); }
      },
      onPanResponderRelease: (_, g) => {
        if (pausedRef.current || s.over || showStageComplete) return;
        if (g.vy > HARD_DROP_VY && g.dy > HARD_DROP_DY) {
          setS(p => hardDrop(p));
          if (isSfxEnabled()) playHardDrop();
        } else if (!a.moved && Math.abs(g.dx) < TAP_THRESHOLD && Math.abs(g.dy) < TAP_THRESHOLD) {
          setS(p => rotate(p));
          if (isSfxEnabled()) playRotate();
        }
      },
      onPanResponderTerminate: () => {},
      onPanResponderTerminationRequest: () => false,
    });
  }, [s.over, paused, showStageComplete]);

  const confirm = (title: string, fn: () => void) =>
    s.score > 0 && !s.over
      ? Alert.alert(title, 'Your current game will be lost.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: fn },
        ])
      : fn();
  const restart = () => confirm('Restart game?', () => { setS(init()); setPaused(false); onRestart?.(); });
  const quit = () => confirm('Quit game?', onQuit);

  // Sound-enabled action wrappers
  const doMove = (dir: -1 | 1) => {
    setS(p => move(p, dir));
    if (isSfxEnabled()) playMove();
  };
  const doRotate = () => {
    setS(p => rotate(p));
    if (isSfxEnabled()) playRotate();
  };
  const doSoftDrop = () => {
    setS(p => tick(p, true));
    if (isSfxEnabled()) playSoftDrop();
  };
  const doHardDrop = () => {
    setS(p => hardDrop(p));
    if (isSfxEnabled()) playHardDrop();
  };

  // draw board + ghost + current piece
  const grid = s.board.map(r => r.map(v => ({ v, ghost: false })));
  const paint = (y0: number, ghost: boolean) =>
    s.cur.m.forEach((row, r) => row.forEach((v, c) => {
      const y = y0 + r, x = s.cur.x + c;
      if (v && y >= 0 && y < H && (!ghost || !grid[y][x].v)) grid[y][x] = { v, ghost };
    }));
  paint(ghostY(s), true);
  paint(s.cur.y, false);

  const onLayout = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const handleStageContinue = () => {
    playClick();
    setShowStageComplete(false);
    setPaused(false);
  };

  return (
    <SafeAreaView style={st.wrap}>
      {/* TOP BAR */}
      <View style={[st.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => { playClick(); quit(); }} hitSlop={10} style={st.iconBtn}><Ionicons name="close" size={24} color="#f87171" /></Pressable>
        <Stat label="SCORE" value={s.score} />
        <Stat label="LINES" value={s.lines} />
        <Stat label="STAGE" value={s.stage} />
        <StageProgressBar lines={s.lines} stage={s.stage} />
        <View style={st.next}>
          <Text style={st.lbl}>NEXT</Text>
          {SHAPES[s.next].filter(r => r.some(Boolean)).map((row, y) => (
            <View key={y} style={{ flexDirection: 'row' }}>
              {row.map((v, x) => <View key={x} style={{ width: 10, height: 10, backgroundColor: v ? COLORS[v] : 'transparent' }} />)}
            </View>
          ))}
        </View>
        <Pressable onPress={() => { playClick(); restart(); }} hitSlop={10} style={st.iconBtn}><Ionicons name="refresh" size={22} color="#fff" /></Pressable>
        <Pressable onPress={() => { playClick(); setPaused(p => !p); }} hitSlop={10} style={st.iconBtn}>
          <Ionicons name={paused ? 'play' : 'pause'} size={22} color="#fff" />
        </Pressable>
      </View>

      {/* BOARD (fills the middle) */}
      <View style={st.boardArea} onLayout={onLayout} {...pan.panHandlers}>
        <View style={[st.board, { width: cell * W + 4, height: cell * H + 4 }]}>
          {grid.map((row, y) => (
            <View key={y} style={{ flexDirection: 'row' }}>
              {row.map((c, x) => (
                <View key={x} style={{
                  width: cell, height: cell, backgroundColor: COLORS[c.v],
                  opacity: c.ghost ? 0.3 : 1, borderWidth: c.v ? 1 : 0, borderColor: '#0006',
                }} />
              ))}
            </View>
          ))}
          {paused && !showStageComplete && (
            <View style={st.overlay}>
              <Text style={st.paused}>PAUSED</Text>
              <Pressable style={st.cta} onPress={() => { playClick(); setPaused(false); }}><Text style={st.ctaT}>Resume</Text></Pressable>
              <Pressable onPress={() => { playClick(); restart(); }}><Text style={st.link}>Restart</Text></Pressable>
              <Pressable onPress={() => { playClick(); quit(); }}><Text style={[st.link, { color: '#f87171' }]}>Quit</Text></Pressable>
            </View>
          )}
        </View>
      </View>

      {/* CONTROLS AT THE BOTTOM */}
      <View style={[st.pad, { paddingBottom: insets.bottom + 22 }]}>
        <Btn icon="caret-back" repeat onPress={doMove.bind(null, -1)} />
        <Btn icon="caret-forward" repeat onPress={doMove.bind(null, 1)} />
        <Btn icon="caret-down" repeat onPress={doSoftDrop} />
        <Btn icon="reload" big onPress={doRotate} />
        <Btn icon="arrow-down-circle" big onPress={doHardDrop} />
      </View>

      {/* Stage Complete Modal */}
      {showStageComplete && (
        <StageCompleteScreen stage={completedStage} onContinue={handleStageContinue} />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0f1a' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6, paddingBottom: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  lbl: { color: '#94a3b8', fontSize: 10, letterSpacing: 1 },
  val: { color: '#fff', fontSize: 18, fontWeight: '800' },
  next: { width: 46, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  board: { backgroundColor: '#10141f', borderWidth: 2, borderColor: '#334155', borderRadius: 6, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#0b0f1ae8', alignItems: 'center', justifyContent: 'center', gap: 14 },
  paused: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  cta: { backgroundColor: '#22d3ee', paddingVertical: 12, paddingHorizontal: 36, borderRadius: 12 },
  ctaT: { color: '#0b0f1a', fontSize: 17, fontWeight: '800' },
  link: { color: '#cbd5e1', fontSize: 16 },
  pad: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 6 },
  btn: { flex: 1, height: 74, borderRadius: 16, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  btnBig: { flex: 1.25, backgroundColor: '#155e75' },
  // Stage progress bar styles
  stageBarContainer: { flex: 1, minWidth: 60, maxWidth: 120, marginHorizontal: 8 },
  stageBarTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden', marginBottom: 2 },
  stageBarFill: { height: '100%', backgroundColor: '#22d3ee', borderRadius: 3 },
  stageBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  stageBarLabel: { color: '#94a3b8', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  // Stage Complete screen styles
  stageCompleteOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 15, 26, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  stageCompleteCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    borderColor: '#22d3ee',
    minWidth: 280,
  },
  stageCompleteTitle: {
    color: '#22d3ee',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  stageCompleteSubtitle: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});