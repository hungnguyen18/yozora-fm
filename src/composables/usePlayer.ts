import { ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import type { ISong } from "@/types";

export const usePlayer = () => {
  const playerStore = usePlayerStore();

  // Two video elements for crossfade
  const videoA = ref<HTMLVideoElement | null>(null);
  const videoB = ref<HTMLVideoElement | null>(null);
  const activeVideo = ref<"A" | "B">("A");

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

  // Play a song on the currently active video element
  const play = (song: ISong): void => {
    const url = getVideoUrl(song);
    if (!url) {
      return;
    }

    const current = getActiveVideoEl();
    if (current) {
      current.src = url;
      current.volume = playerStore.volume;
      current.play();
    }

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
      incoming.src = url;
      incoming.volume = 0;
      incoming.play();
    }

    const FADE_DURATION = 2000;
    const startTime = performance.now();
    const targetVolume = playerStore.volume;

    const fade = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / FADE_DURATION, 1);

      if (outgoing) {
        outgoing.volume = (1 - progress) * targetVolume;
      }
      if (incoming) {
        incoming.volume = progress * targetVolume;
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
        // next() resolves the nearest era song and triggers crossfade via the
        // currentSong watcher above.
        playerStore.next();
      } else {
        playerStore.isPlaying = false;
        playerStore.progress = 0;
      }
    });
  };

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

  return {
    videoA,
    videoB,
    activeVideo,
    play,
    crossfadeTo,
    pause,
    resume,
    setVolume,
    getVideoUrl,
    setupProgressTracking,
  };
};
