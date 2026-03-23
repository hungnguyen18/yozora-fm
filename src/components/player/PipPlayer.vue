<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useDraggable } from '@vueuse/core';
import { Play, Pause, SkipForward, Volume2, Maximize2 } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { usePlayer } from '@/composables/usePlayer';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const { videoA, videoB, activeVideo, setVolume } = usePlayer();

const song = computed(() => playerStore.currentSong);
const isVisible = computed(
  () => playerStore.isPip && song.value !== null,
);

// Song transition key for crossfade animations
const songTransitionKey = computed(() => song.value?.id ?? 0);

// Cover art loading state for shimmer
const isCoverLoading = ref(true);

const onCoverLoad = () => {
  isCoverLoading.value = false;
};

watch(
  () => song.value?.id,
  () => {
    isCoverLoading.value = true;
  },
);

// Draggable positioning — above the era dial bar at the bottom
const pipRef = ref<HTMLElement | null>(null);
const initialX = computed(() => Math.round(window.innerWidth / 2 - 200));
// Era dial is ~70px tall at bottom: 1.75rem (~28px). PiP sits above it.
const initialY = computed(() => window.innerHeight - 170);
const { style: draggableStyle } = useDraggable(pipRef, {
  initialValue: { x: initialX.value, y: initialY.value },
});

// Volume slider — click-to-toggle (more reliable than hover with draggable)
const isVolumeOpen = ref(false);
const volumeWrapperRef = ref<HTMLElement | null>(null);

const toggleVolume = (): void => {
  isVolumeOpen.value = !isVolumeOpen.value;
};

// Close volume slider when clicking outside
const onDocumentClick = (event: MouseEvent): void => {
  if (!isVolumeOpen.value) {
    return;
  }
  const wrapper = volumeWrapperRef.value;
  if (wrapper && !wrapper.contains(event.target as Node)) {
    isVolumeOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true);
});

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

const getMainVideoEl = (): HTMLVideoElement | null => {
  return activeVideo.value === 'A' ? videoA.value : videoB.value;
};

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true);
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
    galaxyStore.flyToStar(song.value.id);
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
      <!-- Main content row -->
      <div class="pip-body">
        <!-- Thumbnail with crossfade -->
        <div
          class="pip-thumbnail"
          :style="{ borderColor: genreColor + '80' }"
        >
          <Transition name="pip-cover-crossfade" mode="out-in">
            <div :key="songTransitionKey" class="pip-thumbnail__wrapper">
              <!-- Shimmer while loading -->
              <div
                v-if="coverUrl && isCoverLoading"
                class="pip-thumbnail__shimmer"
              >
                <div class="pip-thumbnail__shimmer-wave" />
              </div>
              <img
                v-if="coverUrl"
                :src="coverUrl"
                :alt="song?.title ?? 'Cover'"
                class="pip-thumbnail__img"
                :class="{ 'pip-thumbnail__img--loading': isCoverLoading }"
                @load="onCoverLoad"
              />
              <div
                v-else
                class="pip-thumbnail__fallback"
                :style="{ background: genreColor + '30' }"
              >
                <Play :size="16" :color="genreColor" />
              </div>
            </div>
          </Transition>
        </div>

        <!-- Song info with slide-in from right -->
        <Transition name="pip-info-slide" mode="out-in">
          <div
            v-if="song"
            :key="songTransitionKey"
            class="pip-info"
          >
            <p class="pip-info__title">{{ song.title }}</p>
            <p class="pip-info__artist">{{ song.artist?.name ?? `Artist #${song.artist_id}` }}</p>
          </div>
        </Transition>

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

          <!-- Volume — click-to-toggle -->
          <div
            ref="volumeWrapperRef"
            class="pip-volume-wrapper"
          >
            <button
              class="pip-btn"
              aria-label="Volume"
              @click.stop="toggleVolume"
            >
              <Volume2 :size="14" />
            </button>
            <Transition name="pip-volume-slide">
              <div
                v-if="isVolumeOpen"
                class="pip-volume-slider"
                @mousedown.stop
                @click.stop
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="playerStore.volume"
                  class="pip-volume-input"
                  @input="handleVolumeChange"
                  @mousedown.stop
                  @pointerdown.stop
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

.pip-thumbnail__wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.pip-thumbnail__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.3s ease;
}

.pip-thumbnail__img--loading {
  opacity: 0;
}

/* Thumbnail shimmer */
.pip-thumbnail__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1a1b35 0%, #141529 100%);
  overflow: hidden;
  z-index: 1;
}

.pip-thumbnail__shimmer-wave {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(155, 155, 180, 0.08) 40%,
    rgba(155, 155, 180, 0.15) 50%,
    rgba(155, 155, 180, 0.08) 60%,
    transparent 100%
  );
  animation: pipShimmer 1.2s ease-in-out infinite;
}

@keyframes pipShimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.pip-thumbnail__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Cover art crossfade transition */
.pip-cover-crossfade-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pip-cover-crossfade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.pip-cover-crossfade-enter-from,
.pip-cover-crossfade-leave-to {
  opacity: 0;
}

.pip-cover-crossfade-enter-to,
.pip-cover-crossfade-leave-from {
  opacity: 1;
}

/* Song info slide-in from right transition */
.pip-info-slide-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pip-info-slide-leave-active {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.pip-info-slide-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.pip-info-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.pip-info-slide-enter-to,
.pip-info-slide-leave-from {
  opacity: 1;
  transform: translateX(0);
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
  margin-bottom: 4px;
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
