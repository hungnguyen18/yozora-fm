<script setup lang="ts">
// GalaxyScene — top-level wrapper: owns pan/zoom state and handles mouse events.
// CameraController (child of TresCanvas) reads this state and applies it to the camera.

import { ref, computed, watch } from 'vue';
import * as THREE from 'three';
import { TresCanvas } from '@tresjs/core';
import type { TresContext } from '@tresjs/core';
import { useGalaxyStore } from '@/stores/galaxy';
import { useStarInteraction } from '@/composables/useStarInteraction';
import CameraController from './CameraController.vue';
import Nebula from './Nebula.vue';
import ParticleDust from './ParticleDust.vue';
import StarField from './StarField.vue';

const galaxyStore = useGalaxyStore();

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 20;

// Camera state shared with CameraController via props
const zoomLevel = ref(1);
const panX = ref(galaxyStore.panX);
const panY = ref(galaxyStore.panY);

// Sync store pan → local refs (minimap click-to-jump writes to store)
watch(
  () => [galaxyStore.panX, galaxyStore.panY] as [number, number],
  ([storeX, storeY]) => {
    panX.value = storeX;
    panY.value = storeY;
  },
);

// Half dimensions for orthographic frustum (pixels, unscaled)
const viewHalfWidth = computed(() => window.innerWidth / 2);
const viewHalfHeight = computed(() => window.innerHeight / 2);

// Pan drag tracking
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

// Ref to the StarField component to access its exposed instancedMesh
const starFieldRef = ref<InstanceType<typeof StarField> | null>(null);

// Active camera ref populated when TresCanvas is ready
const activeCamera = ref<THREE.Camera | null>(null);

// Proxy objects matching the { value: T } shape expected by useStarInteraction
const meshProxy = { get value() { return starFieldRef.value?.instancedMesh ?? null; } };
const cameraProxy = { get value() { return activeCamera.value; } };

const {
  hoveredInstanceId,
  tooltipVisible,
  tooltipX,
  tooltipY,
  tooltipText,
  onMouseMove,
  onClick,
} = useStarInteraction(meshProxy, cameraProxy);

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
  // Always run hover detection regardless of drag state
  onMouseMove(e);

  if (!isDragging.value) { return; }
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  // Invert dx/dy so dragging right moves the view right (pan follows pointer)
  const panScale = 1 / zoomLevel.value;
  panX.value -= dx * panScale;
  panY.value += dy * panScale;
  dragStart.value = { x: e.clientX, y: e.clientY };
  galaxyStore.setPan(panX.value, panY.value);
};

const onPointerUp = () => {
  isDragging.value = false;
};

// Forward click to star interaction handler; ignore if a drag is in progress
const onCanvasClick = (e: MouseEvent) => {
  if (isDragging.value) { return; }
  onClick(e);
};

const onTresReady = (ctx: TresContext) => {
  activeCamera.value = (ctx.camera?.activeCamera?.value as THREE.Camera) ?? null;
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
    @click="onCanvasClick"
  >
    <TresCanvas
      :clear-color="'#0A0B1A'"
      window-size
      @ready="onTresReady"
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
      <StarField
        ref="starFieldRef"
        :hovered-instance-id="hoveredInstanceId"
      />
    </TresCanvas>

    <!-- HTML tooltip overlay: follows the mouse, shows song title on hover -->
    <div
      v-if="tooltipVisible"
      class="tooltip"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >
      {{ tooltipText }}
    </div>
  </div>
</template>

<style scoped>
.galaxy-canvas-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  position: relative;
}

.galaxy-canvas-wrapper:active {
  cursor: grabbing;
}

.tooltip {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  background-color: #0A0B1A;
  color: #E8E8F0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  padding: 0.25rem 0.625rem;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
