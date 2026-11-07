import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { submitScore } from './api';

const STORAGE_KEY = 'blockfall-profile';

export type GameRecord = {
  id: string;
  score: number;
  lines: number;
  level: number;
  pieces: number;
  seconds: number;
  clears: number[];
  date: string;
  synced: boolean;
};

export type AggregateStats = {
  games: number;
  bestScore: number;
  avgScore: number;
  totalLines: number;
  highestLevel: number;
  tetrises: number;
};

export type LocalProfile = {
  guestId: string;
  name: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  bestScore: number;
  gameHistory: GameRecord[];
  stats: AggregateStats;
  createdAt: string;
};

function generateGuestId(): string {
  return Crypto.randomUUID();
}

function defaultStats(): AggregateStats {
  return {
    games: 0,
    bestScore: 0,
    avgScore: 0,
    totalLines: 0,
    highestLevel: 0,
    tetrises: 0,
  };
}

export async function getOrCreateProfile(): Promise<LocalProfile> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (stored) {
      const profile = JSON.parse(stored) as LocalProfile;
      // Ensure all fields exist for backward compatibility
      return {
        guestId: profile.guestId,
        name: profile.name ?? 'Guest',
        soundEnabled: profile.soundEnabled ?? true,
        musicEnabled: profile.musicEnabled ?? true,
        vibrationEnabled: profile.vibrationEnabled ?? true,
        bestScore: profile.bestScore ?? 0,
        gameHistory: profile.gameHistory ?? [],
        stats: profile.stats ?? defaultStats(),
        createdAt: profile.createdAt ?? new Date().toISOString(),
      };
    }
  } catch {
    // Ignore errors, create new profile
  }

  // Create new guest profile
  const profile: LocalProfile = {
    guestId: generateGuestId(),
    name: 'Guest',
    soundEnabled: true,
    musicEnabled: true,
    vibrationEnabled: true,
    bestScore: 0,
    gameHistory: [],
    stats: defaultStats(),
    createdAt: new Date().toISOString(),
  };
  await saveProfile(profile);
  return profile;
}

export async function saveProfile(profile: LocalProfile): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profile));
}

export async function updateProfile(updates: Partial<LocalProfile>): Promise<LocalProfile> {
  const current = await getOrCreateProfile();
  const updated = { ...current, ...updates };
  await saveProfile(updated);
  return updated;
}

export async function addGameRecord(record: Omit<GameRecord, 'id' | 'date' | 'synced'>): Promise<LocalProfile> {
  const profile = await getOrCreateProfile();

  const gameRecord: GameRecord = {
    id: Crypto.randomUUID(),
    ...record,
    date: new Date().toISOString(),
    synced: false,
  };

  // Add to history (keep last 500)
  const newHistory = [gameRecord, ...profile.gameHistory].slice(0, 500);

  // Update aggregate stats
  const allScores = newHistory.map(g => g.score);
  const newStats: AggregateStats = {
    games: newHistory.length,
    bestScore: Math.max(0, ...allScores),
    avgScore: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
    totalLines: newHistory.reduce((sum, g) => sum + g.lines, 0),
    highestLevel: Math.max(0, ...newHistory.map(g => g.level)),
    tetrises: newHistory.reduce((sum, g) => sum + (g.clears[3] ?? 0), 0),
  };

  const updatedProfile = {
    ...profile,
    gameHistory: newHistory,
    stats: newStats,
    bestScore: Math.max(profile.bestScore, gameRecord.score),
  };

  await saveProfile(updatedProfile);
  return updatedProfile;
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  await updateProfile({ soundEnabled: enabled });
}

export async function setMusicEnabled(enabled: boolean): Promise<void> {
  await updateProfile({ musicEnabled: enabled });
}

export async function setVibrationEnabled(enabled: boolean): Promise<void> {
  await updateProfile({ vibrationEnabled: enabled });
}

export async function setGuestName(name: string): Promise<void> {
  await updateProfile({ name: name.trim() || 'Guest' });
}

export async function markGamesSynced(gameIds: string[]): Promise<void> {
  const profile = await getOrCreateProfile();
  const idSet = new Set(gameIds);
  const updatedHistory = profile.gameHistory.map(g =>
    idSet.has(g.id) ? { ...g, synced: true } : g
  );
  await saveProfile({ ...profile, gameHistory: updatedHistory });
}

export async function clearProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export async function syncGuestProgress(getToken: () => Promise<string | null>): Promise<{ synced: number; failed: number }> {
  const profile = await getOrCreateProfile();
  const unsyncedGames = profile.gameHistory.filter(g => !g.synced);

  if (unsyncedGames.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  const newlySyncedIds: string[] = [];

  for (const game of unsyncedGames) {
    try {
      const token = await getToken();
      if (!token) {
        failed++;
        continue;
      }

      const clientGameId = Crypto.randomUUID();
      const result = await submitScore(token, {
        name: profile.name,
        score: game.score,
        lines: game.lines,
        level: game.level,
        pieces: game.pieces,
        seconds: game.seconds,
        clears: game.clears,
        client_game_id: clientGameId,
      });

      if (result.rank !== null || result.similar.length > 0) {
        newlySyncedIds.push(game.id);
        synced++;
      } else {
        failed++;
      }
    } catch (e) {
      console.warn('Failed to sync game:', e);
      failed++;
    }
  }

  if (newlySyncedIds.length > 0) {
    await markGamesSynced(newlySyncedIds);
  }

  return { synced, failed };
}