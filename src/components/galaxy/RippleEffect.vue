<script setup lang="ts">
// RippleEffect — shader-based expanding energy wave around active stars.
// Renders a local ripple for the user's playing song AND remote ripples
// for other users' active songs (via Supabase presence).
// Must be inside TresCanvas (child of GalaxyScene).

import { shallowRef, watch, onBeforeUnmount } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { useSongsStore } from '@/stores/songs';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();
const { computeSinglePosition } = useGalaxyLayout();

// ── Shared Shader ──
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
  uniform float uScale;
  varying vec2 vUv;

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

    // Multiple expanding rings
    float ring1 = fract(uTime * 0.25);
    float ring2 = fract(uTime * 0.35 + 0.33);
    float ring3 = fract(uTime * 0.45 + 0.66);

    float ringWidth = 0.04;
    float r1 = smoothstep(ringWidth, 0.0, abs(dist - ring1)) * (1.0 - ring1);
    float r2 = smoothstep(ringWidth * 0.8, 0.0, abs(dist - ring2 * 0.85)) * (1.0 - ring2);
    float r3 = smoothstep(ringWidth * 0.6, 0.0, abs(dist - ring3 * 0.7)) * (1.0 - ring3);

    // Noise distortion
    r1 *= (1.0 + noise(vec2(angle * 3.0, uTime)) * 0.5);
    r2 *= (1.0 + noise(vec2(angle * 4.0 + 1.0, uTime * 1.3)) * 0.4);
    r3 *= (1.0 + noise(vec2(angle * 5.0 + 2.0, uTime * 1.6)) * 0.3);

    float rings = (r1 + r2 * 0.7 + r3 * 0.5);

    // Aurora shimmer
    float aurora = noise(vec2(angle * 2.0 + uTime * 0.3, dist * 4.0 - uTime * 0.8));
    aurora *= smoothstep(0.8, 0.2, dist);
    aurora *= smoothstep(0.0, 0.1, dist);
    aurora *= 0.15;

    // Sparkles
    float sparkle = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 sparkleUv = uv * (6.0 + fi * 2.0) + vec2(uTime * 0.1 * (fi + 1.0));
      float s = hash(floor(sparkleUv));
      float bright = step(0.97, s);
      float twinkle = sin(uTime * (3.0 + fi * 2.0) + s * 6.28) * 0.5 + 0.5;
      sparkle += bright * twinkle * smoothstep(0.9, 0.3, dist) * 0.3;
    }

    // Central glow
    float centerGlow = exp(-dist * 5.0) * 0.4;

    // Combine
    float brightness = rings + aurora + sparkle + centerGlow;
    brightness *= uIntensity * uScale;

    vec3 ringColor = uColor * 1.5;
    vec3 warmWhite = vec3(1.0, 0.95, 0.85);
    vec3 color = mix(ringColor, warmWhite, centerGlow / max(brightness, 0.001));

    float alpha = brightness * smoothstep(1.0, 0.6, dist);
    alpha = clamp(alpha, 0.0, 1.0);

    if (alpha < 0.005) discard;

    gl_FragColor = vec4(color * brightness, alpha);
  }
`;

// ── Shared geometry (reuse for all ripple quads) ──
// Base quad is 1x1 — actual size controlled by mesh.scale per ripple
const QUAD_HALF = 1;
const MAX_REMOTE_RIPPLES = 8;
const sharedGeometry = new THREE.PlaneGeometry(QUAD_HALF * 2, QUAD_HALF * 2);

// World-space sizes
const LOCAL_RIPPLE_SIZE = 18; // your own playing star — compact
const REMOTE_RIPPLE_BASE = 12; // 1 remote viewer — small but visible
const REMOTE_RIPPLE_MAX = 30; // many viewers — large and dramatic

// ── Group that holds all ripple meshes ──
const group = shallowRef<THREE.Group>(new THREE.Group());

// ══════════════════════════════════════════════════════════
// LOCAL RIPPLE — user's own playing star
// ══════════════════════════════════════════════════════════

const localMesh = shallowRef<THREE.Mesh | null>(null);
let localMaterial: THREE.ShaderMaterial | null = null;
let localFadeTarget = 0;
let localIntensity = 0;

const buildLocalRipple = (position: THREE.Vector3, hexColor: string): void => {
  disposeLocalRipple();

  const color = new THREE.Color(hexColor);
  localMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uIntensity: { value: 0 },
      uScale: { value: 1.0 },
    },
    vertexShader: RIPPLE_VERTEX,
    fragmentShader: RIPPLE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(sharedGeometry, localMaterial);
  mesh.position.copy(position);
  mesh.position.z = -0.5;
  mesh.scale.setScalar(LOCAL_RIPPLE_SIZE);
  localMesh.value = mesh;
  group.value.add(mesh);
};

const disposeLocalRipple = (): void => {
  if (localMesh.value) {
    if (localMaterial) { localMaterial.dispose(); }
    group.value.remove(localMesh.value);
    localMesh.value = null;
    localMaterial = null;
  }
};

const findStarPosition = (song: { id: number; year?: number; genre?: TGenre }): THREE.Vector3 => {
  return computeSinglePosition(song.id, song.year ?? 1980, song.genre);
};

watch(
  () => playerStore.currentSong,
  (song) => {
    if (!song) {
      localFadeTarget = 0;
      return;
    }

    const position = findStarPosition(song);
    const genreKey = (song.genre ?? 'other') as TGenre;
    const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;

    buildLocalRipple(position, hexColor);
    localFadeTarget = playerStore.isPlaying ? 1 : 0;
    localIntensity = 0;
  },
  { immediate: true },
);

watch(
  () => playerStore.isPlaying,
  (playing) => {
    if (playing) {
      if (!localMaterial && playerStore.currentSong) {
        const song = playerStore.currentSong;
        const position = findStarPosition(song);
        const genreKey = (song.genre ?? 'other') as TGenre;
        const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;
        buildLocalRipple(position, hexColor);
        localIntensity = 0;
      }
      localFadeTarget = 1;
    } else {
      localFadeTarget = 0;
    }
  },
);

// ══════════════════════════════════════════════════════════
// REMOTE RIPPLES — other users' active songs via presence
// ══════════════════════════════════════════════════════════

interface IRemoteRipple {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  songId: number;
  intensity: number;
  fadeTarget: number;
  viewerCount: number;
  timeOffset: number; // random offset so ripples are asynchronous
}

const listRemoteRipple: IRemoteRipple[] = [];

// Viewer-count-based sizing for remote ripples.
// Color/brightness stays FULL — only SIZE grows with more viewers.
//   1 user  → REMOTE_RIPPLE_BASE (12)  — small ring, clearly visible
//   2 users → ~18
//   3 users → ~22
//   5+ users → caps at REMOTE_RIPPLE_MAX (30) — large, dramatic
const remoteRippleWorldSize = (count: number): number => {
  if (count <= 0) { return REMOTE_RIPPLE_BASE; }
  if (count === 1) { return REMOTE_RIPPLE_BASE; }
  const scaled = REMOTE_RIPPLE_BASE + (REMOTE_RIPPLE_MAX - REMOTE_RIPPLE_BASE) * Math.min(Math.log2(count) / 3, 1);
  return scaled;
};

const buildRemoteRipple = (songId: number, position: THREE.Vector3, hexColor: string, viewerCount: number): IRemoteRipple => {
  const color = new THREE.Color(hexColor);
  const worldSize = remoteRippleWorldSize(viewerCount);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uIntensity: { value: 0 },
      uScale: { value: 1.0 }, // full brightness — no dimming
    },
    vertexShader: RIPPLE_VERTEX,
    fragmentShader: RIPPLE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(sharedGeometry, mat);
  mesh.position.copy(position);
  mesh.position.z = -0.6;
  mesh.scale.setScalar(worldSize);
  group.value.add(mesh);

  // Random time offset so each ripple pulses at its own phase
  const timeOffset = Math.random() * 20;

  return { mesh, material: mat, songId, intensity: 0, fadeTarget: 1, viewerCount, timeOffset };
};

const disposeRemoteRipple = (ripple: IRemoteRipple): void => {
  ripple.material.dispose();
  group.value.remove(ripple.mesh);
};

const syncRemoteRipples = (): void => {
  const mapActivity = galaxyStore.mapActivityCount;
  const localSongId = playerStore.currentSong?.id ?? null;

  // Update or fade out existing ripples
  for (let i = listRemoteRipple.length - 1; i >= 0; i -= 1) {
    const ripple = listRemoteRipple[i];
    if (ripple.songId === localSongId) {
      ripple.fadeTarget = 0;
      continue;
    }
    const count = mapActivity.get(ripple.songId);
    if (count === undefined) {
      ripple.fadeTarget = 0;
    } else if (count !== ripple.viewerCount) {
      ripple.viewerCount = count;
      ripple.mesh.scale.setScalar(remoteRippleWorldSize(count));
      ripple.fadeTarget = 1;
    }
  }

  // Add new ripples — linear scan over existing (max 8) avoids Set allocation
  for (const [songId, count] of mapActivity) {
    if (songId === localSongId) { continue; }
    if (listRemoteRipple.length >= MAX_REMOTE_RIPPLES) { break; }

    let exists = false;
    for (let j = 0; j < listRemoteRipple.length; j += 1) {
      if (listRemoteRipple[j].songId === songId) { exists = true; break; }
    }
    if (exists) { continue; }

    const song = songsStore.listSong.find((s) => s.id === songId);
    if (!song) { continue; }

    const position = findStarPosition(song);
    const genreKey = (song.genre ?? 'other') as TGenre;
    const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;

    listRemoteRipple.push(buildRemoteRipple(songId, position, hexColor, count));
  }
};

// Watch presence version changes
watch(
  () => galaxyStore.activityVersion,
  () => {
    syncRemoteRipples();
  },
);

// Re-sync when songs finish loading (on reload, presence may arrive before songs)
watch(
  () => songsStore.listSong.length,
  (len) => {
    if (len > 0 && galaxyStore.mapActivityCount.size > 0) {
      syncRemoteRipples();
    }
  },
);

// ══════════════════════════════════════════════════════════
// RENDER LOOP
// ══════════════════════════════════════════════════════════

onBeforeUnmount(() => {
  disposeLocalRipple();
  for (let i = 0; i < listRemoteRipple.length; i += 1) {
    disposeRemoteRipple(listRemoteRipple[i]);
  }
  listRemoteRipple.length = 0;
  sharedGeometry.dispose();
});

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta, elapsed }) => {
  // ── Local ripple — grows if other users also listen to the same star ──
  if (localMaterial && localMesh.value) {
    localIntensity += (localFadeTarget - localIntensity) * Math.min(delta * 3, 1);
    localMaterial.uniforms.uTime.value = elapsed;
    localMaterial.uniforms.uIntensity.value = localIntensity;

    // Scale up local ripple based on remote viewers on the same song
    const localSongId = playerStore.currentSong?.id ?? null;
    const remoteCount = localSongId !== null ? (galaxyStore.mapActivityCount.get(localSongId) ?? 0) : 0;
    const targetScale = remoteCount > 0
      ? LOCAL_RIPPLE_SIZE + (REMOTE_RIPPLE_MAX - LOCAL_RIPPLE_SIZE) * Math.min(Math.log2(remoteCount + 1) / 3, 1)
      : LOCAL_RIPPLE_SIZE;
    const currentScale = localMesh.value.scale.x;
    const newScale = currentScale + (targetScale - currentScale) * Math.min(delta * 2, 1);
    localMesh.value.scale.setScalar(newScale);

    if (localFadeTarget === 0 && localIntensity < 0.01) {
      disposeLocalRipple();
    }
  }

  // ── Remote ripples (asynchronous — each has its own time offset) ──
  for (let i = listRemoteRipple.length - 1; i >= 0; i -= 1) {
    const ripple = listRemoteRipple[i];
    // Fade to full intensity (1.0) — no dimming, color stays bright
    ripple.intensity += (ripple.fadeTarget - ripple.intensity) * Math.min(delta * 2, 1);
    // Each ripple runs at its own phase via timeOffset — they won't pulse in sync
    ripple.material.uniforms.uTime.value = elapsed + ripple.timeOffset;
    ripple.material.uniforms.uIntensity.value = ripple.intensity;

    // Dispose when fully faded out
    if (ripple.fadeTarget === 0 && ripple.intensity < 0.01) {
      disposeRemoteRipple(ripple);
      listRemoteRipple.splice(i, 1);
    }
  }
});
</script>

<template>
  <primitive :object="group" />
</template>
