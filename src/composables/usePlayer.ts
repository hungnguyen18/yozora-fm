import { ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import type { ISong } from "@/types";

// ---------------------------------------------------------------------------
// Singleton video elements — created once, never destroyed.
// They live in a hidden container when no VideoPlayer is mounted (audio
// continues).  VideoPlayer.onMounted moves them into its own DOM container;
// VideoPlayer.onUnmounted moves them back.  No fixed positioning or
// rect-tracking needed.
// ---------------------------------------------------------------------------

const videoA = ref<HTMLVideoElement | null>(null);
const videoB = ref<HTMLVideoElement | null>(null);
const activeVideo = ref<"A" | "B">("A");
const isLoading = ref(false);
const isCrossfading = ref(false);

// Hidden off-screen container — audio keeps playing while elements are here.
let hiddenContainer: HTMLDivElement | null = null;

const getHiddenContainer = (): HTMLDivElement => {
  if (!hiddenContainer) {
    hiddenContainer = document.createElement("div");
    hiddenContainer.style.cssText =
      "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0";
    document.body.appendChild(hiddenContainer);
  }
  return hiddenContainer;
};

const createVideoEl = (): HTMLVideoElement => {
  const el = document.createElement("video");
  el.preload = "auto";
  el.playsInline = true;
  // Inline styles so the element renders correctly wherever it is placed
  el.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:12px";
  return el;
};

// Track whether progress-tracking listeners have been attached
let progressTrackingInstalled = false;

let watcherInstalled = false;
let pendingSong: ISong | null = null;
let skipNextWatcherPlay = false;
let crossfadeRafId = 0;

// Helper: clean up canplay/error listeners
const cleanupVideoListeners = (
  el: HTMLVideoElement,
  onCanPlay?: () => void,
  onError?: () => void,
): void => {
  if (onCanPlay) {
    el.removeEventListener("canplay", onCanPlay);
  }
  if (onError) {
    el.removeEventListener("error", onError);
  }
};

// Update opacity / z-index on the two video elements based on current state.
// Called whenever activeVideo or isCrossfading changes.
const updateVideoVisibility = (): void => {
  const a = videoA.value;
  const b = videoB.value;
  if (!a || !b) {
    return;
  }
  const isAActive = activeVideo.value === "A";
  if (isCrossfading.value) {
    // During crossfade: outgoing fades out, incoming fades in
    a.style.opacity = isAActive ? "0" : "1";
    a.style.transition = "opacity 2s ease";
    a.style.zIndex = isAActive ? "0" : "1";
    b.style.opacity = isAActive ? "1" : "0";
    b.style.transition = "opacity 2s ease";
    b.style.zIndex = isAActive ? "0" : "1";
  } else {
    a.style.opacity = isAActive ? "1" : "0";
    a.style.transition = "opacity 0.3s ease";
    a.style.zIndex = isAActive ? "1" : "0";
    b.style.opacity = isAActive ? "0" : "1";
    b.style.transition = "opacity 0.3s ease";
    b.style.zIndex = isAActive ? "1" : "0";
  }
};

export const usePlayer = () => {
  const playerStore = usePlayerStore();

  // Create video elements on first call (singleton)
  const ensureVideoElements = (): void => {
    if (videoA.value && videoB.value) {
      return;
    }
    const a = createVideoEl();
    const b = createVideoEl();
    getHiddenContainer().appendChild(a);
    getHiddenContainer().appendChild(b);
    videoA.value = a;
    videoB.value = b;
    updateVideoVisibility();

    // Attach progress tracking once
    if (!progressTrackingInstalled) {
      progressTrackingInstalled = true;
      const trackProgress = (video: HTMLVideoElement): void => {
        video.addEventListener("timeupdate", () => {
          // Only track the active video
          const active =
            activeVideo.value === "A" ? videoA.value : videoB.value;
          if (video === active && video.duration) {
            playerStore.setProgress(video.currentTime / video.duration);
          }
        });
        video.addEventListener("ended", () => {
          const active =
            activeVideo.value === "A" ? videoA.value : videoB.value;
          if (video !== active) {
            return;
          }
          if (playerStore.autoPlay) {
            playerStore.next();
          } else {
            playerStore.isPlaying = false;
            playerStore.progress = 0;
          }
        });
      };
      trackProgress(a);
      trackProgress(b);
    }
  };

  // Ensure elements exist on every usePlayer() call
  ensureVideoElements();

  // -----------------------------------------------------------------------
  // Public API: mount / unmount videos into a display container
  // -----------------------------------------------------------------------

  /** Move both video elements into `container` (called by VideoPlayer.onMounted) */
  const mountVideos = (container: HTMLElement): void => {
    ensureVideoElements();
    if (videoA.value) {
      container.appendChild(videoA.value);
    }
    if (videoB.value) {
      container.appendChild(videoB.value);
    }
    updateVideoVisibility();

    // If a song was pending (panel was mounting), play it now
    if (pendingSong) {
      const song = pendingSong;
      pendingSong = null;
      play(song);
    }
  };

  /** Move both video elements back to hidden container (VideoPlayer.onUnmounted) */
  const unmountVideos = (): void => {
    const hidden = getHiddenContainer();
    if (videoA.value && videoA.value.parentElement !== hidden) {
      hidden.appendChild(videoA.value);
    }
    if (videoB.value && videoB.value.parentElement !== hidden) {
      hidden.appendChild(videoB.value);
    }
  };

  // -----------------------------------------------------------------------
  // Playback
  // -----------------------------------------------------------------------

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

  const cancelCrossfade = (): void => {
    if (crossfadeRafId) {
      cancelAnimationFrame(crossfadeRafId);
      crossfadeRafId = 0;
    }
    if (isCrossfading.value) {
      const inactive = getInactiveVideoEl();
      if (inactive && inactive.src) {
        inactive.pause();
        inactive.src = "";
        inactive.load();
      }
      isCrossfading.value = false;
      updateVideoVisibility();
    }
  };

  const play = (song: ISong): void => {
    const url = getVideoUrl(song);
    if (!url) {
      return;
    }
    cancelCrossfade();

    const current = getActiveVideoEl();
    if (!current) {
      pendingSong = song;
      playerStore.isPlaying = true;
      return;
    }

    pendingSong = null;
    skipNextWatcherPlay = true;
    isLoading.value = true;

    current.pause();
    current.src = url;
    current.volume = playerStore.volume;
    current.load();

    const onCanPlay = (): void => {
      isLoading.value = false;
      cleanupVideoListeners(current, onCanPlay, onError);
    };
    const onError = (): void => {
      isLoading.value = false;
      cleanupVideoListeners(current, onCanPlay, onError);
    };
    current.addEventListener("canplay", onCanPlay);
    current.addEventListener("error", onError);

    current.play().catch(() => {
      isLoading.value = false;
      cleanupVideoListeners(current, onCanPlay, onError);
    });

    playerStore.isPlaying = true;
  };

  const crossfadeTo = (song: ISong): void => {
    const url = getVideoUrl(song);
    if (!url) {
      return;
    }
    cancelCrossfade();

    const outgoing = getActiveVideoEl();
    const incoming = getInactiveVideoEl();

    isLoading.value = true;
    isCrossfading.value = true;
    updateVideoVisibility();

    if (incoming) {
      incoming.src = url;
      incoming.volume = 0;
      incoming.load();

      const onCanPlay = (): void => {
        isLoading.value = false;
        cleanupVideoListeners(incoming, onCanPlay, onError);
      };
      const onError = (): void => {
        isLoading.value = false;
        cleanupVideoListeners(incoming, onCanPlay, onError);
      };
      incoming.addEventListener("canplay", onCanPlay);
      incoming.addEventListener("error", onError);

      incoming.play().catch(() => {
        isLoading.value = false;
        cleanupVideoListeners(incoming, onCanPlay, onError);
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
        crossfadeRafId = requestAnimationFrame(fade);
      } else {
        crossfadeRafId = 0;
        if (outgoing) {
          outgoing.pause();
          outgoing.src = "";
          outgoing.load();
        }
        activeVideo.value = activeVideo.value === "A" ? "B" : "A";
        isCrossfading.value = false;
        updateVideoVisibility();
        playerStore.isPlaying = true;
      }
    };

    crossfadeRafId = requestAnimationFrame(fade);
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

  // -----------------------------------------------------------------------
  // Singleton watchers
  // -----------------------------------------------------------------------

  if (!watcherInstalled) {
    watcherInstalled = true;

    // Update video visibility when active slot or crossfade state changes
    watch([activeVideo, isCrossfading], () => {
      updateVideoVisibility();
    });

    // React to store-driven song changes (auto-play next, etc.)
    watch(
      () => playerStore.currentSong,
      (newSong, oldSong) => {
        if (!newSong) {
          return;
        }
        if (skipNextWatcherPlay) {
          skipNextWatcherPlay = false;
          return;
        }
        if (oldSong) {
          crossfadeTo(newSong);
        } else {
          play(newSong);
        }
      },
    );

    // Mirror store isPlaying → DOM
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
    isCrossfading,
    play,
    crossfadeTo,
    pause,
    resume,
    setVolume,
    mountVideos,
    unmountVideos,
  };
};
