import { watch } from "vue";
import { usePlayerStore } from "@/stores/player";

const DEFAULT_TITLE = "Yozora.fm — Anime Music Galaxy";

/**
 * Updates document.title to reflect the current playing song.
 * Call once from App.vue.
 */
export const usePageTitle = () => {
  const playerStore = usePlayerStore();

  watch(
    () => playerStore.currentSong,
    (song) => {
      if (song) {
        const artist = song.artist?.name ?? "Unknown Artist";
        document.title = `${song.title} — ${artist} | Yozora.fm`;
      } else {
        document.title = DEFAULT_TITLE;
      }
    },
    { immediate: true },
  );
};
