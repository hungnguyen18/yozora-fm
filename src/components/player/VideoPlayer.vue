<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { Maximize, Minimize, Pause, Play, Volume2, Loader2 } from 'lucide-vue-next';
import { usePlayer } from '@/composables/usePlayer';
import { usePlayerStore } from '@/stores/player';
import type { ISong } from '@/types';

type TVideoPlayerProps = {
  song: ISong | null;
  genreColor?: string;
};

const props = withDefaults(defineProps<TVideoPlayerProps>(), {
  genreColor: '#4F46E5',
  song: null,
});

const playerStore = usePlayerStore();
const { videoA, videoB, activeVideo, isLoading, videoContainerRect, pause, resume, setVolume, setupProgressTracking } =
  usePlayer();

// Controls visibility state
const isControlsVisible = ref(false);
const hideControlsTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// Local UI state — initialized from store so remount reflects current state
const isPlaying = ref(playerStore.isPlaying);
const volume = ref(playerStore.volume);
const progress = ref(playerStore.progress);
const isFullscreen = ref(false);

const containerRef = ref<HTMLDivElement | null>(null);

const hasVideo = computed(() => {
  return props.song !== null && Boolean(props.song.animethemes_slug);
});

// Cover art for backdrop / poster
const coverArtUrl = computed(() => {
  return props.song?.anime?.cover_url ?? props.song?.album_art_url ?? null;
});

const glowStyle = computed(() => {
  return isPlaying.value
    ? { boxShadow: `0 0 20px ${props.genreColor}40, 0 0 40px ${props.genreColor}20` }
    : { boxShadow: `0 0 10px ${props.genreColor}20` };
});

// Gradient fallback when no cover art
const posterGradientStyle = computed(() => {
  const color = props.genreColor;
  return {
    background: `linear-gradient(135deg, ${color}25 0%, #0a0b1a 50%, ${color}10 100%)`,
  };
});

// Report container bounding rect so App.vue can position the singleton videos
let resizeObserver: ResizeObserver | null = null;

const updateContainerRect = (): void => {
  const el = containerRef.value;
  if (!el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  videoContainerRect.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const showControls = (): void => {
  isControlsVisible.value = true;
  if (hideControlsTimer.value !== null) {
    clearTimeout(hideControlsTimer.value);
  }
  hideControlsTimer.value = setTimeout(() => {
    isControlsVisible.value = false;
  }, 3000);
};

const onMouseLeave = (): void => {
  if (hideControlsTimer.value !== null) {
    clearTimeout(hideControlsTimer.value);
  }
  isControlsVisible.value = false;
};

const togglePlayPause = (): void => {
  if (isPlaying.value) {
    pause();
    isPlaying.value = false;
  } else {
    resume();
    isPlaying.value = true;
  }
};

const onVolumeChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const v = parseFloat(target.value);
  volume.value = v;
  setVolume(v);
};

const onProgressClick = (event: MouseEvent): void => {
  const activeEl = activeVideo.value === 'A' ? videoA.value : videoB.value;
  if (!activeEl || !activeEl.duration) {
    return;
  }
  const bar = event.currentTarget as HTMLDivElement;
  const rect = bar.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  const clamped = Math.min(1, Math.max(0, ratio));
  activeEl.currentTime = clamped * activeEl.duration;
  progress.value = clamped;
};

const toggleFullscreen = (): void => {
  if (!containerRef.value) {
    return;
  }
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
};

const onFullscreenChange = (): void => {
  isFullscreen.value = Boolean(document.fullscreenElement);
  // Update rect after fullscreen change
  setTimeout(updateContainerRect, 100);
};

// Sync local progress from active video element
const onTimeUpdate = (): void => {
  const activeEl = activeVideo.value === 'A' ? videoA.value : videoB.value;
  if (activeEl && activeEl.duration) {
    progress.value = activeEl.currentTime / activeEl.duration;
  }
};

const onVideoPlay = (): void => {
  isPlaying.value = true;
};

const onVideoPause = (): void => {
  isPlaying.value = false;
};

const attachVideoListeners = (el: HTMLVideoElement): void => {
  setupProgressTracking(el);
  el.addEventListener('timeupdate', onTimeUpdate);
  el.addEventListener('play', onVideoPlay);
  el.addEventListener('pause', onVideoPause);
};

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);

  if (videoA.value) {
    attachVideoListeners(videoA.value);
  }
  if (videoB.value) {
    attachVideoListeners(videoB.value);
  }

  // Observe container size and position changes
  updateContainerRect();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerRect();
    });
    resizeObserver.observe(containerRef.value);
  }

  // Also update on scroll (panel is scrollable)
  window.addEventListener('scroll', updateContainerRect, true);
});

// Watch for refs becoming available (they may be null on first mount if v-if delays rendering)
watch(videoA, (el) => {
  if (el) {
    attachVideoListeners(el);
  }
});

watch(videoB, (el) => {
  if (el) {
    attachVideoListeners(el);
  }
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  window.removeEventListener('scroll', updateContainerRect, true);
  if (hideControlsTimer.value !== null) {
    clearTimeout(hideControlsTimer.value);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  // Clear the rect so App.vue hides the videos
  videoContainerRect.value = null;
});
</script>

<template>
  <div
    ref="containerRef"
    class="video-player"
    :style="glowStyle"
    :class="{ 'glow-pulse': isPlaying }"
    @mousemove="showControls"
    @mouseleave="onMouseLeave"
  >
    <!-- Blurred cover art backdrop (always present behind video) -->
    <div class="video-player__backdrop">
      <img
        v-if="coverArtUrl"
        :src="coverArtUrl"
        :alt="''"
        class="video-player__backdrop-img"
      />
      <div
        v-else
        class="video-player__backdrop-gradient"
        :style="posterGradientStyle"
      />
    </div>

    <!-- Cover art poster (visible when not playing) -->
    <Transition name="poster-fade">
      <div
        v-if="!isPlaying && coverArtUrl"
        class="video-player__poster"
      >
        <img
          :src="coverArtUrl"
          :alt="song?.title ?? 'Cover art'"
          class="video-player__poster-img"
        />
      </div>
    </Transition>

    <!-- Play button overlay (visible when not playing) -->
    <Transition name="fade">
      <button
        v-if="!isPlaying && hasVideo && !isLoading"
        class="video-player__play-btn"
        aria-label="Play video"
        @click="togglePlayPause"
      >
        <Play :size="28" fill="currentColor" />
      </button>
    </Transition>

    <!-- Loading spinner overlay -->
    <Transition name="fade">
      <div
        v-if="isLoading && hasVideo"
        class="video-player__loading"
      >
        <Loader2 :size="32" class="video-player__spinner" />
      </div>
    </Transition>

    <!-- The actual video is rendered by App.vue and positioned over this container via videoContainerRect.
         No mirror video needed — the singleton videos are repositioned here. -->

    <!-- Controls overlay -->
    <div
      class="video-player__controls"
      :class="{ 'video-player__controls--visible': isControlsVisible }"
    >
      <!-- Progress bar -->
      <div
        class="video-player__progress"
        @click="onProgressClick"
      >
        <div
          class="video-player__progress-fill"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>

      <!-- Bottom controls row -->
      <div class="video-player__controls-row">
        <!-- Play / Pause -->
        <button
          class="video-player__ctrl-btn"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlayPause"
        >
          <Pause v-if="isPlaying" :size="20" fill="currentColor" />
          <Play v-else :size="20" fill="currentColor" />
        </button>

        <!-- Volume -->
        <div class="video-player__volume">
          <Volume2 :size="16" class="video-player__volume-icon" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="volume"
            class="volume-slider"
            @input="onVolumeChange"
          />
        </div>

        <!-- Spacer -->
        <div class="video-player__spacer" />

        <!-- Song title -->
        <span
          v-if="song"
          class="video-player__title"
        >
          {{ song.title }}
        </span>

        <!-- Fullscreen -->
        <button
          class="video-player__ctrl-btn"
          :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          @click="toggleFullscreen"
        >
          <Maximize v-if="!isFullscreen" :size="16" />
          <Minimize v-else :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  aspect-ratio: 16 / 9;
  background-color: #0a0b1a;
}

/* Blurred backdrop */
.video-player__backdrop {
  position: absolute;
  inset: -20px;
  z-index: 0;
  overflow: hidden;
}

.video-player__backdrop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(6px) brightness(0.45) saturate(1.2);
  transform: scale(1.15);
}

.video-player__backdrop-gradient {
  width: 100%;
  height: 100%;
}

/* Poster overlay */
.video-player__poster {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 11, 26, 0.4);
}

.video-player__poster-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

/* Play button */
.video-player__play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: rgba(79, 70, 229, 0.85);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: transform 0.2s, background-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
  padding-left: 3px;
}

.video-player__play-btn:hover {
  transform: translate(-50%, -50%) scale(1.08);
  background: rgba(79, 70, 229, 1);
  box-shadow: 0 6px 28px rgba(79, 70, 229, 0.6);
}

/* Loading */
.video-player__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
  background: rgba(10, 11, 26, 0.6);
}

.video-player__spinner {
  color: rgba(255, 255, 255, 0.7);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Controls overlay */
.video-player__controls {
  position: absolute;
  inset: auto 0 0 0;
  padding: 32px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 6;
  background: linear-gradient(transparent, rgba(10, 11, 26, 0.85));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.video-player__controls--visible {
  opacity: 1;
}

/* Progress bar */
.video-player__progress {
  width: 100%;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  position: relative;
}

.video-player__progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 9999px;
  background-color: #4F46E5;
  transition: width 0.1s linear;
}

/* Controls row */
.video-player__controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.video-player__ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}

.video-player__ctrl-btn:hover {
  color: #ffffff;
}

.video-player__volume {
  display: flex;
  align-items: center;
  gap: 6px;
}

.video-player__volume-icon {
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.video-player__spacer {
  flex: 1;
}

.video-player__title {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

/* Animated glow pulse while playing */
.glow-pulse {
  animation: glowPulse 2.5s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.08); }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.poster-fade-enter-active,
.poster-fade-leave-active {
  transition: opacity 0.5s ease;
}

.poster-fade-enter-from,
.poster-fade-leave-to {
  opacity: 0;
}

/* Volume slider */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 64px;
  height: 3px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4F46E5;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4F46E5;
  cursor: pointer;
  border: none;
}
</style>
