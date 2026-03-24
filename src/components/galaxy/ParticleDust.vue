<script setup lang="ts">
// ParticleDust — floating particles scattered across the scene.
// Creates depth and atmosphere without distracting from the star field.
// Now with twinkling opacity and subtle color variation.

import { shallowRef, watch, onMounted, onBeforeUnmount } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';

const props = defineProps<{
  particleCount?: number;
}>();

const DEFAULT_PARTICLE_COUNT = 3000;

const pointsRef = shallowRef<THREE.Points | null>(null);

// Per-particle drift velocity: [vx0, vy0, vx1, vy1, ...]
let listVelocity: Float32Array = new Float32Array(0);
// Per-particle twinkle phase and speed: [phase0, speed0, phase1, speed1, ...]
let listTwinkle: Float32Array = new Float32Array(0);
let activeCount = 0;

// Shared twinkle shader material for colored, size-attenuated particles
const TWINKLE_VERTEX = /* glsl */ `
  attribute float aOpacity;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TWINKLE_FRAGMENT = /* glsl */ `
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    // Soft circle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, dist) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const buildPoints = (count: number): void => {
  if (pointsRef.value) {
    pointsRef.value.geometry.dispose();
    (pointsRef.value.material as THREE.ShaderMaterial).dispose();
    pointsRef.value = null;
  }

  activeCount = count;
  const geometry = new THREE.BufferGeometry();
  const listPosition = new Float32Array(count * 3);
  const listColor = new Float32Array(count * 3);
  const listOpacity = new Float32Array(count);
  listVelocity = new Float32Array(count * 2);
  listTwinkle = new Float32Array(count * 2);

  // Subtle color palette for dust particles
  const LIST_DUST_COLOR: [number, number, number][] = [
    [0.91, 0.91, 0.94],  // cool white
    [0.75, 0.78, 0.95],  // soft indigo
    [0.85, 0.85, 0.92],  // silver
    [0.65, 0.70, 0.90],  // periwinkle
    [0.95, 0.88, 0.85],  // warm blush
  ];

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    listPosition[idx]     = (Math.random() - 0.5) * 1200;
    listPosition[idx + 1] = (Math.random() - 0.5) * 1200;
    listPosition[idx + 2] = -20 + Math.random() * 15;

    // Pick a color from the palette
    const colorPick = LIST_DUST_COLOR[i % LIST_DUST_COLOR.length];
    listColor[idx]     = colorPick[0] + (Math.random() - 0.5) * 0.05;
    listColor[idx + 1] = colorPick[1] + (Math.random() - 0.5) * 0.05;
    listColor[idx + 2] = colorPick[2] + (Math.random() - 0.5) * 0.05;

    // Varied base opacity
    listOpacity[i] = 0.15 + Math.random() * 0.25;

    const velIdx = i * 2;
    listVelocity[velIdx]     = (Math.random() - 0.5) * 0.1;
    listVelocity[velIdx + 1] = (Math.random() - 0.5) * 0.1;

    // Twinkle: random phase + speed so each particle blinks independently
    const twinkleIdx = i * 2;
    listTwinkle[twinkleIdx]     = Math.random() * Math.PI * 2; // phase
    listTwinkle[twinkleIdx + 1] = 0.3 + Math.random() * 0.8;  // speed (0.3–1.1)
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(listPosition, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(listColor, 3));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(listOpacity, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: TWINKLE_VERTEX,
    fragmentShader: TWINKLE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  pointsRef.value = new THREE.Points(geometry, material);
};

onMounted(() => {
  buildPoints(props.particleCount ?? DEFAULT_PARTICLE_COUNT);
});

onBeforeUnmount(() => {
  if (!pointsRef.value) { return; }
  pointsRef.value.geometry.dispose();
  (pointsRef.value.material as THREE.ShaderMaterial).dispose();
});

watch(
  () => props.particleCount,
  (newCount) => {
    if (newCount === undefined) { return; }
    buildPoints(newCount);
  },
);

const { onBeforeRender } = useLoop();
let elapsed = 0;

onBeforeRender(({ delta }) => {
  if (!pointsRef.value) { return; }
  elapsed += delta;

  // Slow galaxy-like rotation for the entire dust field
  pointsRef.value.rotation.z = elapsed * 0.004;

  const posAttr = pointsRef.value.geometry.getAttribute('position') as THREE.BufferAttribute;
  const opacityAttr = pointsRef.value.geometry.getAttribute('aOpacity') as THREE.BufferAttribute;
  const listPosition = posAttr.array as Float32Array;
  const listOpacity = opacityAttr.array as Float32Array;

  for (let i = 0; i < activeCount; i += 1) {
    const idx = i * 3;
    const velIdx = i * 2;
    const twinkleIdx = i * 2;

    // Drift
    listPosition[idx]     += listVelocity[velIdx];
    listPosition[idx + 1] += listVelocity[velIdx + 1];

    // Wrap
    if (listPosition[idx] > 600) { listPosition[idx] = -600; }
    if (listPosition[idx] < -600) { listPosition[idx] = 600; }
    if (listPosition[idx + 1] > 600) { listPosition[idx + 1] = -600; }
    if (listPosition[idx + 1] < -600) { listPosition[idx + 1] = 600; }

    // Twinkle: oscillate opacity
    const phase = listTwinkle[twinkleIdx];
    const speed = listTwinkle[twinkleIdx + 1];
    const twinkle = 0.5 + 0.5 * Math.sin(elapsed * speed + phase);
    listOpacity[i] = 0.08 + twinkle * 0.35;
  }

  posAttr.needsUpdate = true;
  opacityAttr.needsUpdate = true;
});
</script>

<template>
  <primitive v-if="pointsRef" :object="pointsRef" />
</template>
