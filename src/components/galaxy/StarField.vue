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
import { useDiscovery } from '@/composables/useDiscovery';

const songsStore = useSongsStore();
const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const { computeBuffers } = useGalaxyLayout();
const { showLabels, labelVoteThreshold, labelMaxCount } = useLOD();
const { scene } = useTresContext();
const trailSpatialIndex = useStarSpatialIndex();
const { lastDiscoveryId } = useDiscovery();

// Set of star indices currently affected by the trail (brightened or fading).
// Only these are iterated each frame for the fade pass, instead of all 9111 stars.
const activeTrailStars = new Set<number>();

const instancedMesh = shallowRef<THREE.InstancedMesh | null>(null);

// Per-instance base scale cached from buildMesh so hover can restore it
const listBaseScale = ref<number[]>([]);

// Per-instance 3D world position cached for label projection
const listStarWorldPosition = shallowRef<THREE.Vector3[]>([]);

// ═══════════════════════════════════════════════════════════════════
// Procedural star shader — each star has a unique shape generated
// from its world position (used as seed). Variations include:
//   - Spike count: 4, 5, 6, or 8 points
//   - Spike length: short, medium, long
//   - Core size: small or large
//   - Rotation angle: unique per star
//   - Secondary halo intensity
// No texture needed — everything is computed in the fragment shader.
// ═══════════════════════════════════════════════════════════════════

const STAR_VERTEX = /* glsl */ `
  attribute float aType;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  varying float vType;

  void main() {
    vUv = uv;
    vType = aType;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif

    // Derive a unique seed per instance from world position
    vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vSeed = fract(worldPos.x * 0.137 + worldPos.y * 0.293 + worldPos.x * worldPos.y * 0.0017);

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  varying float vType;

  // Hash function for deterministic randomness from seed
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    // Center UV to [-1, 1]
    vec2 uv = (vUv - 0.5) * 2.0;
    float dist = length(uv);

    // Discard pixels outside the circle
    if (dist > 1.0) discard;

    // ── Per-star shape parameters derived from seed ──
    float s = vSeed;
    float spikeCountF = 4.0 + floor(hash(s * 17.3) * 5.0);  // 4,5,6,7,8
    float spikeLength = 0.3 + hash(s * 31.7) * 0.45;         // 0.3–0.75
    float spikeSharpness = 2.0 + hash(s * 53.1) * 6.0;       // 2–8
    float coreSize = 0.08 + hash(s * 71.9) * 0.07;            // 0.08–0.15
    float rotation = hash(s * 97.3) * 6.2831853;              // 0–2π
    float haloStrength = 0.15 + hash(s * 113.7) * 0.2;        // 0.15–0.35

    // ── OP/ED shape differentiation ──
    // OP (vType=0): rounder, softer — larger core, shorter spikes
    // ED (vType=1): sharper, more defined — smaller core, longer spikes
    float typeMix = vType;
    coreSize = mix(coreSize * 1.3, coreSize * 0.8, typeMix);
    spikeLength = mix(spikeLength * 0.7, spikeLength * 1.2, typeMix);
    spikeSharpness = mix(spikeSharpness * 0.8, spikeSharpness * 1.3, typeMix);

    // ── Rotated polar coordinates ──
    float angle = atan(uv.y, uv.x) + rotation;

    // ── Spike shape: modulate radius by cos(angle * spikeCount) ──
    float spikes = pow(abs(cos(angle * spikeCountF / 2.0)), spikeSharpness);
    float spikeRadius = mix(1.0, 1.0 + spikeLength, spikes);

    // ── Core: bright sharp center ──
    float core = exp(-dist / coreSize);

    // ── Inner halo: soft glow around core ──
    float halo = exp(-dist * 3.5) * haloStrength;

    // ── Spike rays: thin bright lines extending outward ──
    float spikeRay = spikes * exp(-dist * 2.0) * spikeLength;

    // ── Outer glow: very soft, large radius ──
    float outerGlow = exp(-dist * 1.8) * 0.12;

    // ── Combine all layers ──
    float brightness = core + halo + spikeRay + outerGlow;

    // ── Twinkle: per-star oscillation ──
    float twinklePhase = vSeed * 6.2831853;
    float twinkle = 0.78 + 0.22 * sin(uTime * 1.3 + twinklePhase)
                        * sin(uTime * 0.8 + twinklePhase * 2.1);
    brightness *= twinkle;

    // ── Color: white core fading to genre color at edges ──
    float coreMask = smoothstep(0.3, 0.0, dist);
    vec3 color = mix(vColor, vec3(1.0), coreMask * 0.7);

    // ── Final alpha: smooth falloff ──
    float alpha = clamp(brightness, 0.0, 1.0);
    // Fade to transparent at edges
    alpha *= smoothstep(1.0, 0.7, dist);

    gl_FragColor = vec4(color * brightness, alpha * 0.8);
  }
`;

const createStarMaterial = (): THREE.ShaderMaterial => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
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
  const material = createStarMaterial();

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

  // Per-instance song type: 0.0 = OP, 1.0 = ED
  const typeData = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    typeData[i] = listSong[i].type === 'ED' ? 1.0 : 0.0;
  }
  const typeAttr = new THREE.InstancedBufferAttribute(typeData, 1);
  mesh.geometry.setAttribute('aType', typeAttr);

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

// Returns the effective color for a star, accounting for genre filter and constellation focus dimming
const getEffectiveColor = (instanceId: number): { r: number; g: number; b: number } | null => {
  const base = listBaseColor.value[instanceId];
  if (!base) { return null; }

  let dim = 1;

  // Genre filter dimming
  const genre = galaxyStore.highlightedGenre;
  if (genre !== null) {
    const song = songsStore.listSong[instanceId];
    if (!song || song.genre !== genre) {
      dim = 0.2;
    }
  }

  // Constellation focus dimming — non-artist stars dim to 30%
  const focusedArtistId = galaxyStore.focusedArtistId;
  if (focusedArtistId !== null) {
    const song = songsStore.listSong[instanceId];
    if (!song || song.artist_id !== focusedArtistId) {
      dim = Math.min(dim, 0.3);
    }
  }

  if (dim >= 1) { return base; }
  return { r: base.r * dim, g: base.g * dim, b: base.b * dim };
};

watch(
  () => playerStore.currentSong,
  (song, _prevSong) => {
    const mesh = instancedMesh.value;
    if (!mesh) { return; }

    // Restore previous active star to its effective colour (respects genre filter) and base scale
    if (previousActiveInstanceId !== null) {
      const prevId = previousActiveInstanceId;
      const effective = getEffectiveColor(prevId);
      if (effective) {
        setInstanceColor(mesh, prevId, effective.r, effective.g, effective.b);
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

// Genre filter: dim non-matching stars when a genre is highlighted
watch(
  () => galaxyStore.highlightedGenre,
  () => {
    const mesh = instancedMesh.value;
    if (!mesh) { return; }
    const listSong = songsStore.listSong;

    for (let i = 0; i < listSong.length; i += 1) {
      const effective = getEffectiveColor(i);
      if (!effective) { continue; }
      setInstanceColor(mesh, i, effective.r, effective.g, effective.b);
    }

    // Re-apply active star white color if a song is playing
    if (previousActiveInstanceId !== null) {
      setInstanceColor(mesh, previousActiveInstanceId, activeColor.r, activeColor.g, activeColor.b);
    }
  },
);

// Constellation focus: dim non-artist stars when focusedArtistId is set
watch(
  () => galaxyStore.focusedArtistId,
  () => {
    const mesh = instancedMesh.value;
    if (!mesh) { return; }
    const listSong = songsStore.listSong;

    for (let i = 0; i < listSong.length; i += 1) {
      const effective = getEffectiveColor(i);
      if (!effective) { continue; }
      setInstanceColor(mesh, i, effective.r, effective.g, effective.b);
    }

    // Re-apply active star white color if a song is playing
    if (previousActiveInstanceId !== null) {
      setInstanceColor(mesh, previousActiveInstanceId, activeColor.r, activeColor.g, activeColor.b);
    }
  },
);

// Discovery burst — golden flash + scale pulse when a song is played for the first time.
// The burst lasts ~1.5s: scale up 3x then ease back, color flashes gold then restores.
const DISCOVERY_BURST_DURATION = 1.5; // seconds
const DISCOVERY_BURST_SCALE = 3.0;
const discoveryGoldColor = new THREE.Color(1.0, 0.84, 0.0); // #FFD700 gold
let discoveryBurstInstanceId: number | null = null;
let discoveryBurstElapsed = -1;

watch(lastDiscoveryId, (songId) => {
  if (songId === null) { return; }
  const mesh = instancedMesh.value;
  if (!mesh) { return; }

  const listSong = songsStore.listSong;
  const instanceId = listSong.findIndex((s) => s.id === songId);
  if (instanceId === -1) { return; }

  discoveryBurstInstanceId = instanceId;
  discoveryBurstElapsed = 0;
});

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
const ZOOM_CAP_START = 15;
const MAX_SCREEN_STAR_SIZE = 12.0; // maximum world-space scale allowed
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
  // Scale factor: above ZOOM_CAP_START, shrink with cube root curve
  // (very gentle — stars remain large even at extreme zoom)
  const capFactor = zoom > ZOOM_CAP_START
    ? Math.cbrt(ZOOM_CAP_START / zoom)
    : 1;

  for (let i = 0; i < count; i += 1) {
    const baseScale = baseScales[i] ?? 1;
    let cappedScale = Math.min(baseScale * capFactor, MAX_SCREEN_STAR_SIZE);

    // Preserve hover/active scale multipliers
    if (i === previousHoveredId) {
      cappedScale *= HOVER_SCALE_MULTIPLIER;
    } else if (i === previousActiveInstanceId) {
      cappedScale *= ACTIVE_SCALE_MULTIPLIER;
    }

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

  // Discovery burst animation — golden flash + scale pulse on first-time plays
  if (discoveryBurstInstanceId !== null && discoveryBurstElapsed >= 0) {
    discoveryBurstElapsed += delta;
    const t = Math.min(discoveryBurstElapsed / DISCOVERY_BURST_DURATION, 1);

    // Ease-out curve: fast start, slow finish
    const ease = 1 - (1 - t) * (1 - t);

    // Scale: burst up then ease back to base
    const baseScale = listBaseScale.value[discoveryBurstInstanceId] ?? 1;
    const burstScale = baseScale * (1 + (DISCOVERY_BURST_SCALE - 1) * (1 - ease));
    setInstanceScale(mesh, discoveryBurstInstanceId, burstScale);

    // Color: gold lerping back to white (active star color)
    const goldLerp = 1 - ease;
    setInstanceColor(
      mesh,
      discoveryBurstInstanceId,
      1.0,
      1.0 - (1.0 - discoveryGoldColor.g) * goldLerp,
      1.0 - (1.0 - discoveryGoldColor.b) * goldLerp,
    );

    if (t >= 1) {
      // Burst complete — restore to active star white + active scale
      setInstanceColor(mesh, discoveryBurstInstanceId, activeColor.r, activeColor.g, activeColor.b);
      setInstanceScale(mesh, discoveryBurstInstanceId, baseScale * ACTIVE_SCALE_MULTIPLIER);
      discoveryBurstInstanceId = null;
      discoveryBurstElapsed = -1;
    }
  }

  // Playback pulse — active star breathes with simulated BPM
  if (
    previousActiveInstanceId !== null
    && playerStore.isPlaying
    && discoveryBurstInstanceId !== previousActiveInstanceId
  ) {
    const genre = playerStore.currentSong?.genre ?? 'pop';
    const bpmMap: Record<string, number> = {
      rock: 140, electronic: 140, pop: 120, ballad: 80, orchestral: 100, other: 110,
    };
    const bpm = bpmMap[genre] ?? 110;
    const beatsPerSec = bpm / 60;

    // Sine wave: 0 to 1, synced to elapsedTime
    const beat = Math.sin(elapsedTime * beatsPerSec * Math.PI * 2) * 0.5 + 0.5;

    // Subtle scale pulse: base * ACTIVE_SCALE_MULTIPLIER * (1 + beat * 0.15)
    const baseScale = listBaseScale.value[previousActiveInstanceId] ?? 1;
    const pulseScale = baseScale * ACTIVE_SCALE_MULTIPLIER * (1 + beat * 0.15);
    setInstanceScale(mesh, previousActiveInstanceId, pulseScale);

    // Subtle brightness pulse: lerp between white and slightly brighter white
    const brightness = 0.85 + beat * 0.15;
    setInstanceColor(mesh, previousActiveInstanceId, brightness, brightness, brightness);
  }

  // Apply star scale cap only when zoom crosses a significant threshold
  // and not during flyToStar animation (avoid 18+ fires of 9111 matrix ops)
  const currentZoom = galaxyStore.zoomLevel;
  const isAnimating = galaxyStore.isTrailActive;
  if (!isAnimating && (Math.abs(currentZoom - lastAppliedZoom) >= ZOOM_CAP_THRESHOLD || lastAppliedZoom < 0)) {
    applyScaleCap(mesh, currentZoom);
    lastAppliedZoom = currentZoom;
  }
  // Force one scale cap update when flyToStar animation ends (zoom changed during it)
  if (!isAnimating && lastAppliedZoom >= 0 && Math.abs(currentZoom - lastAppliedZoom) > 0.01) {
    applyScaleCap(mesh, currentZoom);
    lastAppliedZoom = currentZoom;
  }

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

  // Fade pass: snapshot the set to avoid mutation during iteration
  const trailSnapshot = Array.from(activeTrailStars);
  for (let k = 0; k < trailSnapshot.length; k += 1) {
    const i = trailSnapshot[k];

    // Skip the active (playing) star — preserve its white highlight
    if (i === previousActiveInstanceId) {
      activeTrailStars.delete(i);
      trailPassTime[i] = -1;
      trailBrightness[i] = 0;
      continue;
    }

    trailPassTime[i] += delta;
    const fade = 1 - Math.min(trailPassTime[i] / TRAIL_FADE_DURATION, 1);
    trailBrightness[i] = fade;

    const effective = getEffectiveColor(i);
    if (!effective) { continue; }

    // Lerp from effective color toward bright white based on current brightness
    const brightness = trailBrightness[i];
    trailColorHelper.setRGB(
      effective.r + (1 - effective.r) * brightness,
      effective.g + (1 - effective.g) * brightness,
      effective.b + (1 - effective.b) * brightness,
    );
    mesh.setColorAt(i, trailColorHelper);
    needsUpdate = true;

    // Clean up fully faded stars
    if (trailPassTime[i] >= TRAIL_FADE_DURATION) {
      trailPassTime[i] = -1;
      trailBrightness[i] = 0;
      // Restore effective color (respects genre filter)
      trailColorHelper.setRGB(effective.r, effective.g, effective.b);
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
