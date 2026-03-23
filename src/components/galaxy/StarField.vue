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

// Expose the InstancedMesh ref so GalaxyScene can pass it to the interaction composable
defineExpose({ instancedMesh });

// Per-instance base scale cached from buildMesh so hover can restore it
const listBaseScale = ref<number[]>([]);

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

  const { matrices, colors, sizes, count } = computeBuffers(listSong);

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
  const baseScales: number[] = [];

  for (let i = 0; i < count; i += 1) {
    matrix.fromArray(matrices, i * 16);
    mesh.setMatrixAt(i, matrix);
    baseScales.push(sizes[i]);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  listBaseScale.value = baseScales;
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

// Hover visual feedback: scale up the hovered star and restore the previous one
const HOVER_SCALE_MULTIPLIER = 2.5;
const matrixHelper = new THREE.Matrix4();
const posHelper = new THREE.Vector3();
const quatHelper = new THREE.Quaternion();
const scaleHelper = new THREE.Vector3();

const setInstanceScale = (mesh: THREE.InstancedMesh, instanceId: number, scale: number): void => {
  mesh.getMatrixAt(instanceId, matrixHelper);
  matrixHelper.decompose(posHelper, quatHelper, scaleHelper);
  scaleHelper.set(scale, scale, 1);
  matrixHelper.compose(posHelper, quatHelper, scaleHelper);
  mesh.setMatrixAt(instanceId, matrixHelper);
  mesh.instanceMatrix.needsUpdate = true;
};

// Props received from GalaxyScene: the currently hovered instance index
const props = defineProps<{
  hoveredInstanceId: number | null;
}>();

let previousHoveredId: number | null = null;

watch(
  () => props.hoveredInstanceId,
  (nextId, prevId) => {
    const mesh = instancedMesh.value;
    if (!mesh) { return; }

    // Restore previous hovered star to its base scale
    const idToRestore = prevId ?? previousHoveredId;
    if (idToRestore !== null && idToRestore !== nextId) {
      const baseScale = listBaseScale.value[idToRestore] ?? 1;
      setInstanceScale(mesh, idToRestore, baseScale);
    }

    // Scale up newly hovered star
    if (nextId !== null) {
      const baseScale = listBaseScale.value[nextId] ?? 1;
      setInstanceScale(mesh, nextId, baseScale * HOVER_SCALE_MULTIPLIER);
    }

    previousHoveredId = nextId;
  },
);
</script>

<template>
  <primitive
    v-if="instancedMesh"
    :object="instancedMesh"
  />
</template>
