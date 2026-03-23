<script setup lang="ts">
// CameraController — must be rendered inside TresCanvas so useTresContext is available.
// It applies zoom and pan props to the active OrthographicCamera every frame via useLoop.

import { watch } from 'vue';
import { useTresContext, useLoop } from '@tresjs/core';
import * as THREE from 'three';

const props = defineProps<{
  zoom: number;
  panX: number;
  panY: number;
  viewHalfWidth: number;
  viewHalfHeight: number;
}>();

const { camera } = useTresContext();
const { onBeforeRender } = useLoop();

const applyToCamera = (cam: THREE.Camera | undefined | null) => {
  if (!cam || !(cam instanceof THREE.OrthographicCamera)) { return; }
  cam.zoom = props.zoom;
  cam.position.x = props.panX;
  cam.position.y = props.panY;
  cam.left = -props.viewHalfWidth;
  cam.right = props.viewHalfWidth;
  cam.top = props.viewHalfHeight;
  cam.bottom = -props.viewHalfHeight;
  cam.updateProjectionMatrix();
};

onBeforeRender(() => {
  applyToCamera(camera.activeCamera.value);
});

// Also update immediately when the active camera reference changes
watch(camera.activeCamera, (cam) => {
  applyToCamera(cam);
}, { immediate: true });
</script>

<template>
  <!-- No visual output; this is a logic-only component -->
  <TresOrthographicCamera
    :position="[0, 0, 1000]"
    :near="0.1"
    :far="5000"
  />
</template>
