<script setup lang="ts">
// StarField — renders all songs as a single InstancedMesh in the TresJS scene.
// Must be placed inside a TresCanvas (child of GalaxyScene).

import { ref, watch, onMounted } from 'vue';
import * as THREE from 'three';
import { useSongsStore } from '@/stores/songs';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';

const songsStore = useSongsStore();
const { computeBuffers } = useGalaxyLayout();

const instancedMesh = ref<THREE.InstancedMesh | null>(null);

// Build a circular gradient texture programmatically for the glow effect
const createGlowTexture = (): THREE.Texture => {
  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const centre = SIZE / 2;

  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// Build the InstancedMesh and apply per-instance transforms and colours.
// Writes directly to typed buffers to bypass Vue reactivity overhead.
const buildMesh = () => {
  const listSong = songsStore.listSong;
  if (listSong.length === 0) { return; }

  const { matrices, colors, count } = computeBuffers(listSong);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: createGlowTexture(),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    matrix.fromArray(matrices, i * 16);
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  instancedMesh.value = mesh;
};

onMounted(async () => {
  if (songsStore.listSong.length === 0) {
    await songsStore.fetchSongs();
  }
  buildMesh();
});

// Rebuild mesh if songs are loaded after mount (e.g. slow network)
watch(
  () => songsStore.listSong.length,
  (newLen, oldLen) => {
    if (newLen > 0 && oldLen === 0) {
      buildMesh();
    }
  },
);
</script>

<template>
  <primitive
    v-if="instancedMesh"
    :object="instancedMesh"
  />
</template>
