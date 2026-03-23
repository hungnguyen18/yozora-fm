<script setup lang="ts">
// SessionTrail — a glowing line connecting every star the user has played this session.
// The trail fades from bright (most recent) to transparent (oldest).
// Must be placed inside a TresCanvas (child of GalaxyScene).

import { shallowRef, watch, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();

const trailLine = shallowRef<THREE.Line>(new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    linewidth: 1,
  }),
));

// Build a songId → {x, y} lookup for fast position resolution
const getPosition = (songId: number): { x: number; y: number } | null => {
  const list = galaxyStore.listStarPosition;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].songId === songId) {
      return list[i];
    }
  }
  return null;
};

const rebuildTrail = () => {
  const listRecentId = playerStore.listRecentId;
  if (listRecentId.length < 2) {
    trailLine.value.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    trailLine.value.geometry.setAttribute('color', new THREE.Float32BufferAttribute([], 4));
    return;
  }

  const listVertex: number[] = [];
  const listColor: number[] = [];
  const count = listRecentId.length;

  for (let i = 0; i < count; i += 1) {
    const pos = getPosition(listRecentId[i]);
    if (!pos) { continue; }
    listVertex.push(pos.x, pos.y, 0.1); // slightly above stars

    // Fade: oldest = 0.05 alpha, newest = 0.6 alpha
    const t = count > 1 ? i / (count - 1) : 1;
    const alpha = 0.05 + t * 0.55;
    // Soft white-blue color
    listColor.push(0.6, 0.7, 1.0, alpha);
  }

  const geometry = trailLine.value.geometry;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(listVertex, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(listColor, 4));
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
};

// Rebuild trail whenever current song changes (new entry added to listRecentId)
watch(
  () => playerStore.currentSong,
  () => { rebuildTrail(); },
);

// Also rebuild when star positions become available
watch(
  () => galaxyStore.listStarPosition.length,
  (len) => { if (len > 0) { rebuildTrail(); } },
);

onBeforeUnmount(() => {
  trailLine.value.geometry.dispose();
  (trailLine.value.material as THREE.Material).dispose();
});
</script>

<template>
  <primitive :object="trailLine" />
</template>
