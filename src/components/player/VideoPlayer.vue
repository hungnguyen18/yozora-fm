<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Maximize, Minimize, Pause, Play, Volume2, Video } from 'lucide-vue-next';
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
      <Video :size="48" class="opacity-40" />
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
          <Pause v-if="isPlaying" :size="20" fill="currentColor" />
          <!-- Play icon -->
          <Play v-else :size="20" fill="currentColor" />
        </button>

        <!-- Volume -->
        <div class="flex items-center gap-1.5 group">
          <!-- Volume icon -->
          <Volume2 :size="16" class="text-white/70 flex-shrink-0" />
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
          <Maximize v-if="!isFullscreen" :size="16" />
          <!-- Exit fullscreen icon -->
          <Minimize v-else :size="16" />
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
