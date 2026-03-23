import { ref, watch, type Ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import type { ISong } from "@/types";

// Singleton refs shared across all components that call usePlayer()
const videoA = ref<HTMLVideoElement | null>(null);
const videoB = ref<HTMLVideoElement | null>(null);
const activeVideo = ref<"A" | "B">("A");
const isLoading = ref(false);

// Bounding rect of the VideoPlayer container — set by VideoPlayer, read by App.vue
// When non-null, App.vue positions the video elements over this rect.
// When null (panel closed), videos shrink to zero (audio continues).
export type TVideoContainerRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
const videoContainerRect: Ref<TVideoContainerRect | null> = ref(null);

let watcherInstalled = false;
// Pending song to play once the video element becomes available
let pendingSong: ISong | null = null;

export const usePlayer = () => {
  const playerStore = usePlayerStore();

  // Build WebM URL from animethemes_slug
  const getVideoUrl = (song: ISong): string | null => {
    if (!song.animethemes_slug) {
      return null;
    }
    return `https://v.animethemes.moe/${song.animethemes_slug}`;
  };

  const getActiveVideoEl = (): HTMLVideoElement | null => {
    return activeVideo.value === "A" ? videoA.value : videoB.value;
  };

  const getInactiveVideoEl = (): HTMLVideoElement | null => {
    return activeVideo.value === "A" ? videoB.value : videoA.value;
  };

  // Play a song on the currently active video element.
  // If the video element isn't in the DOM yet (panel still mounting),
  // save the song as pending — it will be played when the ref becomes non-null.
  const play = (song: ISong): void => {
    const url = getVideoUrl(song);
    if (!url) {
      return;
    }

    const current = getActiveVideoEl();
    if (!current) {
      pendingSong = song;
      playerStore.isPlaying = true;
      return;
    }

    pendingSong = null;
    isLoading.value = true;
    current.src = url;
    current.volume = playerStore.volume;

    const onCanPlay = (): void => {
      isLoading.value = false;
      current.removeEventListener("canplay", onCanPlay);
    };
    current.addEventListener("canplay", onCanPlay);

    current.play().catch(() => {
      isLoading.value = false;
    });

    playerStore.isPlaying = true;
  };

  // Crossfade from the current song to a new one over 2 seconds
  const crossfadeTo = (song: ISong): void => {
    const url = getVideoUrl(song);
    if (!url) {
      return;
    }

    const outgoing = getActiveVideoEl();
    const incoming = getInactiveVideoEl();

    if (incoming) {
      isLoading.value = true;
      incoming.src = url;
      incoming.volume = 0;

      const onCanPlay = (): void => {
        isLoading.value = false;
        incoming.removeEventListener("canplay", onCanPlay);
      };
      incoming.addEventListener("canplay", onCanPlay);

      incoming.play().catch(() => {
        isLoading.value = false;
      });
    }

    const FADE_DURATION = 2000;
    const startTime = performance.now();
    const targetVolume = playerStore.volume;

    const fade = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / FADE_DURATION, 1);

      if (outgoing) {
        outgoing.volume = Math.min(
          Math.max((1 - progress) * targetVolume, 0),
          1,
        );
      }
      if (incoming) {
        incoming.volume = Math.min(Math.max(progress * targetVolume, 0), 1);
      }

      if (progress < 1) {
        requestAnimationFrame(fade);
      } else {
        if (outgoing) {
          outgoing.pause();
          outgoing.src = "";
        }
        // Swap active video slot
        activeVideo.value = activeVideo.value === "A" ? "B" : "A";
        playerStore.isPlaying = true;
      }
    };

    requestAnimationFrame(fade);
  };

  const pause = (): void => {
    const current = getActiveVideoEl();
    if (current) {
      current.pause();
    }
    playerStore.pause();
  };

  const resume = (): void => {
    const current = getActiveVideoEl();
    if (current && current.src) {
      current.play();
    }
    playerStore.resume();
  };

  const setVolume = (v: number): void => {
    playerStore.setVolume(v);
    const current = getActiveVideoEl();
    if (current) {
      current.volume = playerStore.volume;
    }
  };

  // Wire up progress tracking and auto-next on a video element
  const setupProgressTracking = (video: HTMLVideoElement): void => {
    video.addEventListener("timeupdate", () => {
      if (video.duration) {
        playerStore.setProgress(video.currentTime / video.duration);
      }
    });

    video.addEventListener("ended", () => {
      if (playerStore.autoPlay) {
        playerStore.next();
      } else {
        playerStore.isPlaying = false;
        playerStore.progress = 0;
      }
    });
  };

  // Install watchers only once (singleton pattern)
  if (!watcherInstalled) {
    watcherInstalled = true;

    // Play pending song when video element becomes available
    watch(videoA, (el) => {
      if (el && pendingSong) {
        const song = pendingSong;
        pendingSong = null;
        play(song);
      }
    });

    // React to store-driven song changes (e.g. user clicks a star)
    watch(
      () => playerStore.currentSong,
      (newSong, oldSong) => {
        if (!newSong) {
          return;
        }
        if (oldSong) {
          crossfadeTo(newSong);
        } else {
          play(newSong);
        }
      },
    );

    // Mirror store isPlaying changes back to the DOM (e.g. external pause calls)
    watch(
      () => playerStore.isPlaying,
      (playing) => {
        const current = getActiveVideoEl();
        if (!current || !current.src) {
          return;
        }
        if (playing) {
          current.play();
        } else {
          current.pause();
        }
      },
    );
  }

  return {
    videoA,
    videoB,
    activeVideo,
    isLoading,
    videoContainerRect,
    play,
    crossfadeTo,
    pause,
    resume,
    setVolume,
    getVideoUrl,
    setupProgressTracking,
  };
};
