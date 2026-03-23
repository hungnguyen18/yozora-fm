<script setup lang="ts">
// StarField — renders all songs as a single InstancedMesh in the TresJS scene.
// Must be placed inside a TresCanvas (child of GalaxyScene).

import { ref, computed, watch, onMounted } from 'vue';
import * as THREE from 'three';
import { useSongsStore } from '@/stores/songs';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { useLOD } from '@/composables/useLOD';

const songsStore = useSongsStore();
const playerStore = usePlayerStore();
const { computeBuffers } = useGalaxyLayout();
const { showLabels, labelVoteThreshold } = useLOD();

const instancedMesh = ref<THREE.InstancedMesh | null>(null);

// Per-instance base scale cached from buildMesh so hover can restore it
const listBaseScale = ref<number[]>([]);

// Per-instance 3D world position cached for label projection
const listStarWorldPosition = ref<THREE.Vector3[]>([]);

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
  const worldPositions: THREE.Vector3[] = [];
  const posVec = new THREE.Vector3();
  const quatVec = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  for (let i = 0; i < count; i += 1) {
    matrix.fromArray(matrices, i * 16);
    mesh.setMatrixAt(i, matrix);
    baseScales.push(sizes[i]);

    // Decompose to extract world position for label projection
    matrix.decompose(posVec, quatVec, scaleVec);
    worldPositions.push(posVec.clone());
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  // Cache original per-instance colors for active-star restoration
  const baseColors: { r: number; g: number; b: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    baseColors.push({
      r: colors[i * 3],
      g: colors[i * 3 + 1],
      b: colors[i * 3 + 2],
    });
  }

  listBaseScale.value = baseScales;
  listBaseColor.value = baseColors;
  listStarWorldPosition.value = worldPositions;
  instancedMesh.value = mesh;

  // Re-apply active star highlight after mesh rebuild
  previousActiveInstanceId = null;
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

// Props received from GalaxyScene: the currently hovered instance index and active camera
const props = defineProps<{
  hoveredInstanceId: number | null;
  camera?: THREE.Camera | null;
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

// Active star visual: brighter colour (white) and 1.5x scale when a song is playing.
// Distinct from hover — hover uses HOVER_SCALE_MULTIPLIER; active is always 1.5x base.
const ACTIVE_SCALE_MULTIPLIER = 1.5;
const activeColor = new THREE.Color(1, 1, 1); // bright white
const activeColorHelper = new THREE.Color();
let previousActiveInstanceId: number | null = null;

// Original colors buffer saved at build time so we can restore them
const listBaseColor = ref<{ r: number; g: number; b: number }[]>([]);

const setInstanceColor = (
  mesh: THREE.InstancedMesh,
  instanceId: number,
  r: number,
  g: number,
  b: number,
): void => {
  activeColorHelper.setRGB(r, g, b);
  mesh.setColorAt(instanceId, activeColorHelper);
  if (mesh.instanceColor) { mesh.instanceColor.needsUpdate = true; }
};

watch(
  () => playerStore.currentSong,
  (song, _prevSong) => {
    const mesh = instancedMesh.value;
    if (!mesh) { return; }

    // Restore previous active star to its original colour and base scale
    if (previousActiveInstanceId !== null) {
      const prevId = previousActiveInstanceId;
      const base = listBaseColor.value[prevId];
      if (base) {
        setInstanceColor(mesh, prevId, base.r, base.g, base.b);
      }
      const baseScale = listBaseScale.value[prevId] ?? 1;
      setInstanceScale(mesh, prevId, baseScale);
      previousActiveInstanceId = null;
    }

    if (!song) { return; }

    // Find instance index matching the playing song
    const listSong = songsStore.listSong;
    const instanceId = listSong.findIndex((s) => s.id === song.id);
    if (instanceId === -1) { return; }

    // Brighten to white and scale up
    setInstanceColor(mesh, instanceId, activeColor.r, activeColor.g, activeColor.b);
    const baseScale = listBaseScale.value[instanceId] ?? 1;
    setInstanceScale(mesh, instanceId, baseScale * ACTIVE_SCALE_MULTIPLIER);
    previousActiveInstanceId = instanceId;
  },
);

// Reusable vector for NDC projection
const _ndcVec = new THREE.Vector3();

// Project a world-space position to screen pixel coordinates.
// Returns null if the point is outside the viewport.
const projectToScreen = (
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
): { x: number; y: number } | null => {
  _ndcVec.copy(worldPos).project(camera);

  // Discard points behind camera or outside NDC bounds
  if (_ndcVec.z > 1) { return null; }
  if (Math.abs(_ndcVec.x) > 1.1 || Math.abs(_ndcVec.y) > 1.1) { return null; }

  const x = (_ndcVec.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_ndcVec.y * 0.5 + 0.5) * window.innerHeight;

  return { x, y };
};

export interface IStarLabel {
  x: number;
  y: number;
  text: string;
  songId: number;
}

// Compute visible star labels projected to screen space.
// Filtered by LOD vote threshold and viewport bounds.
const visibleLabels = computed<IStarLabel[]>(() => {
  if (!showLabels.value) { return []; }

  const camera = props.camera;
  if (!camera) { return []; }

  const listSong = songsStore.listSong;
  const worldPositions = listStarWorldPosition.value;
  const threshold = labelVoteThreshold.value;

  if (listSong.length === 0 || worldPositions.length === 0) { return []; }

  const result: IStarLabel[] = [];

  for (let i = 0; i < listSong.length; i += 1) {
    const song = listSong[i];

    if (song.vote_count < threshold) { continue; }

    const worldPos = worldPositions[i];
    if (!worldPos) { continue; }

    const screenPos = projectToScreen(worldPos, camera);
    if (!screenPos) { continue; }

    result.push({
      x: screenPos.x,
      y: screenPos.y,
      text: song.title,
      songId: song.id,
    });
  }

  return result;
});

// Expose the InstancedMesh ref and label data so GalaxyScene can consume them
defineExpose({ instancedMesh, visibleLabels });
</script>

<template>
  <primitive
    v-if="instancedMesh"
    :object="instancedMesh"
  />
</template>
