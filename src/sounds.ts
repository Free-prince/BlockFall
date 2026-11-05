import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

type SoundName =
  | 'background'
  | 'move'
  | 'rotate'
  | 'softDrop'
  | 'hardDrop'
  | 'lineClear1'
  | 'lineClear2'
  | 'lineClear3'
  | 'lineClear4'
  | 'levelUp'
  | 'gameOver';

interface SoundConfig {
  file: string;
  volume: number;
  loop?: boolean;
  rate?: number;
}

const SOUND_CONFIG: Record<SoundName, SoundConfig> = {
  background: { file: 'Locked_In_Place.mp3', volume: 0.3, loop: true },
  move: { file: 'game_sound.mp3', volume: 0.5, rate: 1.0 },
  rotate: { file: 'game_sound.mp3', volume: 0.5, rate: 1.2 },
  softDrop: { file: 'game_sound.mp3', volume: 0.4, rate: 0.9 },
  hardDrop: { file: 'game_sound.mp3', volume: 0.6, rate: 1.3 },
  lineClear1: { file: 'game_sound.mp3', volume: 0.7, rate: 1.0 },
  lineClear2: { file: 'game_sound.mp3', volume: 0.7, rate: 1.1 },
  lineClear3: { file: 'game_sound.mp3', volume: 0.8, rate: 1.2 },
  lineClear4: { file: 'game_sound.mp3', volume: 0.9, rate: 1.3 },
  levelUp: { file: 'game_sound.mp3', volume: 0.8, rate: 1.4 },
  gameOver: { file: 'game_sound.mp3', volume: 0.8, rate: 0.7 },
};

class SoundManager {
  private sounds: Map<SoundName, Audio.Sound | null> = new Map();
  private enabled = true;
  private loaded = false;
  private backgroundSound: Audio.Sound | null = null;

  async loadAll(): Promise<void> {
    if (this.loaded) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Load all sounds
      const loadPromises = Object.entries(SOUND_CONFIG).map(async ([name, config]) => {
        const uri = FileSystem.documentDirectory + config.file;
        const exists = await FileSystem.getInfoAsync(uri);

        if (exists.exists) {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, volume: config.volume, isLooping: config.loop, rate: config.rate },
            this.onPlaybackStatusUpdate.bind(this, name as SoundName)
          );
          this.sounds.set(name as SoundName, sound);
        } else {
          // File not found - sound will be null (silently skipped)
          this.sounds.set(name as SoundName, null);
        }
      });

      await Promise.all(loadPromises);
      this.loaded = true;
    } catch (error) {
      console.warn('Failed to load sounds:', error);
      this.loaded = true;
    }
  }

  private onPlaybackStatusUpdate(name: SoundName, status: Audio.PlaybackStatus): void {
    if (!status.isLoaded) return;
    if (status.didJustFinish && !status.isLooping) {
      // Sound finished playing, could unload if needed
    }
  }

  async play(name: SoundName): Promise<void> {
    if (!this.enabled) return;

    const sound = this.sounds.get(name);
    if (!sound) return;

    try {
      await sound.replayAsync();
    } catch (error) {
      console.warn(`Failed to play sound ${name}:`, error);
    }
  }

  async playBackground(): Promise<void> {
    if (!this.enabled) return;

    const sound = this.sounds.get('background');
    if (!sound) return;

    try {
      if (this.backgroundSound && this.backgroundSound !== sound) {
        await this.backgroundSound.stopAsync();
      }
      this.backgroundSound = sound;
      await sound.playAsync();
    } catch (error) {
      console.warn('Failed to play background music:', error);
    }
  }

  async stopBackground(): Promise<void> {
    if (this.backgroundSound) {
      try {
        await this.backgroundSound.pauseAsync();
      } catch (error) {
        console.warn('Failed to stop background music:', error);
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBackground();
      // Stop all playing sounds
      this.sounds.forEach(async (sound) => {
        if (sound) {
          try {
            await sound.stopAsync();
          } catch {}
        }
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async unloadAll(): Promise<void> {
    await this.stopBackground();
    const unloadPromises = Array.from(this.sounds.values()).map(async (sound) => {
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch {}
      }
    });
    await Promise.all(unloadPromises);
    this.sounds.clear();
    this.loaded = false;
  }
}

export const soundManager = new SoundManager();

// Convenience functions for game actions
export const playMove = () => soundManager.play('move');
export const playRotate = () => soundManager.play('rotate');
export const playSoftDrop = () => soundManager.play('softDrop');
export const playHardDrop = () => soundManager.play('hardDrop');
export const playLineClear = (lines: number) => {
  if (lines === 1) soundManager.play('lineClear1');
  else if (lines === 2) soundManager.play('lineClear2');
  else if (lines === 3) soundManager.play('lineClear3');
  else if (lines >= 4) soundManager.play('lineClear4');
};
export const playLevelUp = () => soundManager.play('levelUp');
export const playGameOver = () => soundManager.play('gameOver');
export const playBackgroundMusic = () => soundManager.playBackground();
export const stopBackgroundMusic = () => soundManager.stopBackground();
export const setSoundEnabled = (enabled: boolean) => soundManager.setEnabled(enabled);
export const isSoundEnabled = () => soundManager.isEnabled();
export const loadSounds = () => soundManager.loadAll();
export const unloadSounds = () => soundManager.unloadAll();