<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGalaxyStore } from '@/stores/galaxy';

const galaxyStore = useGalaxyStore();

const CANVAS_SIZE = 150;
// Galaxy radius in world units — matches R_MAX in galaxy store
const R_MAX = 500;

const canvasRef = ref<HTMLCanvasElement | null>(null);

// Map world coordinates [-R_MAX, R_MAX] -> canvas pixels [0, CANVAS_SIZE]
const worldToCanvas = (worldVal: number): number =>
  ((worldVal + R_MAX) / (R_MAX * 2)) * CANVAS_SIZE;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) { return; }

  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw background
  ctx.fillStyle = 'rgba(10, 11, 26, 0.85)';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw stars as 1px colored dots
  const listStar = galaxyStore.listStarPosition;
  for (let i = 0; i < listStar.length; i += 1) {
    const star = listStar[i];
    const cx = worldToCanvas(star.x);
    const cy = worldToCanvas(-star.y); // flip Y: canvas Y grows down, world Y grows up

    ctx.fillStyle = 'rgba(192, 192, 208, 0.7)';
    ctx.fillRect(cx, cy, 1.5, 1.5);
  }

  // Draw viewport rectangle: compute visible world bounds from pan + zoom
  const zoom = galaxyStore.zoomLevel;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  // Half-size of visible world area (orthographic)
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
  // Pixel position within the canvas
  const clickX = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
  const clickY = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height);

  // Convert canvas pixel -> world coordinates
  const worldX = (clickX / CANVAS_SIZE) * R_MAX * 2 - R_MAX;
  const worldY = -((clickY / CANVAS_SIZE) * R_MAX * 2 - R_MAX); // flip Y back

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
  width: 150px;
  height: 150px;
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
