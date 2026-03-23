<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useDraggable } from '@vueuse/core';
import { ArrowUpRight, X } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';
import { usePlayer } from '@/composables/usePlayer';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const { videoA, videoB, activeVideo, getVideoUrl } = usePlayer();

const song = computed(() => playerStore.currentSong);
const isVisible = computed(
  () => playerStore.isPip && playerStore.isPlaying && song.value !== null,
);

// Draggable positioning
const pipRef = ref<HTMLElement | null>(null);
const { style: draggableStyle } = useDraggable(pipRef, {
  initialValue: { x: 20, y: window.innerHeight - 200 },
});

// Genre glow color
const genreColor = computed(() => {
  const genre = (song.value?.genre as TGenre) || 'other';
  return GENRE_COLOR_MAP[genre] || GENRE_COLOR_MAP.other;
});

const glowStyle = computed(() => ({
  boxShadow: `0 0 0 2px ${genreColor.value}80, 0 0 20px ${genreColor.value}40`,
}));

// Mirror video element for PiP
const pipVideoRef = ref<HTMLVideoElement | null>(null);
let syncInterval: ReturnType<typeof setInterval> | null = null;

// Get the current active main video element via shared singleton refs
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
  pipVideo.volume = 0; // muted — main player handles audio
  pipVideo.muted = true;

  // Seek to current position then play
  const mainVideo = getMainVideoEl();
  if (mainVideo && mainVideo.currentTime > 0) {
    pipVideo.currentTime = mainVideo.currentTime;
  }

  pipVideo.play().catch(() => {
    // autoplay may be blocked; ignore
  });

  // Keep pip in sync with main player every 2s
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
    // Allow DOM to render before accessing the video ref
    setTimeout(startPip, 50);
  } else {
    stopPip();
  }
});

onUnmounted(() => {
  stopPip();
});

const close = (): void => {
  playerStore.stop();
};

const expand = (): void => {
  playerStore.isPip = false;
};
</script>

<template>
  <Transition name="pip-appear">
    <div
      v-if="isVisible"
      ref="pipRef"
      class="pip-container"
      :style="draggableStyle"
    >
      <!-- Top-right action buttons -->
      <div class="pip-actions">
        <button
          class="pip-btn"
          aria-label="Expand player"
          @click.stop="expand"
        >
          <ArrowUpRight :size="12" />
        </button>
        <button
          class="pip-btn"
          aria-label="Close player"
          @click.stop="close"
        >
          <X :size="12" />
        </button>
      </div>

      <!-- Video area -->
      <div
        class="pip-video-wrapper"
        :style="glowStyle"
      >
        <video
          ref="pipVideoRef"
          class="pip-video"
          playsinline
          muted
          loop
        />
      </div>

      <!-- Song info -->
      <div
        v-if="song"
        class="pip-info"
      >
        <p class="pip-info__title">{{ song.title }}</p>
        <p class="pip-info__artist">{{ song.artist?.name ?? `Artist #${song.artist_id}` }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pip-container {
  position: fixed;
  width: 240px;
  z-index: 30;
  cursor: grab;
  user-select: none;
}

.pip-container:active {
  cursor: grabbing;
}

/* Action buttons row */
.pip-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  z-index: 1;
}

.pip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(10, 11, 26, 0.7);
  border: none;
  cursor: pointer;
  color: rgba(232, 232, 240, 0.8);
  transition: background 0.2s, color 0.2s;
  padding: 0;
}

.pip-btn:hover {
  background: rgba(10, 11, 26, 0.95);
  color: #E8E8F0;
}

.pip-btn__icon {
  width: 12px;
  height: 12px;
}

/* Video area — 16:9 → 240×135 */
.pip-video-wrapper {
  width: 240px;
  height: 135px;
  border-radius: 8px;
  overflow: hidden;
  background-color: #0A0B1A;
}

.pip-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Song info below video */
.pip-info {
  padding: 6px 4px 2px;
}

.pip-info__title {
  font-size: 0.7rem;
  color: #E8E8F0;
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 232px;
  font-weight: 600;
}

.pip-info__artist {
  font-size: 0.65rem;
  color: rgba(232, 232, 240, 0.55);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 232px;
}

/* Appear / disappear transition */
.pip-appear-enter-active,
.pip-appear-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.pip-appear-enter-from,
.pip-appear-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.pip-appear-enter-to,
.pip-appear-leave-from {
  opacity: 1;
  transform: scale(1);
}
</style>
