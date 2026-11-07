import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Ionicons name type
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width } = Dimensions.get('window');

type Step = {
  icon: IoniconsName;
  title: string;
  desc: string;
  color: string;
};

const steps: Step[] = [
  {
    icon: 'caret-back-outline',
    title: 'Move Left',
    desc: 'Drag left on the board or press the left arrow button',
    color: '#3b82f6',
  },
  {
    icon: 'caret-forward-outline',
    title: 'Move Right',
    desc: 'Drag right on the board or press the right arrow button',
    color: '#3b82f6',
  },
  {
    icon: 'caret-down-outline',
    title: 'Soft Drop',
    desc: 'Drag down on the board or press the down arrow to fall faster',
    color: '#22c55e',
  },
  {
    icon: 'reload-outline',
    title: 'Rotate',
    desc: 'Tap anywhere on the board or press the rotate button',
    color: '#a855f7',
  },
  {
    icon: 'arrow-down-circle-outline',
    title: 'Hard Drop',
    desc: 'Quickly flick down on the board or press the hard drop button',
    color: '#ef4444',
  },
];

export default function Tutorial({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>HOW TO PLAY</Text>
        <Pressable onPress={onDone} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close-outline" size={28} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>CONTROLS</Text>
        <View style={styles.grid}>
          {steps.map((step, i) => (
            <View key={i} style={[styles.card, { borderColor: step.color }]}>
              <View style={[styles.iconWrap, { backgroundColor: step.color }]}>
                <Ionicons name={step.icon} size={32} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>{step.title}</Text>
              <Text style={styles.cardDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.subtitle}>SCORING & LEVELS</Text>
        <View style={styles.infoGrid}>
          {[
            ['Single', '100 × Level', '#22c55e'],
            ['Double', '300 × Level', '#3b82f6'],
            ['Triple', '500 × Level', '#a855f7'],
            ['TETRIS (4 lines)', '800 × Level', '#ef4444'],
          ].map(([name, pts, color], i) => (
            <View key={i} style={styles.infoCard}>
              <View style={[styles.infoLeft, { borderColor: color }]}>
                <Text style={[styles.infoName, { color }]}>{name}</Text>
                <Text style={styles.infoPts}>{pts}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.subtitle}>LEVEL UP</Text>
        <View style={styles.levelInfo}>
          <Text style={styles.levelText}>
            Every <Text style={styles.highlight}>10 lines</Text> cleared advances you to the next level.
          </Text>
          <Text style={styles.levelText}>
            Higher levels = <Text style={styles.highlight}>faster falling</Text> pieces and <Text style={styles.highlight}>more points</Text> per line.
          </Text>
          <Text style={styles.levelText}>
            Level 1: 800ms drop → Level 10: 170ms → Level 11+: 100ms (max speed)
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.subtitle}>TIPS</Text>
        <View style={styles.tips}>
          {[
            [
              'Use the ',
              { text: 'Ghost piece', bold: true },
              ' (transparent preview) to plan your landing',
            ],
            'Build flat — avoid deep wells unless saving for a Tetris',
            'Hold pieces by not moving them; the next piece is shown top-right',
            'Hard drop gives bonus points: +2 per cell dropped',
            'Paused game shows Resume / Restart / Quit options',
          ].map((tip, i) => (
            <Text key={i} style={styles.tip}>
              {'• '}
              {Array.isArray(tip)
                ? tip.map((part, j) =>
                    typeof part === 'string'
                      ? part
                      : <Text key={j} style={{ fontWeight: '800', color: '#22d3ee' }}>{part.text}</Text>
                  )
                : tip}
            </Text>
          ))}
        </View>

        <Pressable style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneBtnText}>GOT IT — LET'S PLAY</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    paddingTop: 54,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    color: '#22d3ee',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  subtitle: {
    color: '#22d3ee',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: (width - 44) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCard: {
    width: (width - 42) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  infoLeft: {
    borderLeftWidth: 4,
    borderRadius: 4,
    paddingLeft: 10,
  },
  infoName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  infoPts: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  levelInfo: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  levelText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  highlight: {
    color: '#22d3ee',
    fontWeight: '800',
  },
  tips: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  tip: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: '#22d3ee',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#0b0f1a',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});