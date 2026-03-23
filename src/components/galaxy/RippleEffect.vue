<script setup lang="ts">
// RippleEffect — expanding concentric ring animation around the currently playing star.
// Each ring expands outward over ~3 seconds, fades out, then restarts in a staggered loop.
// Must be placed inside a TresCanvas (child of GalaxyScene).

import { shallowRef, watch, onBeforeUnmount } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const { computeSinglePosition } = useGalaxyLayout();

const RING_COUNT = 4;
const RING_DURATION = 3.0;   // seconds per ring cycle
const MIN_RADIUS = 3;
const MAX_RADIUS = 18;

// Group that holds all ring meshes; always present in the scene
const ringGroup = shallowRef<THREE.Group>(new THREE.Group());

interface IRingState {
  mesh: THREE.Mesh;
  phase: number; // 0–1 local progress offset for stagger
}

let listRing: IRingState[] = [];
let elapsedTime = 0;

// Build ring meshes for the given genre colour and world position
const buildRings = (position: THREE.Vector3, hexColor: string): void => {
  disposeRings();

  const color = new THREE.Color(hexColor);

  for (let i = 0; i < RING_COUNT; i += 1) {
    const geometry = new THREE.RingGeometry(1, 1.08, 48);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);

    const phase = i / RING_COUNT; // stagger each ring evenly
    listRing.push({ mesh, phase });
    ringGroup.value.add(mesh);
  }
};

const disposeRings = (): void => {
  for (let i = 0; i < listRing.length; i += 1) {
    const { mesh } = listRing[i];
    mesh.geometry.dispose();
    (mesh.material as THREE.MeshBasicMaterial).dispose();
    ringGroup.value.remove(mesh);
  }
  listRing = [];
};

// Find the 3D world position of the song with the given id.
// Uses computeSinglePosition to avoid recomputing all 9111 positions.
const findStarPosition = (song: { id: number; year?: number; genre?: TGenre }): THREE.Vector3 => {
  return computeSinglePosition(song.id, song.year ?? 1980, song.genre);
};

watch(
  () => playerStore.currentSong,
  (song) => {
    if (!song) {
      disposeRings();
      return;
    }

    const position = findStarPosition(song);

    const genreKey = (song.genre ?? 'other') as TGenre;
    const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;

    buildRings(position, hexColor);
    elapsedTime = 0;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposeRings();
});

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta }) => {
  if (listRing.length === 0) { return; }

  elapsedTime += delta;

  for (let i = 0; i < listRing.length; i += 1) {
    const { mesh, phase } = listRing[i];
    const mat = mesh.material as THREE.MeshBasicMaterial;

    // Local progress [0, 1] with per-ring phase offset for stagger
    const localTime = (elapsedTime / RING_DURATION + phase) % 1;

    const radius = MIN_RADIUS + localTime * (MAX_RADIUS - MIN_RADIUS);

    // Fade in during first 20%, hold, then fade out in last 40%
    let opacity: number;
    if (localTime < 0.2) {
      opacity = localTime / 0.2;
    } else if (localTime < 0.6) {
      opacity = 1.0;
    } else {
      opacity = 1.0 - (localTime - 0.6) / 0.4;
    }

    // RingGeometry inner/outer radii cannot be mutated; scale uniformly instead
    mesh.scale.set(radius, radius, 1);
    mat.opacity = opacity * 0.6;
  }
});
</script>

<template>
  <primitive :object="ringGroup" />
</template>
