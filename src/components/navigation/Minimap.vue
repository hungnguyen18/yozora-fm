<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGalaxyStore } from '@/stores/galaxy';
import { useSongsStore } from '@/stores/songs';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();

const CANVAS_SIZE = 160;
const R_MAX = 500;
const TOTAL_SPAN_YEARS = 46;
const MAX_ANGLE_DEG = 1620;

// Sample every Nth star so we draw ~300-500 dots, not all 9111
const SAMPLE_STEP = 20;

// Genre arm map (must match galaxy store / layout)
const GENRE_ARM_MAP: Record<string, number> = {
  rock: 0,
  electronic: 1,
  pop: 2,
  ballad: 3,
  orchestral: 0,
  other: 2,
};

// Mulberry32 seeded PRNG (must match galaxy store)
const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

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
      const year = song.year ?? 1980;
      const clampedYear = Math.max(1980, Math.min(year, 1980 + TOTAL_SPAN_YEARS));
      const normalised = (clampedYear - 1980) / TOTAL_SPAN_YEARS;

      const baseAngleDeg = normalised * MAX_ANGLE_DEG;
      const baseRadius = R_MAX * (1 - normalised);

      const armIndex = GENRE_ARM_MAP[song.genre ?? 'other'] ?? 2;
      const armOffsetDeg = armIndex * 90;

      const rng = seededRandom(song.id);
      const angleJitterDeg = (rng() * 2 - 1) * 15;
      const radiusJitterPct = (rng() * 2 - 1) * 0.08;

      const angleDeg = baseAngleDeg + armOffsetDeg + angleJitterDeg;
      const angleRad = (angleDeg * Math.PI) / 180;
      const radius = baseRadius * (1 + radiusJitterPct);

      const worldX = radius * Math.cos(angleRad);
      const worldY = radius * Math.sin(angleRad);

      const cx = worldToCanvas(worldX);
      const cy = worldToCanvas(-worldY);

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
      @click="onMinimapClick"
    />
    <span class="minimap-label">Galaxy Map</span>
  </div>
</template>

<style scoped>
.minimap-wrapper {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 20;
  border-radius: 0.625rem;
  overflow: hidden;
  border: 1px solid rgba(79, 70, 229, 0.25);
  background: rgba(20, 21, 41, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(79, 70, 229, 0.06);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.minimap-wrapper:hover {
  border-color: rgba(79, 70, 229, 0.45);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(79, 70, 229, 0.12);
}

.minimap-canvas {
  display: block;
  width: 160px;
  height: 160px;
  cursor: crosshair;
}

.minimap-label {
  display: block;
  text-align: center;
  padding: 0.25rem 0 0.375rem;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.625rem;
  font-weight: 500;
  color: #9b9bb4;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(10, 11, 26, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}
</style>
