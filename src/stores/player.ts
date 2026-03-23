import { defineStore } from 'pinia';
import type { ISong } from '@/types';

const STORAGE_KEY_VOLUME = 'yozora_player_volume';
const STORAGE_KEY_AUTO_PLAY = 'yozora_player_autoPlay';

const loadVolume = (): number => {
  const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
  if (stored === null) {
    return 0.8;
  }
  const parsed = parseFloat(stored);
  return isNaN(parsed) ? 0.8 : Math.min(1, Math.max(0, parsed));
};

const loadAutoPlay = (): boolean => {
  const stored = localStorage.getItem(STORAGE_KEY_AUTO_PLAY);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
};

export const usePlayerStore = defineStore('player', {
  state: () => ({
    currentSong: null as ISong | null,
    isPlaying: false,
    isPip: false,
    volume: loadVolume(),
    autoPlay: loadAutoPlay(),
    progress: 0, // 0–1 representing playback position
  }),
  actions: {
    play(song: ISong) {
      this.currentSong = song;
      this.isPlaying = true;
      this.progress = 0;
      // Actual audio playback is handled by composables in Phase 3.
    },

    pause() {
      this.isPlaying = false;
    },

    resume() {
      if (this.currentSong !== null) {
        this.isPlaying = true;
      }
    },

    stop() {
      this.isPlaying = false;
      this.currentSong = null;
      this.progress = 0;
    },

    // Advance to the next song; actual neighbour resolution requires the songs store.
    // The galaxy store's flyToStar will be triggered by the component observing this.
    next() {
      // Callers (components/composables) should call useSongsStore and useGalaxyStore
      // to resolve the nearest star in the same era, then call play(nextSong).
      this.isPlaying = false;
      this.progress = 0;
    },

    setVolume(v: number) {
      const clamped = Math.min(1, Math.max(0, v));
      this.volume = clamped;
      localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    },

    togglePip() {
      this.isPip = !this.isPip;
    },

    setProgress(p: number) {
      this.progress = Math.min(1, Math.max(0, p));
    },

    setAutoPlay(value: boolean) {
      this.autoPlay = value;
      localStorage.setItem(STORAGE_KEY_AUTO_PLAY, String(value));
    },
  },
});
