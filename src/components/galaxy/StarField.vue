<script setup lang="ts">
// StarField — renders all songs as a single InstancedMesh in the TresJS scene.
// Must be placed inside a TresCanvas (child of GalaxyScene).

import { ref, shallowRef, triggerRef, computed, watch, onMounted, onUnmounted, markRaw } from 'vue';
import * as THREE from 'three';
import { useLoop, useTresContext } from '@tresjs/core';
import { useSongsStore } from '@/stores/songs';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { useLOD } from '@/composables/useLOD';
import { useStarSpatialIndex } from '@/composables/useStarSpatialIndex';

const songsStore = useSongsStore();
const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const { computeBuffers } = useGalaxyLayout();
const { showLabels, labelVoteThreshold, labelMaxCount } = useLOD();
const { scene } = useTresContext();
const trailSpatialIndex = useStarSpatialIndex();

// Set of star indices currently affected by the trail (brightened or fading).
// Only these are iterated each frame for the fade pass, instead of all 9111 stars.
const activeTrailStars = new Set<number>();

const instancedMesh = shallowRef<THREE.InstancedMesh | null>(null);

// Per-instance base scale cached from buildMesh so hover can restore it
const listBaseScale = ref<number[]>([]);

// Per-instance 3D world position cached for label projection
const listStarWorldPosition = shallowRef<THREE.Vector3[]>([]);

// Build a high-res glow texture with sharp core, halo, and diffraction spikes
const createGlowTexture = (): THREE.Texture => {
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const cx = SIZE / 2;

  // Layer 1: Outer glow (large, faint)
  const outerGlow = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  outerGlow.addColorStop(0, 'rgba(255,255,255,0.25)');
  outerGlow.addColorStop(0.15, 'rgba(255,255,255,0.12)');
  outerGlow.addColorStop(0.4, 'rgba(255,255,255,0.04)');
  outerGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Layer 2: Inner halo (medium, brighter)
  const innerHalo = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.35);
  innerHalo.addColorStop(0, 'rgba(255,255,255,0.9)');
  innerHalo.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  innerHalo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = innerHalo;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Layer 3: Sharp bright core
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, 4);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Layer 4: Diffraction spikes (4 thin rays)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let angle = 0; angle < 4; angle += 1) {
    const rad = (angle * Math.PI) / 4 + Math.PI / 8; // 22.5°, 67.5°, 112.5°, 157.5°
    const spikeLen = cx * 0.85;
    const spikeGrad = ctx.createLinearGradient(
      cx - Math.cos(rad) * spikeLen,
      cx - Math.sin(rad) * spikeLen,
      cx + Math.cos(rad) * spikeLen,
      cx + Math.sin(rad) * spikeLen,
    );
    spikeGrad.addColorStop(0, 'rgba(255,255,255,0)');
    spikeGrad.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    spikeGrad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    spikeGrad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    spikeGrad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(rad) * spikeLen, cx - Math.sin(rad) * spikeLen);
    ctx.lineTo(cx + Math.cos(rad) * spikeLen, cx + Math.sin(rad) * spikeLen);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spikeGrad;
    ctx.stroke();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// Custom shader material with per-instance twinkle animation.
// Three.js ShaderMaterial auto-injects: position, uv, normal, modelViewMatrix,
// projectionMatrix, instanceMatrix, instanceColor — do NOT re-declare them.
const TWINKLE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vTwinklePhase;

  void main() {
    vUv = uv;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif

    // Use instance matrix position as twinkle phase seed
    vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vTwinklePhase = fract(worldPos.x * 0.137 + worldPos.y * 0.293) * 6.2831853;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TWINKLE_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vTwinklePhase;

  void main() {
    vec4 texColor = texture2D(map, vUv);

    // Per-star twinkle: combine two sine waves at different frequencies
    float twinkle = 0.75 + 0.25 * sin(uTime * 1.2 + vTwinklePhase)
                        * sin(uTime * 0.7 + vTwinklePhase * 2.3);

    // Brighter core (whiter center, colored edges)
    float coreMask = texColor.r;
    vec3 color = mix(vColor, vec3(1.0), coreMask * 0.6);

    gl_FragColor = vec4(color * texColor.rgb * twinkle, texColor.a * 0.7);
  }
`;

const createStarMaterial = (glowTexture: THREE.Texture): THREE.ShaderMaterial => {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: glowTexture },
      uTime: { value: 0.0 },
    },
    vertexShader: TWINKLE_VERTEX,
    fragmentShader: TWINKLE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
};

// Build the InstancedMesh and apply per-instance transforms and colours.
// Writes directly to typed buffers to bypass Vue reactivity overhead.
const buildMesh = () => {
  const listSong = songsStore.listSong;
  if (listSong.length === 0) { return; }

  const { matrices, colors, sizes, count } = computeBuffers(listSong);

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = createStarMaterial(createGlowTexture());

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

  // Compute bounding volumes so raycasting works on InstancedMesh
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();

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

  // Populate galaxyStore.listStarPosition so flyToStar() can find targets
  const listStarPos = [];
  for (let i = 0; i < count; i += 1) {
    listStarPos.push({
      songId: listSong[i].id,
      x: worldPositions[i].x,
      y: worldPositions[i].y,
    });
  }
  galaxyStore.listStarPosition = listStarPos;

  // Remove old mesh from scene if exists
  if (instancedMesh.value && scene.value) {
    scene.value.remove(instancedMesh.value);
  }

  instancedMesh.value = markRaw(mesh);
  triggerRef(instancedMesh);

  // Add mesh directly to Three.js scene (bypasses <primitive> issues)
  if (scene.value) {
    scene.value.add(mesh);
  }

  if (import.meta.env.DEV) {
    console.log(`StarField: added ${count} stars to scene`);
  }

  // Re-apply active star highlight after mesh rebuild
  previousActiveInstanceId = null;
};

// Track whether we have already built the mesh to prevent duplicate builds.
// App.vue calls fetchSongs() and StarField watches the song list — without
// this guard both onMounted and the watcher could trigger buildMesh().
let meshBuilt = false;

onMounted(() => {
  // If songs were already fetched by App.vue, build immediately
  if (songsStore.listSong.length > 0 && !meshBuilt) {
    meshBuilt = true;
    buildMesh();
  }
});

onUnmounted(() => {
  if (instancedMesh.value && scene.value) {
    scene.value.remove(instancedMesh.value);
  }
});

// Build mesh once songs become available (e.g. slow network, or loaded
// after mount). The meshBuilt guard prevents a redundant second build.
watch(
  () => songsStore.listSong.length,
  (newLen, oldLen) => {
    if (newLen > 0 && oldLen === 0 && !meshBuilt) {
      meshBuilt = true;
      buildMesh();
    }
  },
);

// Hover visual feedback: scale up the hovered star and restore the previous one
const HOVER_SCALE_MULTIPLIER = 3.5;
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

// Camera trail effect — brightens stars swept by the camera path during flyToStar.
// Per-instance fade progress: 0 = fully restored, 1 = fully brightened by trail.
// Using a plain Float32Array (bypasses Vue reactivity) for per-frame performance.
const TRAIL_RADIUS = 30;
const TRAIL_FADE_DURATION = 0.5; // seconds to fade back after trail passes
const trailColorHelper = new THREE.Color();

// Per-instance trail brightness [0,1]: 1 = fully brightened, decays to 0 over fade duration
let trailBrightness: Float32Array = new Float32Array(0);
// Per-instance time (in seconds) since the trail last passed this star; -1 = never touched
let trailPassTime: Float32Array = new Float32Array(0);

// Allocate / reallocate trail arrays whenever the mesh is rebuilt
watch(instancedMesh, (mesh) => {
  if (!mesh) { return; }
  const count = mesh.count;
  trailBrightness = new Float32Array(count);
  trailPassTime = new Float32Array(count).fill(-1);
  activeTrailStars.clear();
});

// Build trail spatial index when world positions become available
watch(listStarWorldPosition, (positions) => {
  if (positions.length > 0) {
    trailSpatialIndex.build(positions);
  }
});

const { onBeforeRender } = useLoop();

// Cap star visual size at high zoom to prevent white-blob effect.
// At zoom > ZOOM_CAP_START, scales are reduced so stars stay readable.
const ZOOM_CAP_START = 6;
const MAX_SCREEN_STAR_SIZE = 5.0; // maximum world-space scale allowed
const ZOOM_CAP_THRESHOLD = 0.5; // only recalculate when zoom changes by this much
const scaleCapHelper = new THREE.Matrix4();
const scaleCapPos = new THREE.Vector3();
const scaleCapQuat = new THREE.Quaternion();
const scaleCapScale = new THREE.Vector3();
let lastAppliedZoom = -1;

const applyScaleCap = (mesh: THREE.InstancedMesh, zoom: number) => {
  const baseScales = listBaseScale.value;
  if (baseScales.length === 0) { return; }

  const count = mesh.count;
  // Scale factor: above ZOOM_CAP_START, shrink proportionally
  const capFactor = zoom > ZOOM_CAP_START
    ? ZOOM_CAP_START / zoom
    : 1;

  for (let i = 0; i < count; i += 1) {
    const baseScale = baseScales[i] ?? 1;
    const cappedScale = Math.min(baseScale * capFactor, MAX_SCREEN_STAR_SIZE);

    mesh.getMatrixAt(i, scaleCapHelper);
    scaleCapHelper.decompose(scaleCapPos, scaleCapQuat, scaleCapScale);
    scaleCapScale.set(cappedScale, cappedScale, 1);
    scaleCapHelper.compose(scaleCapPos, scaleCapQuat, scaleCapScale);
    mesh.setMatrixAt(i, scaleCapHelper);
  }

  mesh.instanceMatrix.needsUpdate = true;
};

let elapsedTime = 0;

onBeforeRender(({ delta }) => {
  const mesh = instancedMesh.value;
  if (!mesh || !mesh.instanceColor) { return; }

  // Update twinkle time uniform
  elapsedTime += delta;
  const mat = mesh.material as THREE.ShaderMaterial;
  if (mat.uniforms?.uTime) {
    mat.uniforms.uTime.value = elapsedTime;
  }

  // Apply star scale cap only when zoom crosses a significant threshold
  // to avoid recalculating all 9111 instances during smooth zoom animations
  const currentZoom = galaxyStore.zoomLevel;
  if (Math.abs(currentZoom - lastAppliedZoom) >= ZOOM_CAP_THRESHOLD || lastAppliedZoom < 0) {
    applyScaleCap(mesh, currentZoom);
    lastAppliedZoom = currentZoom;
  }

  const baseColors = listBaseColor.value;

  // Determine current trail head position via lerp when trail is active
  let trailHeadX = 0;
  let trailHeadY = 0;
  let trailActive = false;

  if (galaxyStore.isTrailActive && galaxyStore.trailStart && galaxyStore.trailEnd) {
    const t = galaxyStore.trailProgress;
    trailHeadX = galaxyStore.trailStart.x + (galaxyStore.trailEnd.x - galaxyStore.trailStart.x) * t;
    trailHeadY = galaxyStore.trailStart.y + (galaxyStore.trailEnd.y - galaxyStore.trailStart.y) * t;
    trailActive = true;
  }

  let needsUpdate = false;

  // Use spatial index to find stars near the trail head — avoids iterating all 9111 stars
  if (trailActive) {
    const listNearbyIndex = trailSpatialIndex.queryNear(trailHeadX, trailHeadY, TRAIL_RADIUS);
    for (let k = 0; k < listNearbyIndex.length; k += 1) {
      const i = listNearbyIndex[k];
      trailBrightness[i] = 1;
      trailPassTime[i] = 0;
      activeTrailStars.add(i);
    }
  }

  // Fade pass: only iterate stars that are currently brightened by the trail
  for (const i of activeTrailStars) {
    trailPassTime[i] += delta;
    const fade = 1 - Math.min(trailPassTime[i] / TRAIL_FADE_DURATION, 1);
    trailBrightness[i] = fade;

    const base = baseColors[i];
    if (!base) { continue; }

    // Lerp from base color toward bright white based on current brightness
    const brightness = trailBrightness[i];
    trailColorHelper.setRGB(
      base.r + (1 - base.r) * brightness,
      base.g + (1 - base.g) * brightness,
      base.b + (1 - base.b) * brightness,
    );
    mesh.setColorAt(i, trailColorHelper);
    needsUpdate = true;

    // Clean up fully faded stars
    if (trailPassTime[i] >= TRAIL_FADE_DURATION) {
      trailPassTime[i] = -1;
      trailBrightness[i] = 0;
      // Restore exact base color
      trailColorHelper.setRGB(base.r, base.g, base.b);
      mesh.setColorAt(i, trailColorHelper);
      activeTrailStars.delete(i);
    }
  }

  if (needsUpdate) {
    mesh.instanceColor.needsUpdate = true;
  }
});

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

// Minimum screen-space distance (px) between two labels to avoid overlap
const LABEL_MIN_SPACING = 80;

// Compute visible star labels projected to screen space.
// Filtered by LOD vote threshold, viewport bounds, spatial culling, and hard cap.
const visibleLabels = computed<IStarLabel[]>(() => {
  if (!showLabels.value) { return []; }

  const camera = props.camera;
  if (!camera) { return []; }

  const listSong = songsStore.listSong;
  const worldPositions = listStarWorldPosition.value;
  const threshold = labelVoteThreshold.value;
  const maxCount = labelMaxCount.value;

  if (listSong.length === 0 || worldPositions.length === 0 || maxCount === 0) { return []; }

  // Collect candidates that pass the vote threshold and are on screen
  const listCandidate: (IStarLabel & { voteCount: number })[] = [];

  for (let i = 0; i < listSong.length; i += 1) {
    const song = listSong[i];

    if (song.vote_count < threshold) { continue; }

    const worldPos = worldPositions[i];
    if (!worldPos) { continue; }

    const screenPos = projectToScreen(worldPos, camera);
    if (!screenPos) { continue; }

    listCandidate.push({
      x: screenPos.x,
      y: screenPos.y,
      text: song.title,
      songId: song.id,
      voteCount: song.vote_count,
    });
  }

  // Sort by vote count descending so the most popular labels win placement
  listCandidate.sort((a, b) => b.voteCount - a.voteCount);

  // Spatial culling: greedily place labels with minimum spacing between them
  const result: IStarLabel[] = [];
  const spacingSq = LABEL_MIN_SPACING * LABEL_MIN_SPACING;

  for (let i = 0; i < listCandidate.length; i += 1) {
    if (result.length >= maxCount) { break; }

    const candidate = listCandidate[i];
    let isTooClose = false;

    for (let j = 0; j < result.length; j += 1) {
      const placed = result[j];
      const dx = candidate.x - placed.x;
      const dy = candidate.y - placed.y;
      if (dx * dx + dy * dy < spacingSq) {
        isTooClose = true;
        break;
      }
    }

    if (!isTooClose) {
      result.push({
        x: candidate.x,
        y: candidate.y,
        text: candidate.text,
        songId: candidate.songId,
      });
    }
  }

  return result;
});

// Expose the InstancedMesh ref, label data, and world positions so GalaxyScene can consume them
defineExpose({ instancedMesh, visibleLabels, listStarWorldPosition });
</script>

<template>
  <!-- Mesh added directly to scene via useTresContext in buildMesh() -->
  <slot />
</template>
