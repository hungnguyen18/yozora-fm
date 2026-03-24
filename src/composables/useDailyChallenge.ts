import { computed, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";
import type { TGenre } from "@/types";

const STORAGE_KEY = "yozora_daily_challenge";
const LIST_GENRE: TGenre[] = [
  "rock",
  "ballad",
  "electronic",
  "pop",
  "orchestral",
];
const LIST_ERA = [1980, 1990, 2000, 2010, 2020];

interface IDailyChallengeState {
  date: number; // dayIndex
  type: "genre" | "era" | "discover" | "variety";
  target: string; // genre name, decade string, or empty
  goal: number;
  listCompletedId: number[]; // song IDs that count toward completion
}

// Module-level singleton guard — prevents duplicate watchers across multiple calls
let watcherInstalled = false;

export const useDailyChallenge = () => {
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();
  const dayIndex = Math.floor(Date.now() / 86400000);

  const state = useLocalStorage<IDailyChallengeState>(STORAGE_KEY, {
    date: 0,
    type: "genre",
    target: "",
    goal: 3,
    listCompletedId: [],
  });

  // Generate new challenge if date changed
  if (state.value.date !== dayIndex) {
    const typeIndex = dayIndex % 4;
    const listType: IDailyChallengeState["type"][] = [
      "genre",
      "era",
      "discover",
      "variety",
    ];
    const type = listType[typeIndex];
    const goal = 2 + (dayIndex % 4); // 2-5

    let target = "";
    if (type === "genre") {
      target = LIST_GENRE[dayIndex % LIST_GENRE.length];
    } else if (type === "era") {
      target = String(LIST_ERA[dayIndex % LIST_ERA.length]);
    }

    state.value = { date: dayIndex, type, target, goal, listCompletedId: [] };
  }

  const progress = computed(() => state.value.listCompletedId.length);
  const isComplete = computed(() => progress.value >= state.value.goal);

  const description = computed(() => {
    const s = state.value;
    switch (s.type) {
      case "genre":
        return `Play ${s.goal} ${s.target} songs`;
      case "era":
        return `Play ${s.goal} songs from the ${s.target}s`;
      case "discover":
        return `Discover ${s.goal} new stars`;
      case "variety":
        return `Play ${s.goal} songs by different artists`;
      default:
        return "";
    }
  });

  // Install watcher once — track song plays toward challenge completion
  if (!watcherInstalled) {
    watcherInstalled = true;

    watch(
      () => playerStore.currentSong,
      (song) => {
        if (!song || isComplete.value) {
          return;
        }
        if (state.value.listCompletedId.includes(song.id)) {
          return;
        }

        const s = state.value;
        let counts = false;

        switch (s.type) {
          case "genre":
            counts = song.genre === s.target;
            break;
          case "era": {
            const decade = Math.floor((song.year ?? 0) / 10) * 10;
            counts = String(decade) === s.target;
            break;
          }
          case "discover":
            // Any new song counts as discovery
            counts = true;
            break;
          case "variety": {
            // Only counts if this artist is not already represented
            const listCompletedArtistId = new Set<number>();
            for (let i = 0; i < s.listCompletedId.length; i += 1) {
              const completedId = s.listCompletedId[i];
              const completedSong = songsStore.listSong.find(
                (item) => item.id === completedId,
              );
              if (completedSong) {
                listCompletedArtistId.add(completedSong.artist_id);
              }
            }
            counts = !listCompletedArtistId.has(song.artist_id);
            break;
          }
        }

        if (counts) {
          state.value.listCompletedId = [
            ...state.value.listCompletedId,
            song.id,
          ];
        }
      },
    );
  }

  return { state, progress, isComplete, description };
};
