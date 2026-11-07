import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Banner } from '../ads';
import { getOrCreateProfile } from '../profile';
import { APP_VERSION } from '../version';
import { startMusic, stopMusic, playClick } from '../sound';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ionicons name type
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type IconButton = {
  id: string;
  icon: IoniconsName;
  label: string;
  color: string;
  onPress: () => void;
  badge?: boolean;
};

const ICON_BUTTONS: IconButton[] = [
  { id: 'daily', icon: 'calendar-outline', label: 'Daily Bonus', color: '#f59e0b', onPress: () => {}, badge: true },
  { id: 'rewards', icon: 'gift-outline', label: 'Rewards', color: '#a855f7', onPress: () => {}, badge: true },
  { id: 'leaderboard', icon: 'trophy-outline', label: 'Leaderboard', color: '#22d3ee', onPress: () => {}, badge: false },
  { id: 'shop', icon: 'bag-handle-outline', label: 'Shop', color: '#22c55e', onPress: () => {}, badge: true },
  { id: 'profile', icon: 'person-outline', label: 'Profile', color: '#f97316', onPress: () => {}, badge: false },
];

export type HomeScreenProps = {
  onPlay: () => void;
  onSettings: () => void;
  onLeaderboard: () => void;
  onProfile: () => void;
  onComingSoon: (title: string) => void;
  onSaveProgress: () => void;
  isSignedIn: boolean;
};

const BLOCK_COLORS = ['#22d3ee', '#818cf8', '#a855f7', '#f59e0b', '#22c55e', '#f97316', '#ef4444'];

function FallingBlock({
  style,
  color,
  delay,
  duration,
  size,
}: { style: any; color: string; delay: number; duration: number; size: number }) {
  const translateY = useRef(new Animated.Value(-size - 50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT + 100,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1,
            duration: duration * 2,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -size - 50,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { translateY },
            { rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          ],
          opacity,
        },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        }}
      />
    </Animated.View>
  );
}

function GlowOrb({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.2, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.35, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.8, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.15, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.glowOrb,
        { left: x - size / 2, top: y - size / 2, width: size, height: size, backgroundColor: color },
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

function PlayButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.92, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={[
        styles.playButton,
        { transform: [{ scale }] },
      ]}
    >
      <Animated.View
        style={[
          styles.playGlow,
          { opacity: glowOpacity },
        ]}
      />
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.playButtonInner,
          pressed && { backgroundColor: '#155e75' },
        ]}
        hitSlop={16}
      >
        <Text style={styles.playText}>PLAY</Text>
      </Pressable>
    </Animated.View>
  );
}

function IconButton({
  icon,
  label,
  color,
  onPress,
  badge,
  pressScale,
}: {
  icon: IoniconsName;
  label: string;
  color: string;
  onPress: () => void;
  badge?: boolean;
  pressScale: Animated.Value;
}) {
  const onPressIn = () => {
    Animated.spring(pressScale, { toValue: 0.88, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressScale, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.iconButton}
        hitSlop={8}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: `${color}20`, borderColor: `${color}60` },
          ]}
        >
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.iconLabel}>{label}</Text>
        {badge && <View style={styles.badge} />}
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen({
  onPlay,
  onSettings,
  onLeaderboard,
  onProfile,
  onComingSoon,
  onSaveProgress,
  isSignedIn,
}: HomeScreenProps) {
  const [profile, setProfile] = useState<{ name: string; bestScore: number } | null>(null);
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);

  // Load profile
  useEffect(() => {
    getOrCreateProfile().then(p => setProfile({ name: p.name, bestScore: p.bestScore }));
  }, []);

  // Start background music on Home screen
  useEffect(() => {
    startMusic();
    return () => {
      stopMusic();
    };
  }, []);

  // Falling blocks animation
  const fallingBlocks = useMemo(() => {
    const blocks = [];
    for (let i = 0; i < 12; i++) {
      blocks.push({
        id: i,
        x: (i % 4) * (SCREEN_WIDTH / 4) + (SCREEN_WIDTH / 8),
        delay: i * 800,
        duration: 8000 + Math.random() * 4000,
        size: 18 + Math.random() * 12,
        color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
      });
    }
    return blocks;
  }, []);

  // Glow orbs
  const glowOrbs = useMemo(() => [
    { x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.25, size: 180, color: '#22d3ee' },
    { x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.35, size: 140, color: '#818cf8' },
    { x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.6, size: 200, color: '#a855f7' },
  ], []);

  // Icon button press scales
  const iconScales = useMemo(
    () => ICON_BUTTONS.map(() => new Animated.Value(1)),
    []
  );

  const handleIconPress = (btn: IconButton) => {
    if (btn.id === 'leaderboard') {
      onLeaderboard();
    } else if (btn.id === 'profile') {
      onProfile();
    } else {
      onComingSoon(btn.label);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <View style={styles.gradientBg} />

      {/* Glow orbs */}
      {glowOrbs.map((orb, i) => (
        <GlowOrb key={i} {...orb} />
      ))}

      {/* Falling blocks */}
      {fallingBlocks.map((block) => (
        <FallingBlock
          key={block.id}
          style={{ position: 'absolute', left: block.x }}
          color={block.color}
          delay={block.delay}
          duration={block.duration}
          size={block.size}
        />
      ))}

      {/* Top bar */}
      <View style={styles.topBar}>
        {/* Left: Player pill */}
        <View style={styles.playerPill}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.name?.charAt(0).toUpperCase() ?? 'G'}
            </Text>
          </View>
          <View>
            <Text style={styles.playerName}>{profile?.name ?? 'Guest'}</Text>
            <Text style={styles.playerBest}>Best: {profile?.bestScore ?? 0}</Text>
          </View>
        </View>

        {/* Right: Settings gear */}
        <Pressable onPress={() => { playClick(); onSettings(); }} hitSlop={12} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={28} color="#22d3ee" />
        </Pressable>
      </View>

      {/* Center content */}
      <View style={styles.centerContent}>
        {/* Logo */}
        <Image
          source={require('../../assets/Logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Play button */}
        <PlayButton onPress={() => { playClick(); onPlay(); }} />

        {/* Icon buttons grid */}
        <View style={styles.iconGrid}>
          <View style={styles.iconColumn}>
            {ICON_BUTTONS.slice(0, 3).map((btn, i) => (
              <IconButton
                key={btn.id}
                {...btn}
                onPress={() => { playClick(); handleIconPress(btn); }}
                pressScale={iconScales[i]}
              />
            ))}
          </View>
          <View style={styles.iconColumn}>
            {ICON_BUTTONS.slice(3).map((btn, i) => (
              <IconButton
                key={btn.id}
                {...btn}
                onPress={() => { playClick(); handleIconPress(btn); }}
                pressScale={iconScales[i + 3]}
              />
            ))}
          </View>
        </View>

        {/* Save Progress card (for guests) */}
        {!isSignedIn && (
          <Pressable style={styles.saveProgressCard} onPress={() => { playClick(); onSaveProgress(); }}>
            <Ionicons name="cloud-upload-outline" size={28} color="#22d3ee" />
            <View style={styles.saveProgressText}>
              <Text style={styles.saveProgressTitle}>Save your progress</Text>
              <Text style={styles.saveProgressDesc}>Create an account to sync scores across devices and compete globally</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={24} color="#64748b" />
          </Pressable>
        )}

      </View>

      {/* Bottom: Banner ad */}
      <View style={styles.bannerArea}>
        <Banner />
      </View>

      {/* Coming soon sheet */}
      {showComingSoon && (
        <Pressable style={styles.sheetOverlay} onPress={() => setShowComingSoon(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{showComingSoon}</Text>
            <Text style={styles.sheetDesc}>
              This feature is coming soon! Stay tuned for updates.
            </Text>
            <Pressable style={styles.sheetButton} onPress={() => { playClick(); setShowComingSoon(null); }}>
              <Text style={styles.sheetButtonText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Version */}
      <Text style={styles.versionText}>v{APP_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
  },
  gradientBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b0f1a',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 9999,
    filter: 'blur(80px)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  playerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22d3ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0b0f1a',
    fontSize: 16,
    fontWeight: '900',
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  playerBest: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  logo: {
    width: 180,
    height: 180,
    marginTop: -20,
  },
  iconGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 380,
    marginTop: 8,
  },
  iconColumn: {
    gap: 14,
  },
  saveProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    gap: 12,
  },
  saveProgressText: {
    flex: 1,
  },
  saveProgressTitle: {
    color: '#22d3ee',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  saveProgressDesc: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  iconButton: {
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  iconLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: 70,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#0b0f1a',
  },
  playButton: {
    position: 'relative',
    width: 220,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
  },
  playGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#22d3ee',
    opacity: 0.4,
    borderRadius: 18,
  },
  playButtonInner: {
    flex: 1,
    backgroundColor: '#155e75',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22d3ee',
  },
  playText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  bannerArea: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
    height: 80,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 15, 26, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  sheetTitle: {
    color: '#22d3ee',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sheetDesc: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  sheetButton: {
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 8,
  },
  sheetButtonText: {
    color: '#0b0f1a',
    fontSize: 16,
    fontWeight: '800',
  },
  versionText: {
    position: 'absolute',
    bottom: 8,
    right: 16,
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});