import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

type SfxName =
  | 'move'
  | 'rotate'
  | 'softdrop'
  | 'lock'
  | 'harddrop'
  | 'clear1'
  | 'clear4'
  | 'levelup'
  | 'gameover'
  | 'click';

interface SfxConfig {
  file: string;
  volume: number;
}

const SFX_CONFIG: Record<SfxName, SfxConfig> = {
  move: { file: 'sfx/move.wav', volume: 0.5 },
  rotate: { file: 'sfx/rotate.wav', volume: 0.5 },
  softdrop: { file: 'sfx/softdrop.wav', volume: 0.4 },
  lock: { file: 'sfx/lock.wav', volume: 0.6 },
  harddrop: { file: 'sfx/harddrop.wav', volume: 0.7 },
  clear1: { file: 'sfx/clear1.wav', volume: 0.7 },
  clear4: { file: 'sfx/clear4.wav', volume: 0.9 },
  levelup: { file: 'sfx/levelup.wav', volume: 0.8 },
  gameover: { file: 'sfx/gameover.wav', volume: 0.8 },
  click: { file: 'sfx/click.wav', volume: 0.4 },
};

const MUSIC_FILE = 'Locked_In_Place.mp3';
const MUSIC_VOLUME = 0.35;

const STORAGE_KEYS = {
  musicEnabled: 'blockfall.musicEnabled',
  sfxEnabled: 'blockfall.sfxEnabled',
  vibrationEnabled: 'blockfall.vibrationEnabled',
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

class SoundManager {
  private sfxPlayers: Map<SfxName, AudioPlayer | null> = new Map();
  private musicPlayer: AudioPlayer | null = null;
  private musicEnabled = true;
  private sfxEnabled = true;
  private vibrationEnabled = true;
  private loaded = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Load settings from secure store
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const [music, sfx, vibration] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.musicEnabled),
        SecureStore.getItemAsync(STORAGE_KEYS.sfxEnabled),
        SecureStore.getItemAsync(STORAGE_KEYS.vibrationEnabled),
      ]);
      this.musicEnabled = music !== 'false';
      this.sfxEnabled = sfx !== 'false';
      this.vibrationEnabled = vibration !== 'false';
    } catch {
      // Default to true if not set
    }
  }

  private async saveSetting(key: StorageKey, value: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, String(value));
    } catch (e) {
      console.warn('Failed to save sound setting:', e);
    }
  }

  async initialize(): Promise<void> {
    if (this.loaded) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'mixWithOthers',
        });

        const baseUri = Paths.document.uri;

        // Preload all SFX players
        const loadPromises = Object.entries(SFX_CONFIG).map(async ([name, config]) => {
          const uri = baseUri + config.file;
          const exists = await this.checkFileExists(uri);

          if (exists) {
            const player = createAudioPlayer(uri, {
              updateInterval: 0,
              keepAudioSessionActive: true
            });
            player.volume = config.volume;
            this.sfxPlayers.set(name as SfxName, player);
          } else {
            console.warn(`SFX file not found: ${config.file}`);
            this.sfxPlayers.set(name as SfxName, null);
          }
        });

        await Promise.all(loadPromises);

        // Preload music player
        const musicUri = baseUri + MUSIC_FILE;
        const musicExists = await this.checkFileExists(musicUri);
        if (musicExists) {
          this.musicPlayer = createAudioPlayer(musicUri, {
            updateInterval: 0,
            keepAudioSessionActive: true
          });
          this.musicPlayer.volume = MUSIC_VOLUME;
          this.musicPlayer.loop = true;
        } else {
          console.warn(`Music file not found: ${MUSIC_FILE}`);
        }

        this.loaded = true;
      } catch (error) {
        console.warn('Failed to initialize sound manager:', error);
        this.loaded = true;
      }
    })();

    return this.initPromise;
  }

  private async checkFileExists(uri: string): Promise<boolean> {
    try {
      // Use fetch to check if file exists
      const response = await fetch(uri);
      return response.ok;
    } catch {
      return false;
    }
  }

  async playSfx(name: SfxName): Promise<void> {
    if (!this.sfxEnabled) return;

    const player = this.sfxPlayers.get(name);
    if (!player) return;

    try {
      // For short SFX, seek to 0 and play
      await player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn(`Failed to play SFX ${name}:`, error);
    }

    // Haptic feedback for move/rotate
    if (this.vibrationEnabled && (name === 'move' || name === 'rotate')) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }

  async startMusic(): Promise<void> {
    if (!this.musicEnabled || !this.musicPlayer) return;

    try {
      this.musicPlayer.play();
    } catch (error) {
      console.warn('Failed to start music:', error);
    }
  }

  async stopMusic(): Promise<void> {
    if (this.musicPlayer) {
      try {
        this.musicPlayer.pause();
      } catch (error) {
        console.warn('Failed to stop music:', error);
      }
    }
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.saveSetting(STORAGE_KEYS.musicEnabled, enabled);
    if (!enabled) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    this.saveSetting(STORAGE_KEYS.sfxEnabled, enabled);
  }

  setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
    this.saveSetting(STORAGE_KEYS.vibrationEnabled, enabled);
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  isVibrationEnabled(): boolean {
    return this.vibrationEnabled;
  }

  async unloadAll(): Promise<void> {
    await this.stopMusic();

    const unloadPromises = Array.from(this.sfxPlayers.values()).map(async (player) => {
      if (player) {
        try {
          player.remove();
        } catch {}
      }
    });

    if (this.musicPlayer) {
      try {
        this.musicPlayer.remove();
      } catch {}
    }

    await Promise.all(unloadPromises);
    this.sfxPlayers.clear();
    this.musicPlayer = null;
    this.loaded = false;
  }
}

export const soundManager = new SoundManager();

export const playSfx = (name: SfxName) => soundManager.playSfx(name);
export const startMusic = () => soundManager.startMusic();
export const stopMusic = () => soundManager.stopMusic();
export const setMusicEnabled = (enabled: boolean) => soundManager.setMusicEnabled(enabled);
export const setSfxEnabled = (enabled: boolean) => soundManager.setSfxEnabled(enabled);
export const setVibrationEnabled = (enabled: boolean) => soundManager.setVibrationEnabled(enabled);
export const isMusicEnabled = () => soundManager.isMusicEnabled();
export const isSfxEnabled = () => soundManager.isSfxEnabled();
export const isVibrationEnabled = () => soundManager.isVibrationEnabled();
export const initializeSound = () => soundManager.initialize();
export const unloadSounds = () => soundManager.unloadAll();

// Convenience functions for game actions
export const playMove = () => soundManager.playSfx('move');
export const playRotate = () => soundManager.playSfx('rotate');
export const playSoftDrop = () => soundManager.playSfx('softdrop');
export const playLock = () => soundManager.playSfx('lock');
export const playHardDrop = () => soundManager.playSfx('harddrop');
export const playClear = (lines: number) => soundManager.playSfx(lines >= 4 ? 'clear4' : 'clear1');
export const playLevelUp = () => soundManager.playSfx('levelup');
export const playGameOver = () => soundManager.playSfx('gameover');
export const playClick = () => soundManager.playSfx('click');