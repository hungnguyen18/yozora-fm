import { defineStore } from "pinia";
import type { ISong } from "@/types";
import { useSongsStore } from "@/stores/songs";
import { useGalaxyStore } from "@/stores/galaxy";

const STORAGE_KEY_VOLUME = "yozora_player_volume";
const STORAGE_KEY_AUTO_PLAY = "yozora_player_autoPlay";

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
  return stored === "true";
};

export const usePlayerStore = defineStore("player", {
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

    // Advance to the nearest song in the same decade era.
    // Picks a random candidate from the same era to avoid predictable repetition.
    next() {
      if (!this.autoPlay || !this.currentSong) {
        this.isPlaying = false;
        this.progress = 0;
        return;
      }

      const songsStore = useSongsStore();
      const galaxyStore = useGalaxyStore();

      const currentYear = this.currentSong.year ?? 1980;
      const currentDecade = Math.floor(currentYear / 10) * 10;
      const currentId = this.currentSong.id;

      // Collect candidates: same decade, different song
      const listSameEra: ISong[] = [];
      for (let i = 0; i < songsStore.listSong.length; i += 1) {
        const s = songsStore.listSong[i];
        const decade = Math.floor((s.year ?? 1980) / 10) * 10;
        if (decade === currentDecade && s.id !== currentId) {
          listSameEra.push(s);
        }
      }

      if (listSameEra.length === 0) {
        this.isPlaying = false;
        this.progress = 0;
        return;
      }

      // Find the nearest star by Euclidean distance in galaxy space
      const currentPos = galaxyStore.listStarPosition.find(
        (sp) => sp.songId === currentId,
      );
      let nextSong: ISong;

      if (currentPos) {
        let minDist = Infinity;
        let nearest = listSameEra[0];
        for (let i = 0; i < listSameEra.length; i += 1) {
          const candidate = listSameEra[i];
          const pos = galaxyStore.listStarPosition.find(
            (sp) => sp.songId === candidate.id,
          );
          if (!pos) {
            continue;
          }
          const dx = pos.x - currentPos.x;
          const dy = pos.y - currentPos.y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            nearest = candidate;
          }
        }
        nextSong = nearest;
      } else {
        // Fall back to random pick when position data is unavailable
        nextSong = listSameEra[Math.floor(Math.random() * listSameEra.length)];
      }

      this.play(nextSong);
      galaxyStore.selectedSongId = nextSong.id;
      galaxyStore.flyToStar(nextSong.id);
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
