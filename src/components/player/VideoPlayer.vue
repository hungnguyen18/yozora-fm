<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { usePlayer } from '@/composables/usePlayer';
import type { ISong } from '@/types';

type TVideoPlayerProps = {
  song: ISong | null;
  genreColor?: string;
};

const props = withDefaults(defineProps<TVideoPlayerProps>(), {
  genreColor: '#4F46E5',
  song: null,
});

const { videoA, videoB, activeVideo, pause, resume, setVolume, setupProgressTracking } =
  usePlayer();

// Controls visibility state
const isControlsVisible = ref(false);
const hideControlsTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// Local UI state mirroring store for responsiveness
const isPlaying = ref(false);
const volume = ref(0.8);
const progress = ref(0);
const isFullscreen = ref(false);

const containerRef = ref<HTMLDivElement | null>(null);

const hasVideo = computed(() => {
  return props.song !== null && Boolean(props.song.animethemes_slug);
});

const glowStyle = computed(() => {
  return isPlaying.value
    ? { boxShadow: `0 0 20px ${props.genreColor}40, 0 0 40px ${props.genreColor}20` }
    : { boxShadow: `0 0 10px ${props.genreColor}20` };
});

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

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);

  if (videoA.value) {
    setupProgressTracking(videoA.value);
    videoA.value.addEventListener('timeupdate', onTimeUpdate);
    videoA.value.addEventListener('play', onVideoPlay);
    videoA.value.addEventListener('pause', onVideoPause);
  }
  if (videoB.value) {
    setupProgressTracking(videoB.value);
    videoB.value.addEventListener('timeupdate', onTimeUpdate);
    videoB.value.addEventListener('play', onVideoPlay);
    videoB.value.addEventListener('pause', onVideoPause);
  }
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  if (hideControlsTimer.value !== null) {
    clearTimeout(hideControlsTimer.value);
  }
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden rounded-xl aspect-video bg-midnight"
    :style="glowStyle"
    :class="{ 'glow-pulse': isPlaying }"
    @mousemove="showControls"
    @mouseleave="onMouseLeave"
  >
    <!-- Fallback when song has no video slug -->
    <div
      v-if="!hasVideo"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-12 h-12 opacity-40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"
        />
      </svg>
      <span class="text-sm">No video available</span>
    </div>

    <!-- Video element A -->
    <video
      ref="videoA"
      class="absolute inset-0 w-full h-full object-cover"
      :class="{ 'opacity-100': activeVideo === 'A', 'opacity-0': activeVideo !== 'A' }"
      preload="auto"
      playsinline
    />

    <!-- Video element B -->
    <video
      ref="videoB"
      class="absolute inset-0 w-full h-full object-cover"
      :class="{ 'opacity-100': activeVideo === 'B', 'opacity-0': activeVideo !== 'B' }"
      preload="auto"
      playsinline
    />

    <!-- Controls overlay -->
    <div
      class="controls-overlay absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 flex flex-col gap-2 transition-opacity duration-300"
      :class="isControlsVisible ? 'opacity-100' : 'opacity-0'"
    >
      <!-- Progress bar -->
      <div
        class="w-full h-1 rounded-full bg-white/20 cursor-pointer relative"
        @click="onProgressClick"
      >
        <div
          class="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>

      <!-- Bottom controls row -->
      <div class="flex items-center gap-3">
        <!-- Play / Pause -->
        <button
          class="flex items-center justify-center w-8 h-8 text-white/90 hover:text-white transition-colors"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlayPause"
        >
          <!-- Pause icon -->
          <svg
            v-if="isPlaying"
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              fill-rule="evenodd"
              d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
              clip-rule="evenodd"
            />
          </svg>
          <!-- Play icon -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              fill-rule="evenodd"
              d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        <!-- Volume -->
        <div class="flex items-center gap-1.5 group">
          <!-- Volume icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 text-white/70 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zm5.146 2.752a.75.75 0 011.06.01A9.75 9.75 0 0121.75 12c0 1.93-.561 3.73-1.531 5.238a.75.75 0 01-1.282-.78A8.25 8.25 0 0020.25 12a8.25 8.25 0 00-1.313-4.458.75.75 0 01.01-1.06 .75.75 0 01.699-.67z"
            />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="volume"
            class="volume-slider w-16 accent-primary cursor-pointer"
            @input="onVolumeChange"
          />
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Song title -->
        <span
          v-if="song"
          class="text-xs text-white/60 truncate max-w-[160px]"
        >
          {{ song.title }}
        </span>

        <!-- Fullscreen -->
        <button
          class="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white transition-colors"
          :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          @click="toggleFullscreen"
        >
          <!-- Enter fullscreen icon -->
          <svg
            v-if="!isFullscreen"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
            />
          </svg>
          <!-- Exit fullscreen icon -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-midnight {
  background-color: #0a0b1a;
}

.bg-primary {
  background-color: #4f46e5;
}

.accent-primary {
  accent-color: #4f46e5;
}

/* Gradient overlay behind controls */
.controls-overlay {
  background: linear-gradient(transparent, rgba(10, 11, 26, 0.85));
}

/* Animated glow pulse while playing */
.glow-pulse {
  animation: glowPulse 2.5s ease-in-out infinite;
}

@keyframes glowPulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.08);
  }
}

/* Slim range slider styling */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4f46e5;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4f46e5;
  cursor: pointer;
  border: none;
}
</style>
