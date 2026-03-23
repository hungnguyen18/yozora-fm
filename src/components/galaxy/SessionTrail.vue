<script setup lang="ts">
// SessionTrail — a glowing line connecting every star the user has played this session.
// The trail fades from bright (most recent) to dim (oldest).
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

// Pre-built Map for O(1) position lookups (rebuilt when positions change)
let positionMap = new Map<number, { x: number; y: number }>();

const buildPositionMap = () => {
  positionMap = new Map();
  const list = galaxyStore.listStarPosition;
  for (let i = 0; i < list.length; i += 1) {
    positionMap.set(list[i].songId, list[i]);
  }
};

const rebuildTrail = () => {
  const listRecentId = playerStore.listRecentId;
  if (listRecentId.length < 2) {
    trailLine.value.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    trailLine.value.geometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
    return;
  }

  // Resolve positions, skipping songs without positions
  const listResolved: { x: number; y: number; originalIndex: number }[] = [];
  for (let i = 0; i < listRecentId.length; i += 1) {
    const pos = positionMap.get(listRecentId[i]);
    if (pos) {
      listResolved.push({ x: pos.x, y: pos.y, originalIndex: i });
    }
  }

  if (listResolved.length < 2) {
    trailLine.value.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    trailLine.value.geometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
    return;
  }

  const listVertex: number[] = [];
  const listColor: number[] = [];
  const resolvedCount = listResolved.length;

  for (let i = 0; i < resolvedCount; i += 1) {
    const point = listResolved[i];
    listVertex.push(point.x, point.y, 0.1); // slightly above stars

    // Fade: oldest = dim, newest = bright. Bake alpha into RGB brightness
    // (LineBasicMaterial ignores vertex alpha channel)
    const t = resolvedCount > 1 ? i / (resolvedCount - 1) : 1;
    const brightness = 0.05 + t * 0.55;
    listColor.push(0.6 * brightness, 0.7 * brightness, 1.0 * brightness);
  }

  const geometry = trailLine.value.geometry;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(listVertex, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(listColor, 3));
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
};

// Rebuild trail whenever current song changes
watch(
  () => playerStore.currentSong,
  () => { rebuildTrail(); },
);

// Rebuild position map and trail when star positions become available
watch(
  () => galaxyStore.listStarPosition.length,
  (len) => {
    if (len > 0) {
      buildPositionMap();
      rebuildTrail();
    }
  },
);

onBeforeUnmount(() => {
  trailLine.value.geometry.dispose();
  (trailLine.value.material as THREE.Material).dispose();
});
</script>

<template>
  <primitive :object="trailLine" />
</template>
