<script setup lang="ts">
// ParticleDust — floating particles scattered across the scene.
// Creates depth and atmosphere without distracting from the star field.
// Particle count is driven by the LOD tier from the parent (GalaxyScene).

import { shallowRef, watch, onMounted, onBeforeUnmount } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';

const props = defineProps<{
  particleCount?: number;
}>();

// Default count used before any LOD prop is received
const DEFAULT_PARTICLE_COUNT = 3000;

const pointsRef = shallowRef<THREE.Points | null>(null);

// Per-particle drift velocity stored as flat Float32Array: [vx0, vy0, vx1, vy1, ...]
let listVelocity: Float32Array = new Float32Array(0);
// Track the active count so the render loop uses the right bound
let activeCount = 0;

const buildPoints = (count: number): void => {
  // Dispose previous geometry/material before recreating
  if (pointsRef.value) {
    pointsRef.value.geometry.dispose();
    (pointsRef.value.material as THREE.PointsMaterial).dispose();
    pointsRef.value = null;
  }

  activeCount = count;
  const geometry = new THREE.BufferGeometry();
  const listPosition = new Float32Array(count * 3);
  listVelocity = new Float32Array(count * 2);

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    listPosition[idx]     = (Math.random() - 0.5) * 1200; // x ∈ [-600, 600]
    listPosition[idx + 1] = (Math.random() - 0.5) * 1200; // y ∈ [-600, 600]
    listPosition[idx + 2] = -20 + Math.random() * 15;      // z ∈ [-20, -5]

    const velIdx = i * 2;
    // Slow random drift in x and y; magnitude 0.01–0.05
    listVelocity[velIdx]     = (Math.random() - 0.5) * 0.1; // vx
    listVelocity[velIdx + 1] = (Math.random() - 0.5) * 0.1; // vy
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(listPosition, 3));

  const material = new THREE.PointsMaterial({
    size: 1,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: '#E8E8F0',
    sizeAttenuation: false,
  });

  pointsRef.value = new THREE.Points(geometry, material);
};

onMounted(() => {
  buildPoints(props.particleCount ?? DEFAULT_PARTICLE_COUNT);
});

onBeforeUnmount(() => {
  if (!pointsRef.value) { return; }
  pointsRef.value.geometry.dispose();
  (pointsRef.value.material as THREE.PointsMaterial).dispose();
});

// Rebuild geometry when the LOD-driven count changes
watch(
  () => props.particleCount,
  (newCount) => {
    if (newCount === undefined) { return; }
    buildPoints(newCount);
  },
);

const { onBeforeRender } = useLoop();

onBeforeRender(() => {
  if (!pointsRef.value) { return; }

  const posAttr = pointsRef.value.geometry.getAttribute('position') as THREE.BufferAttribute;
  const listPosition = posAttr.array as Float32Array;

  for (let i = 0; i < activeCount; i += 1) {
    const idx = i * 3;
    const velIdx = i * 2;

    listPosition[idx]     += listVelocity[velIdx];
    listPosition[idx + 1] += listVelocity[velIdx + 1];

    // Wrap particles that drift too far so the field remains populated
    if (listPosition[idx] > 600) { listPosition[idx] = -600; }
    if (listPosition[idx] < -600) { listPosition[idx] = 600; }
    if (listPosition[idx + 1] > 600) { listPosition[idx + 1] = -600; }
    if (listPosition[idx + 1] < -600) { listPosition[idx + 1] = 600; }
  }

  posAttr.needsUpdate = true;
});
</script>

<template>
  <primitive v-if="pointsRef" :object="pointsRef" />
</template>
