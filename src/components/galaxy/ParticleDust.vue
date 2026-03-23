<script setup lang="ts">
// ParticleDust — 3000 floating particles scattered across the scene.
// Creates depth and atmosphere without distracting from the star field.

import { shallowRef, onMounted, onBeforeUnmount } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';

const PARTICLE_COUNT = 3000;

const pointsRef = shallowRef<THREE.Points | null>(null);

// Per-particle drift velocity stored as flat Float32Array: [vx0, vy0, vx1, vy1, ...]
let listVelocity: Float32Array;

onMounted(() => {
  const geometry = new THREE.BufferGeometry();
  const listPosition = new Float32Array(PARTICLE_COUNT * 3);
  listVelocity = new Float32Array(PARTICLE_COUNT * 2);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
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
});

onBeforeUnmount(() => {
  if (!pointsRef.value) { return; }
  pointsRef.value.geometry.dispose();
  (pointsRef.value.material as THREE.PointsMaterial).dispose();
});

const { onBeforeRender } = useLoop();

onBeforeRender(() => {
  if (!pointsRef.value) { return; }

  const posAttr = pointsRef.value.geometry.getAttribute('position') as THREE.BufferAttribute;
  const listPosition = posAttr.array as Float32Array;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
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
