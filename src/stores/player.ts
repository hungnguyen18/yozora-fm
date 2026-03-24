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
  const traversalMode = useLocalStorage<"era" | "season">(
    "yozora_traversal_mode",
    "era",
  );

  // Recently played song IDs — prevents next() from ping-ponging
  const MAX_RECENT = 20;
  const listRecentId = ref<number[]>([]);

  function play(song: ISong) {
    currentSong.value = song;
    isPlaying.value = true;
    progress.value = 0;

    // Track recently played to prevent next() ping-pong
    listRecentId.value.push(song.id);
    if (listRecentId.value.length > MAX_RECENT) {
      listRecentId.value.shift();
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

    const currentId = currentSong.value.id;

    // Collect candidates: has video, not recently played, matching mode
    const recentSet = new Set(listRecentId.value);

    // Artist radio: if constellation focus is active, cycle through artist's songs
    if (galaxyStore.focusedArtistId !== null) {
      const artistSongIds = galaxyStore.constellationData.get(
        galaxyStore.focusedArtistId,
      );
      if (artistSongIds && artistSongIds.length > 0) {
        // Find playable songs by this artist, sorted by year
        const listArtistSong: ISong[] = [];
        for (let i = 0; i < songsStore.listSong.length; i += 1) {
          const s = songsStore.listSong[i];
          if (
            artistSongIds.includes(s.id) &&
            s.animethemes_slug &&
            !recentSet.has(s.id)
          ) {
            listArtistSong.push(s);
          }
        }

        if (listArtistSong.length > 0) {
          // Sort by year for chronological playback
          listArtistSong.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

          // Pick the first one (chronological order, skipping recently played)
          const nextSong = listArtistSong[0];
          play(nextSong);
          if (!isPip.value) {
            galaxyStore.flyToStar(nextSong.id, true);
          }
          return;
        }
      }
    }

    const currentYear = currentSong.value.year ?? 1980;
    const currentDecade = Math.floor(currentYear / 10) * 10;

    const listCandidate: ISong[] = [];

    if (traversalMode.value === "season") {
      // Season mode: match same year AND same season
      const currentSeason = currentSong.value.anime?.season;
      for (let i = 0; i < songsStore.listSong.length; i += 1) {
        const s = songsStore.listSong[i];
        if (!s.animethemes_slug || recentSet.has(s.id)) {
          continue;
        }
        if (s.year === currentYear && s.anime?.season === currentSeason) {
          listCandidate.push(s);
        }
      }
      // Fallback: if too few in exact season, expand to same year any season
      if (listCandidate.length < 3) {
        for (let i = 0; i < songsStore.listSong.length; i += 1) {
          const s = songsStore.listSong[i];
          if (!s.animethemes_slug || recentSet.has(s.id)) {
            continue;
          }
          if (s.year === currentYear && !listCandidate.includes(s)) {
            listCandidate.push(s);
          }
        }
      }
    } else {
      // Era mode (default): match same decade
      for (let i = 0; i < songsStore.listSong.length; i += 1) {
        const s = songsStore.listSong[i];
        if (!s.animethemes_slug || recentSet.has(s.id)) {
          continue;
        }
        const decade = Math.floor((s.year ?? 1980) / 10) * 10;
        if (decade === currentDecade) {
          listCandidate.push(s);
        }
      }
    }

    if (listCandidate.length === 0) {
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
      let nearest = listCandidate[0];
      for (let i = 0; i < listCandidate.length; i += 1) {
        const candidate = listCandidate[i];
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
      nextSong =
        listCandidate[Math.floor(Math.random() * listCandidate.length)];
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

  function toggleTraversalMode() {
    traversalMode.value = traversalMode.value === "era" ? "season" : "era";
  }

  return {
    currentSong,
    isPlaying,
    isPip,
    progress,
    volume,
    autoPlay,
    traversalMode,
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
    toggleTraversalMode,
  };
});
