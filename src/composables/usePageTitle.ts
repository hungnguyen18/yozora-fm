import { watch, onUnmounted } from "vue";
import { usePlayerStore } from "@/stores/player";

const DEFAULT_TITLE = "Yozora.fm \u2014 Anime Music Galaxy";
const SCROLL_SPEED_MS = 300;
const SEPARATOR = "   \u266B   ";

/**
 * Updates document.title with a scrolling marquee when a song is playing.
 * Call once from App.vue.
 */
export const usePageTitle = () => {
  const playerStore = usePlayerStore();

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let scrollOffset = 0;
  let fullText = "";

  const stopScroll = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    scrollOffset = 0;
  };

  const startScroll = (text: string): void => {
    stopScroll();
    fullText = text + SEPARATOR;
    scrollOffset = 0;
    document.title = text;

    intervalId = setInterval(() => {
      scrollOffset = (scrollOffset + 1) % fullText.length;
      document.title =
        fullText.slice(scrollOffset) + fullText.slice(0, scrollOffset);
    }, SCROLL_SPEED_MS);
  };

  watch(
    () => playerStore.currentSong,
    (song) => {
      if (song) {
        const artist = song.artist?.name ?? "Unknown Artist";
        startScroll(`${song.title} \u2014 ${artist} | Yozora.fm`);
      } else {
        stopScroll();
        document.title = DEFAULT_TITLE;
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopScroll();
  });
};
