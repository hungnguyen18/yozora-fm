<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useDraggable } from '@vueuse/core';
import { Play, Pause, SkipForward, Volume2, Maximize2 } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { usePlayer } from '@/composables/usePlayer';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const { videoA, videoB, activeVideo, setVolume, getVideoUrl } = usePlayer();

const song = computed(() => playerStore.currentSong);
const isVisible = computed(
  () => playerStore.isPip && song.value !== null,
);

// Draggable positioning — bottom-center of screen
const pipRef = ref<HTMLElement | null>(null);
const initialX = computed(() => Math.round(window.innerWidth / 2 - 200));
const { style: draggableStyle } = useDraggable(pipRef, {
  initialValue: { x: initialX.value, y: window.innerHeight - 100 },
});

// Volume slider hover state
const isVolumeHovered = ref(false);

// Genre glow color
const genreColor = computed(() => {
  const genre = (song.value?.genre as TGenre) || 'other';
  return GENRE_COLOR_MAP[genre] || GENRE_COLOR_MAP.other;
});

// Cover art URL — prefer album_art_url, fall back to anime cover
const coverUrl = computed(() => {
  if (!song.value) {
    return null;
  }
  return song.value.album_art_url
    || song.value.anime?.cover_url
    || null;
});

// Mirror video element for PiP
const pipVideoRef = ref<HTMLVideoElement | null>(null);
let syncInterval: ReturnType<typeof setInterval> | null = null;

const getMainVideoEl = (): HTMLVideoElement | null => {
  return activeVideo.value === 'A' ? videoA.value : videoB.value;
};

const startPip = (): void => {
  const pipVideo = pipVideoRef.value;
  if (!pipVideo || !song.value) {
    return;
  }

  const url = getVideoUrl(song.value);
  if (!url) {
    return;
  }

  pipVideo.src = url;
  pipVideo.volume = 0;
  pipVideo.muted = true;

  const mainVideo = getMainVideoEl();
  if (mainVideo && mainVideo.currentTime > 0) {
    pipVideo.currentTime = mainVideo.currentTime;
  }

  pipVideo.play().catch(() => {
    // autoplay may be blocked; ignore
  });

  syncInterval = setInterval(() => {
    const main = getMainVideoEl();
    const pip = pipVideoRef.value;
    if (!main || !pip) {
      return;
    }
    const drift = Math.abs(pip.currentTime - main.currentTime);
    if (drift > 2) {
      pip.currentTime = main.currentTime;
    }
  }, 2000);
};

const stopPip = (): void => {
  if (syncInterval !== null) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  const pipVideo = pipVideoRef.value;
  if (pipVideo) {
    pipVideo.pause();
    pipVideo.src = '';
  }
};

watch(isVisible, (visible) => {
  if (visible) {
    setTimeout(startPip, 50);
  } else {
    stopPip();
  }
});

onUnmounted(() => {
  stopPip();
});

// Actions
const togglePlay = (): void => {
  if (playerStore.isPlaying) {
    playerStore.pause();
  } else {
    playerStore.resume();
  }
};

const skipNext = (): void => {
  playerStore.next();
};

const expand = (): void => {
  if (song.value) {
    galaxyStore.selectedSongId = song.value.id;
  }
  playerStore.isPip = false;
};

const handleVolumeChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  setVolume(parseFloat(target.value));
};

const handleProgressClick = (event: MouseEvent): void => {
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const mainVideo = getMainVideoEl();
  if (mainVideo && mainVideo.duration) {
    mainVideo.currentTime = ratio * mainVideo.duration;
    playerStore.setProgress(ratio);
  }
};

// Format progress as mm:ss / mm:ss
const timeDisplay = computed(() => {
  const mainVideo = getMainVideoEl();
  if (!mainVideo || !mainVideo.duration) {
    return '';
  }
  const current = mainVideo.duration * playerStore.progress;
  const total = mainVideo.duration;
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  return `${formatTime(current)} / ${formatTime(total)}`;
});
</script>

<template>
  <Transition name="pip-appear">
    <div
      v-if="isVisible"
      ref="pipRef"
      class="pip-container"
      :style="draggableStyle"
    >
      <!-- Hidden video element for sync -->
      <video
        ref="pipVideoRef"
        class="pip-video-hidden"
        playsinline
        muted
        loop
      />

      <!-- Main content row -->
      <div class="pip-body">
        <!-- Thumbnail -->
        <div
          class="pip-thumbnail"
          :style="{ borderColor: genreColor + '80' }"
        >
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="song?.title ?? 'Cover'"
            class="pip-thumbnail__img"
          />
          <div
            v-else
            class="pip-thumbnail__fallback"
            :style="{ background: genreColor + '30' }"
          >
            <Play :size="16" :color="genreColor" />
          </div>
        </div>

        <!-- Song info -->
        <div
          v-if="song"
          class="pip-info"
        >
          <p class="pip-info__title">{{ song.title }}</p>
          <p class="pip-info__artist">{{ song.artist?.name ?? `Artist #${song.artist_id}` }}</p>
        </div>

        <!-- Controls -->
        <div class="pip-controls">
          <!-- Play / Pause -->
          <button
            class="pip-btn"
            :aria-label="playerStore.isPlaying ? 'Pause' : 'Play'"
            @click.stop="togglePlay"
          >
            <Pause v-if="playerStore.isPlaying" :size="16" />
            <Play v-else :size="16" />
          </button>

          <!-- Skip next -->
          <button
            class="pip-btn"
            aria-label="Next song"
            @click.stop="skipNext"
          >
            <SkipForward :size="14" />
          </button>

          <!-- Volume -->
          <div
            class="pip-volume-wrapper"
            @mouseenter="isVolumeHovered = true"
            @mouseleave="isVolumeHovered = false"
          >
            <button
              class="pip-btn"
              aria-label="Volume"
              @click.stop
            >
              <Volume2 :size="14" />
            </button>
            <Transition name="pip-volume-slide">
              <div
                v-if="isVolumeHovered"
                class="pip-volume-slider"
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="playerStore.volume"
                  class="pip-volume-input"
                  @input="handleVolumeChange"
                  @click.stop
                />
              </div>
            </Transition>
          </div>

          <!-- Expand -->
          <button
            class="pip-btn"
            aria-label="Expand player"
            @click.stop="expand"
          >
            <Maximize2 :size="14" />
          </button>
        </div>
      </div>

      <!-- Progress bar -->
      <div
        class="pip-progress"
        @click.stop="handleProgressClick"
      >
        <div
          class="pip-progress__fill"
          :style="{
            width: `${playerStore.progress * 100}%`,
            background: genreColor,
          }"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pip-container {
  position: fixed;
  width: 400px;
  z-index: 9999;
  cursor: grab;
  user-select: none;
  background: #141529;
  border: 1px solid rgba(232, 232, 240, 0.1);
  border-radius: 12px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(232, 232, 240, 0.05);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.pip-container:active {
  cursor: grabbing;
}

.pip-video-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* Main body row */
.pip-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

/* Thumbnail */
.pip-thumbnail {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid rgba(232, 232, 240, 0.15);
}

.pip-thumbnail__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pip-thumbnail__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Song info */
.pip-info {
  flex: 1;
  min-width: 0;
  padding-right: 4px;
}

.pip-info__title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #E8E8F0;
  margin: 0 0 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.pip-info__artist {
  font-size: 0.7rem;
  color: rgba(232, 232, 240, 0.55);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

/* Controls */
.pip-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.pip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(232, 232, 240, 0.7);
  transition: background 0.15s, color 0.15s;
  padding: 0;
}

.pip-btn:hover {
  background: rgba(232, 232, 240, 0.1);
  color: #E8E8F0;
}

/* Volume wrapper */
.pip-volume-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.pip-volume-slider {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #141529;
  border: 1px solid rgba(232, 232, 240, 0.12);
  border-radius: 8px;
  padding: 12px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.pip-volume-input {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 4px;
  height: 80px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.pip-volume-input::-webkit-slider-runnable-track {
  width: 4px;
  height: 80px;
  background: rgba(232, 232, 240, 0.15);
  border-radius: 2px;
}

.pip-volume-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #E8E8F0;
  margin-left: -4px;
  cursor: pointer;
}

.pip-volume-input::-moz-range-track {
  width: 4px;
  height: 80px;
  background: rgba(232, 232, 240, 0.15);
  border-radius: 2px;
  border: none;
}

.pip-volume-input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #E8E8F0;
  border: none;
  cursor: pointer;
}

/* Progress bar */
.pip-progress {
  width: 100%;
  height: 3px;
  background: rgba(232, 232, 240, 0.08);
  cursor: pointer;
  transition: height 0.15s;
}

.pip-progress:hover {
  height: 5px;
}

.pip-progress__fill {
  height: 100%;
  border-radius: 0 1px 0 0;
  transition: width 0.1s linear;
}

/* Transitions */
.pip-appear-enter-active,
.pip-appear-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.pip-appear-enter-from,
.pip-appear-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.pip-appear-enter-to,
.pip-appear-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Volume slider transition */
.pip-volume-slide-enter-active,
.pip-volume-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.pip-volume-slide-enter-from,
.pip-volume-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.pip-volume-slide-enter-to,
.pip-volume-slide-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Responsive — narrower on small screens */
@media (max-width: 480px) {
  .pip-container {
    width: calc(100vw - 24px);
    left: 12px !important;
  }
}
</style>
