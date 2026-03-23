<script setup lang="ts">
// GalaxyScene — top-level wrapper: owns pan/zoom state and handles mouse events.
// CameraController (child of TresCanvas) reads this state and applies it to the camera.

import { ref, computed } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { useGalaxyStore } from '@/stores/galaxy';
import CameraController from './CameraController.vue';
import Nebula from './Nebula.vue';
import ParticleDust from './ParticleDust.vue';
import StarField from './StarField.vue';

const galaxyStore = useGalaxyStore();

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 20;

// Camera state shared with CameraController via props
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);

// Half dimensions for orthographic frustum (pixels, unscaled)
const viewHalfWidth = computed(() => window.innerWidth / 2);
const viewHalfHeight = computed(() => window.innerHeight / 2);

// Pan drag tracking
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

const onWheel = (e: WheelEvent) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomLevel.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel.value * factor));
  galaxyStore.setZoomLevel(zoomLevel.value);
};

const onPointerDown = (e: PointerEvent) => {
  isDragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
};

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging.value) { return; }
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  // Invert dx/dy so dragging right moves the view right (pan follows pointer)
  const panScale = 1 / zoomLevel.value;
  panX.value -= dx * panScale;
  panY.value += dy * panScale;
  dragStart.value = { x: e.clientX, y: e.clientY };
};

const onPointerUp = () => {
  isDragging.value = false;
};
</script>

<template>
  <div
    class="galaxy-canvas-wrapper"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <TresCanvas
      :clear-color="'#0A0B1A'"
      window-size
    >
      <!-- CameraController lives inside TresCanvas so it can call useTresContext -->
      <CameraController
        :zoom="zoomLevel"
        :pan-x="panX"
        :pan-y="panY"
        :view-half-width="viewHalfWidth"
        :view-half-height="viewHalfHeight"
      />

      <TresAmbientLight :intensity="0.5" />

      <!-- Background atmosphere (renders behind stars) -->
      <Nebula />
      <ParticleDust />

      <!-- Star field: all songs rendered as a single InstancedMesh -->
      <StarField />
    </TresCanvas>
  </div>
</template>

<style scoped>
.galaxy-canvas-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.galaxy-canvas-wrapper:active {
  cursor: grabbing;
}
</style>
