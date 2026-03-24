<script setup lang="ts">
// RippleEffect — shader-based expanding energy wave around the active star.
// Multiple layered rings with noise distortion, aurora shimmer, and particle trails.
// Must be inside TresCanvas (child of GalaxyScene).

import { shallowRef, watch, onBeforeUnmount } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const { computeSinglePosition } = useGalaxyLayout();

// ── Shader ──
const RIPPLE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIPPLE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;

  // Simplex-ish noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    // ── Multiple expanding rings with different speeds ──
    float ring1 = fract(uTime * 0.25);        // slow outer ring
    float ring2 = fract(uTime * 0.35 + 0.33); // medium ring
    float ring3 = fract(uTime * 0.45 + 0.66); // fast inner ring

    // Each ring: thin bright band at its radius
    float ringWidth = 0.04;
    float r1 = smoothstep(ringWidth, 0.0, abs(dist - ring1)) * (1.0 - ring1);
    float r2 = smoothstep(ringWidth * 0.8, 0.0, abs(dist - ring2 * 0.85)) * (1.0 - ring2);
    float r3 = smoothstep(ringWidth * 0.6, 0.0, abs(dist - ring3 * 0.7)) * (1.0 - ring3);

    // ── Noise distortion on rings — organic, not perfect circles ──
    float n = noise(vec2(angle * 2.0 + uTime * 0.5, dist * 8.0 - uTime * 2.0));
    float distortion = n * 0.06;
    r1 *= (1.0 + noise(vec2(angle * 3.0, uTime)) * 0.5);
    r2 *= (1.0 + noise(vec2(angle * 4.0 + 1.0, uTime * 1.3)) * 0.4);
    r3 *= (1.0 + noise(vec2(angle * 5.0 + 2.0, uTime * 1.6)) * 0.3);

    float rings = (r1 + r2 * 0.7 + r3 * 0.5);

    // ── Aurora shimmer: rotating color bands ──
    float aurora = noise(vec2(angle * 2.0 + uTime * 0.3, dist * 4.0 - uTime * 0.8));
    aurora *= smoothstep(0.8, 0.2, dist); // fade at edges
    aurora *= smoothstep(0.0, 0.1, dist); // fade at center
    aurora *= 0.15;

    // ── Particle sparkles scattered in the field ──
    float sparkle = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 sparkleUv = uv * (6.0 + fi * 2.0) + vec2(uTime * 0.1 * (fi + 1.0));
      float s = hash(floor(sparkleUv));
      float bright = step(0.97, s);
      float twinkle = sin(uTime * (3.0 + fi * 2.0) + s * 6.28) * 0.5 + 0.5;
      sparkle += bright * twinkle * smoothstep(0.9, 0.3, dist) * 0.3;
    }

    // ── Central glow: soft radial light ──
    float centerGlow = exp(-dist * 5.0) * 0.4;

    // ── Combine ──
    float brightness = rings + aurora + sparkle + centerGlow;
    brightness *= uIntensity;

    // Color: genre color for rings, warmer white for center glow
    vec3 ringColor = uColor * 1.5;
    vec3 warmWhite = vec3(1.0, 0.95, 0.85);
    vec3 color = mix(ringColor, warmWhite, centerGlow / max(brightness, 0.001));

    // Edge falloff
    float alpha = brightness * smoothstep(1.0, 0.6, dist);
    alpha = clamp(alpha, 0.0, 1.0);

    if (alpha < 0.005) discard;

    gl_FragColor = vec4(color * brightness, alpha);
  }
`;

// ── State ──
const rippleMesh = shallowRef<THREE.Mesh | null>(null);
let material: THREE.ShaderMaterial | null = null;
const group = shallowRef<THREE.Group>(new THREE.Group());

const RIPPLE_SIZE = 50; // world-space radius of the effect quad

const buildRipple = (position: THREE.Vector3, hexColor: string): void => {
  disposeRipple();

  const color = new THREE.Color(hexColor);
  const geometry = new THREE.PlaneGeometry(RIPPLE_SIZE * 2, RIPPLE_SIZE * 2);

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uIntensity: { value: 0 }, // fade in
    },
    vertexShader: RIPPLE_VERTEX,
    fragmentShader: RIPPLE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.z = -0.5; // slightly behind stars
  rippleMesh.value = mesh;
  group.value.add(mesh);
};

const disposeRipple = (): void => {
  if (rippleMesh.value) {
    rippleMesh.value.geometry.dispose();
    if (material) { material.dispose(); }
    group.value.remove(rippleMesh.value);
    rippleMesh.value = null;
    material = null;
  }
};

const findStarPosition = (song: { id: number; year?: number; genre?: TGenre }): THREE.Vector3 => {
  return computeSinglePosition(song.id, song.year ?? 1980, song.genre);
};

let fadeTarget = 0;
let currentIntensity = 0;

watch(
  () => playerStore.currentSong,
  (song) => {
    if (!song) {
      fadeTarget = 0;
      return;
    }

    const position = findStarPosition(song);
    const genreKey = (song.genre ?? 'other') as TGenre;
    const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;

    buildRipple(position, hexColor);
    fadeTarget = 1;
    currentIntensity = 0;
  },
  { immediate: true },
);

watch(
  () => playerStore.isPlaying,
  (playing) => {
    fadeTarget = playing ? 1 : 0;
  },
);

onBeforeUnmount(() => {
  disposeRipple();
});

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta, elapsed }) => {
  if (!material) { return; }

  // Smooth intensity fade
  currentIntensity += (fadeTarget - currentIntensity) * Math.min(delta * 3, 1);
  material.uniforms.uTime.value = elapsed;
  material.uniforms.uIntensity.value = currentIntensity;

  // Dispose when fully faded out
  if (fadeTarget === 0 && currentIntensity < 0.01) {
    disposeRipple();
  }
});
</script>

<template>
  <primitive :object="group" />
</template>
