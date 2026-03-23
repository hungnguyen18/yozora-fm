import { ref } from "vue";
import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import type { ISong } from "@/types";
import { useSongsStore } from "@/stores/songs";
import { useGalaxyStore } from "@/stores/galaxy";

export const usePlayerStore = defineStore("player", () => {
  const currentSong = ref<ISong | null>(null);
  const isPlaying = ref(false);
  const isPip = ref(false);
  const progress = ref(0); // 0–1 representing playback position

  // Persisted preferences via useLocalStorage
  const volume = useLocalStorage("yozora_player_volume", 0.8);
  const autoPlay = useLocalStorage("yozora_player_autoPlay", true);

  function play(song: ISong) {
    currentSong.value = song;
    isPlaying.value = true;
    progress.value = 0;
    // Actual audio playback is handled by composables in Phase 3.
  }

  function pause() {
    isPlaying.value = false;
  }

  function resume() {
    if (currentSong.value !== null) {
      isPlaying.value = true;
    }
  }

  function stop() {
    isPlaying.value = false;
    currentSong.value = null;
    progress.value = 0;
  }

  // Advance to the nearest song in the same decade era.
  // Picks a random candidate from the same era to avoid predictable repetition.
  function next() {
    if (!autoPlay.value || !currentSong.value) {
      isPlaying.value = false;
      progress.value = 0;
      return;
    }

    const songsStore = useSongsStore();
    const galaxyStore = useGalaxyStore();

    const currentYear = currentSong.value.year ?? 1980;
    const currentDecade = Math.floor(currentYear / 10) * 10;
    const currentId = currentSong.value.id;

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
      isPlaying.value = false;
      progress.value = 0;
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

    play(nextSong);
    galaxyStore.selectedSongId = nextSong.id;
    galaxyStore.flyToStar(nextSong.id);
  }

  function setVolume(v: number) {
    volume.value = Math.min(1, Math.max(0, v));
  }

  function togglePip() {
    isPip.value = !isPip.value;
  }

  function setProgress(p: number) {
    progress.value = Math.min(1, Math.max(0, p));
  }

  function setAutoPlay(value: boolean) {
    autoPlay.value = value;
  }

  return {
    currentSong,
    isPlaying,
    isPip,
    progress,
    volume,
    autoPlay,
    play,
    pause,
    resume,
    stop,
    next,
    setVolume,
    togglePip,
    setProgress,
    setAutoPlay,
  };
});
