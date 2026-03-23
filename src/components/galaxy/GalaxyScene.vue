<script setup lang="ts">
// GalaxyScene — top-level wrapper: owns pan/zoom state and handles mouse events.
// CameraController (child of TresCanvas) reads this state and applies it to the camera.

import { ref, shallowRef, computed, watch } from 'vue';
import * as THREE from 'three';
import { TresCanvas } from '@tresjs/core';
import type { TresContext } from '@tresjs/core';
import { useWindowSize } from '@vueuse/core';
import { useGalaxyStore } from '@/stores/galaxy';
import { useStarInteraction } from '@/composables/useStarInteraction';
import { useStarSpatialIndex } from '@/composables/useStarSpatialIndex';
import { useLOD } from '@/composables/useLOD';
import CameraController from './CameraController.vue';
import ConstellationLines from './ConstellationLines.vue';
import Nebula from './Nebula.vue';
import ParticleDust from './ParticleDust.vue';
import RippleEffect from './RippleEffect.vue';
import DecadeRings from './DecadeRings.vue';
import StarField from './StarField.vue';

const galaxyStore = useGalaxyStore();
const { enableHover, particleCount } = useLOD();
const starSpatialIndex = useStarSpatialIndex();

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 20;

// Camera state shared with CameraController via props
const INITIAL_ZOOM = 3;
const zoomLevel = ref(INITIAL_ZOOM);
const panX = ref(galaxyStore.panX);
const panY = ref(galaxyStore.panY);

// Sync initial zoom to store so flyToStar reads the correct starting zoom
galaxyStore.setZoomLevel(INITIAL_ZOOM);

// Sync store pan + zoom → local refs (minimap click-to-jump and flyToStar write to store)
watch(
  () => [galaxyStore.panX, galaxyStore.panY] as [number, number],
  ([storeX, storeY]) => {
    panX.value = storeX;
    panY.value = storeY;
  },
);

watch(
  () => galaxyStore.zoomLevel,
  (storeZoom) => {
    // Avoid feedback loop: only update if actually different
    if (Math.abs(zoomLevel.value - storeZoom) > 0.001) {
      zoomLevel.value = storeZoom;
    }
  },
);

// Reactive window dimensions for responsive orthographic frustum
const { width: windowWidth, height: windowHeight } = useWindowSize();
const viewHalfWidth = computed(() => windowWidth.value / 2);
const viewHalfHeight = computed(() => windowHeight.value / 2);

// Pan drag tracking — only counts as drag after moving > DRAG_THRESHOLD pixels
const isDragging = ref(false);
const hasDragged = ref(false);
const DRAG_THRESHOLD = 4;
const dragStart = ref({ x: 0, y: 0 });
const pointerDownPos = ref({ x: 0, y: 0 });

// Ref to the StarField component to access its exposed instancedMesh and labels
const starFieldRef = ref<InstanceType<typeof StarField> | null>(null);

// Active camera ref populated when TresCanvas is ready
const activeCamera = shallowRef<THREE.Camera | null>(null);

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
} = useStarInteraction(meshProxy, cameraProxy, starSpatialIndex);

// Star labels computed inside StarField and accessed via template ref
const visibleLabels = computed(() => starFieldRef.value?.visibleLabels ?? []);

// Build spatial index when StarField provides world positions
watch(
  () => starFieldRef.value?.listStarWorldPosition,
  (positions) => {
    if (positions && positions.length > 0) {
      starSpatialIndex.build(positions);
    }
  },
);

// Cursor style: pointer when hovering a star, grab otherwise
const cursorStyle = computed(() =>
  hoveredInstanceId.value !== null ? 'pointer' : 'grab',
);

const onWheel = (e: WheelEvent) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomLevel.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel.value * factor));
  galaxyStore.setZoomLevel(zoomLevel.value);
};

const onPointerDown = (e: PointerEvent) => {
  isDragging.value = true;
  hasDragged.value = false;
  dragStart.value = { x: e.clientX, y: e.clientY };
  pointerDownPos.value = { x: e.clientX, y: e.clientY };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
};

const onPointerMove = (e: PointerEvent) => {
  // Only run hover detection when LOD tier allows it
  if (enableHover.value) {
    onMouseMove(e);
  }

  if (!isDragging.value) { return; }

  // Check if movement exceeds threshold before starting pan
  if (!hasDragged.value) {
    const totalDx = e.clientX - pointerDownPos.value.x;
    const totalDy = e.clientY - pointerDownPos.value.y;
    if (totalDx * totalDx + totalDy * totalDy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
      return;
    }
    hasDragged.value = true;
  }

  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  const panScale = 1 / zoomLevel.value;
  panX.value -= dx * panScale;
  panY.value += dy * panScale;
  dragStart.value = { x: e.clientX, y: e.clientY };
  galaxyStore.setPan(panX.value, panY.value);
};

const onPointerUp = () => {
  isDragging.value = false;
};

// Forward click to star interaction handler; ignore if user actually dragged
const onCanvasClick = (e: MouseEvent) => {
  if (hasDragged.value) { return; }
  onClick(e);
};

const onTresReady = (ctx: TresContext) => {
  activeCamera.value = (ctx.camera?.activeCamera?.value as THREE.Camera) ?? null;
};
</script>

<template>
  <div
    class="galaxy-canvas-wrapper"
    :style="{ cursor: cursorStyle }"
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
      <ParticleDust :particle-count="particleCount" />

      <!-- Decade ring indicators behind stars -->
      <DecadeRings />

      <!-- Star field: all songs rendered as a single InstancedMesh -->
      <StarField
        ref="starFieldRef"
        :hovered-instance-id="hoveredInstanceId"
        :camera="activeCamera"
      />

      <!-- Ripple rings: expanding concentric rings around the currently playing star -->
      <RippleEffect />

      <!-- Constellation lines: connects stars of the same artist, revealed on hover -->
      <ConstellationLines />
    </TresCanvas>

    <!-- HTML tooltip overlay: follows the mouse, shows song title on hover -->
    <div
      v-if="tooltipVisible"
      class="tooltip"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >
      {{ tooltipText }}
    </div>

    <!-- HTML star label overlays: rendered at mid/close LOD tiers -->
    <div
      v-for="label in visibleLabels"
      :key="label.songId"
      class="star-label"
      :style="{ left: label.x + 'px', top: label.y + 'px' }"
    >
      {{ label.text }}
    </div>
  </div>
</template>

<style scoped>
.galaxy-canvas-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  user-select: none;
  position: relative;
}

.galaxy-canvas-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(10, 11, 26, 0.6) 100%);
  z-index: 1;
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

.star-label {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  font-size: 0.625rem;
  line-height: 1;
  color: rgba(232, 232, 240, 0.85);
  transform: translate(8px, -50%);
  white-space: nowrap;
  text-shadow:
    0 0 4px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(0, 0, 0, 0.7),
    0 1px 2px rgba(0, 0, 0, 0.8);
  background: rgba(10, 11, 26, 0.5);
  padding: 1px 4px;
  border-radius: 2px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
