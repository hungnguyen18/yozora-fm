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

  // Recently played song IDs — prevents next() from ping-ponging
  const MAX_RECENT = 20;
  const listRecentId: number[] = [];

  function play(song: ISong) {
    currentSong.value = song;
    isPlaying.value = true;
    progress.value = 0;

    // Track recently played to prevent next() ping-pong
    listRecentId.push(song.id);
    if (listRecentId.length > MAX_RECENT) {
      listRecentId.shift();
    }
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
  // `userTriggered` = true when called from UI skip button (always works).
  // `userTriggered` = false when called from video ended event (requires autoPlay).
  function next(userTriggered = false) {
    if (!userTriggered && !autoPlay.value) {
      isPlaying.value = false;
      progress.value = 0;
      return;
    }
    if (!currentSong.value) {
      isPlaying.value = false;
      progress.value = 0;
      return;
    }

    const songsStore = useSongsStore();
    const galaxyStore = useGalaxyStore();

    const currentYear = currentSong.value.year ?? 1980;
    const currentDecade = Math.floor(currentYear / 10) * 10;
    const currentId = currentSong.value.id;

    // Collect candidates: same decade, has video, not recently played
    const recentSet = new Set(listRecentId);
    const listSameEra: ISong[] = [];
    for (let i = 0; i < songsStore.listSong.length; i += 1) {
      const s = songsStore.listSong[i];
      if (!s.animethemes_slug || recentSet.has(s.id)) {
        continue;
      }
      const decade = Math.floor((s.year ?? 1980) / 10) * 10;
      if (decade === currentDecade) {
        listSameEra.push(s);
      }
    }

    if (listSameEra.length === 0) {
      isPlaying.value = false;
      progress.value = 0;
      return;
    }

    // Build a position lookup map once — O(n) instead of O(n*m) nested .find()
    const posMap = new Map<number, { x: number; y: number }>();
    for (let i = 0; i < galaxyStore.listStarPosition.length; i += 1) {
      const sp = galaxyStore.listStarPosition[i];
      posMap.set(sp.songId, sp);
    }

    const currentPos = posMap.get(currentId);
    let nextSong: ISong;

    if (currentPos) {
      let minDist = Infinity;
      let nearest = listSameEra[0];
      for (let i = 0; i < listSameEra.length; i += 1) {
        const candidate = listSameEra[i];
        const pos = posMap.get(candidate.id);
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
      nextSong = listSameEra[Math.floor(Math.random() * listSameEra.length)];
    }

    play(nextSong);

    // Only fly to star if detail panel is open (not in PiP mode)
    if (!isPip.value) {
      galaxyStore.flyToStar(nextSong.id);
    }
  }

  // Pick and play a random song, optionally filtered by decade (e.g. 1980, 1990).
  // Only considers songs that have an animethemes_slug so playback is possible.
  function playRandom(decade?: number) {
    const songsStore = useSongsStore();
    const galaxyStore = useGalaxyStore();

    const listCandidate: ISong[] = [];
    for (let i = 0; i < songsStore.listSong.length; i += 1) {
      const s = songsStore.listSong[i];
      if (!s.animethemes_slug) {
        continue;
      }
      if (decade !== undefined) {
        const songDecade = Math.floor((s.year ?? 1980) / 10) * 10;
        if (songDecade !== decade) {
          continue;
        }
      }
      listCandidate.push(s);
    }

    if (listCandidate.length === 0) {
      return;
    }

    const picked =
      listCandidate[Math.floor(Math.random() * listCandidate.length)];
    play(picked);
    galaxyStore.selectedSongId = picked.id;
    galaxyStore.flyToStar(picked.id);
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
    listRecentId,
    play,
    pause,
    resume,
    stop,
    next,
    playRandom,
    setVolume,
    togglePip,
    setProgress,
    setAutoPlay,
  };
});
