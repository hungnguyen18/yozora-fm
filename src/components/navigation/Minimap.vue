<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGalaxyStore } from '@/stores/galaxy';
import { useSongsStore } from '@/stores/songs';
import { useExplorerPassport } from '@/composables/useExplorerPassport';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();
const { grid, GRID_SIZE: PASSPORT_GRID_SIZE } = useExplorerPassport();
const { computeSinglePosition } = useGalaxyLayout();

const CANVAS_SIZE = 100;
const R_MAX = 500;
const TOTAL_SPAN_YEARS = 46;

// Sample every Nth star so we draw ~300-500 dots, not all 9111
const SAMPLE_STEP = 20;

const canvasRef = ref<HTMLCanvasElement | null>(null);

// Map world coordinates [-R_MAX, R_MAX] -> canvas pixels [0, CANVAS_SIZE]
const worldToCanvas = (worldVal: number): number =>
  ((worldVal + R_MAX) / (R_MAX * 2)) * CANVAS_SIZE;

// Decade ring definitions
const LIST_DECADE = [
  { year: 1980, label: '80s' },
  { year: 1990, label: '90s' },
  { year: 2000, label: '00s' },
  { year: 2010, label: '10s' },
  { year: 2020, label: '20s' },
];

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) { return; }

  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw background
  ctx.fillStyle = 'rgba(10, 11, 26, 0.85)';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const centerPx = CANVAS_SIZE / 2;

  // Draw decade ring circles
  ctx.lineWidth = 0.5;
  for (let i = 0; i < LIST_DECADE.length; i += 1) {
    const decade = LIST_DECADE[i];
    const worldRadius = R_MAX * (1 - (decade.year - 1980) / TOTAL_SPAN_YEARS);
    const canvasRadius = (worldRadius / (R_MAX * 2)) * CANVAS_SIZE;

    // Ring circle
    ctx.strokeStyle = 'rgba(79, 70, 229, 0.2)';
    ctx.beginPath();
    ctx.arc(centerPx, centerPx, canvasRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Label positioned at top of ring
    ctx.fillStyle = 'rgba(155, 155, 180, 0.6)';
    ctx.font = '7px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(decade.label, centerPx, centerPx - canvasRadius - 1);
  }

  // Draw sampled stars as colored dots
  const listSong = songsStore.listSong;
  if (listSong.length > 0) {
    for (let i = 0; i < listSong.length; i += SAMPLE_STEP) {
      const song = listSong[i];
      const pos = computeSinglePosition(
        song.id,
        song.year ?? 1980,
        song.genre as TGenre | undefined,
      );

      const cx = worldToCanvas(pos.x);
      const cy = worldToCanvas(-pos.y);

      const genreKey = (song.genre ?? 'other') as TGenre;
      const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;

      ctx.fillStyle = hexColor;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(cx, cy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  } else {
    // Fallback: draw from pre-computed star positions (gray dots)
    const listStar = galaxyStore.listStarPosition;
    for (let i = 0; i < listStar.length; i += SAMPLE_STEP) {
      const star = listStar[i];
      const cx = worldToCanvas(star.x);
      const cy = worldToCanvas(-star.y);

      ctx.fillStyle = 'rgba(192, 192, 208, 0.7)';
      ctx.fillRect(cx, cy, 1.5, 1.5);
    }
  }

  // Draw fog of war overlay
  const cellPx = CANVAS_SIZE / PASSPORT_GRID_SIZE;
  for (let cy = 0; cy < PASSPORT_GRID_SIZE; cy += 1) {
    for (let cx = 0; cx < PASSPORT_GRID_SIZE; cx += 1) {
      if (grid.value[cy * PASSPORT_GRID_SIZE + cx] === 0) {
        ctx.fillStyle = 'rgba(10, 11, 26, 0.6)';
        ctx.fillRect(cx * cellPx, cy * cellPx, cellPx, cellPx);
      }
    }
  }

  // Draw viewport rectangle
  const zoom = galaxyStore.zoomLevel;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const halfWorldW = (screenW / 2) / zoom;
  const halfWorldH = (screenH / 2) / zoom;

  const vpLeft = worldToCanvas(galaxyStore.panX - halfWorldW);
  const vpTop = worldToCanvas(-(galaxyStore.panY + halfWorldH));
  const vpWidth = (halfWorldW * 2 / (R_MAX * 2)) * CANVAS_SIZE;
  const vpHeight = (halfWorldH * 2 / (R_MAX * 2)) * CANVAS_SIZE;

  // Viewport fill
  ctx.fillStyle = 'rgba(79, 70, 229, 0.08)';
  ctx.fillRect(vpLeft, vpTop, vpWidth, vpHeight);

  // Viewport stroke
  ctx.strokeStyle = 'rgba(79, 70, 229, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vpLeft, vpTop, vpWidth, vpHeight);
};

onMounted(() => {
  draw();
});

// Redraw whenever relevant store state changes
watch(
  () => [
    galaxyStore.listStarPosition.length,
    songsStore.listSong.length,
    galaxyStore.panX,
    galaxyStore.panY,
    galaxyStore.zoomLevel,
    grid.value,
  ],
  () => { draw(); },
);

const onMinimapClick = (e: MouseEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) { return; }

  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
  const clickY = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height);

  const worldX = (clickX / CANVAS_SIZE) * R_MAX * 2 - R_MAX;
  const worldY = -((clickY / CANVAS_SIZE) * R_MAX * 2 - R_MAX);

  galaxyStore.setPan(worldX, worldY);
};
</script>

<template>
  <div class="minimap-wrapper">
    <canvas
      ref="canvasRef"
      :width="CANVAS_SIZE"
      :height="CANVAS_SIZE"
      class="minimap-canvas"
      title="Click to jump camera"
      tabindex="0"
      role="button"
      aria-label="Galaxy minimap — click to jump camera"
      @click="onMinimapClick"
      @keydown.enter="onMinimapClick($event as any)"
      @keydown.space.prevent="onMinimapClick($event as any)"
    />
    <span class="minimap-label">Galaxy Map</span>
  </div>
</template>

<style scoped>
/* Minimap — bottom-right, compact, above genre legend */
.minimap-wrapper {
  position: fixed;
  bottom: 1.75rem;
  right: 0.75rem;
  z-index: 20;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(155, 155, 180, 0.08);
  background: rgba(13, 14, 34, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  transition: border-color 0.2s ease;
}

.minimap-wrapper:hover {
  border-color: rgba(155, 155, 180, 0.2);
}

.minimap-canvas {
  display: block;
  width: 100px;
  height: 100px;
  cursor: crosshair;
}

.minimap-canvas:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.minimap-label {
  display: none;
}
</style>
