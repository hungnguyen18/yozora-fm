import { ref } from "vue";
import * as THREE from "three";
import { useGalaxyStore } from "@/stores/galaxy";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";
import { usePlayer } from "@/composables/usePlayer";
import type { IStarSpatialIndex } from "@/composables/useStarSpatialIndex";

// Maximum screen-space distance (pixels) to count as a star click/hover.
const HIT_RADIUS_PX = 40;

// World-space search radius used to query the spatial grid.
// This is dynamically scaled by zoom so fewer stars are checked at far zoom.
const BASE_SEARCH_RADIUS = 120;

// Throttle hover detection to ~30 fps (33ms)
const THROTTLE_MS = 33;

export const useStarInteraction = (
  meshRef: { value: THREE.InstancedMesh | null },
  camera: { value: THREE.Camera | null },
  spatialIndex: IStarSpatialIndex,
) => {
  const galaxyStore = useGalaxyStore();
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();
  const { play: playAudio } = usePlayer();

  const hoveredInstanceId = ref<number | null>(null);

  // Tooltip state
  const tooltipVisible = ref(false);
  const tooltipX = ref(0);
  const tooltipY = ref(0);
  const tooltipText = ref("");

  // Reusable vectors for projection
  const _projected = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();
  const _matrix = new THREE.Matrix4();

  // Reusable vector for unprojecting screen to world
  const _unprojectNear = new THREE.Vector3();

  // Screen projection cache — invalidated when camera moves
  let cachedProjections: Map<number, { sx: number; sy: number }> = new Map();
  let cacheZoom = -1;
  let cachePanX = NaN;
  let cachePanY = NaN;

  const isCacheValid = (): boolean => {
    return (
      cacheZoom === galaxyStore.zoomLevel &&
      cachePanX === galaxyStore.panX &&
      cachePanY === galaxyStore.panY
    );
  };

  const invalidateCache = (): void => {
    cachedProjections.clear();
    cacheZoom = galaxyStore.zoomLevel;
    cachePanX = galaxyStore.panX;
    cachePanY = galaxyStore.panY;
  };

  // Project a single star instance to screen pixels, using cache when valid.
  const projectInstance = (
    instanceIndex: number,
    mesh: THREE.InstancedMesh,
    cam: THREE.Camera,
  ): { sx: number; sy: number } | null => {
    const cached = cachedProjections.get(instanceIndex);
    if (cached) {
      return cached;
    }

    mesh.getMatrixAt(instanceIndex, _matrix);
    _matrix.decompose(_pos, _quat, _scale);

    _projected.copy(_pos).project(cam);

    // Skip points behind camera
    if (_projected.z > 1) {
      return null;
    }

    const sx = (_projected.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-_projected.y * 0.5 + 0.5) * window.innerHeight;

    const result = { sx, sy };
    cachedProjections.set(instanceIndex, result);
    return result;
  };

  // Unproject screen position to world XY (z=0 plane for orthographic camera)
  const screenToWorld = (
    screenX: number,
    screenY: number,
    cam: THREE.Camera,
  ): { wx: number; wy: number } => {
    // Convert screen pixels to NDC
    const ndcX = (screenX / window.innerWidth) * 2 - 1;
    const ndcY = -(screenY / window.innerHeight) * 2 + 1;

    _unprojectNear.set(ndcX, ndcY, 0);
    _unprojectNear.unproject(cam);

    return { wx: _unprojectNear.x, wy: _unprojectNear.y };
  };

  // Find the nearest star instance to a screen position (in pixels).
  // Uses the spatial index to only check nearby stars (~20-50) instead of all 9111.
  const findNearestStar = (
    screenX: number,
    screenY: number,
    hitRadiusPx: number,
  ): number => {
    const mesh = meshRef.value;
    const cam = camera.value;
    if (!mesh || !cam) {
      return -1;
    }

    // Invalidate projection cache when camera has moved
    if (!isCacheValid()) {
      invalidateCache();
    }

    // Unproject screen position to world coordinates
    const { wx, wy } = screenToWorld(screenX, screenY, cam);

    // Scale search radius inversely with zoom — at higher zoom, stars are
    // spread further apart in screen space so we need a smaller world radius
    const zoom = galaxyStore.zoomLevel;
    const searchRadius = BASE_SEARCH_RADIUS / Math.max(zoom, 0.2);

    // Query the spatial grid for candidate star indices
    const listCandidate = spatialIndex.queryNear(wx, wy, searchRadius);

    let bestDist = hitRadiusPx * hitRadiusPx;
    let bestIndex = -1;

    for (let i = 0; i < listCandidate.length; i += 1) {
      const idx = listCandidate[i];
      const screenPos = projectInstance(idx, mesh, cam);
      if (!screenPos) {
        continue;
      }

      const dx = screenPos.sx - screenX;
      const dy = screenPos.sy - screenY;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDist) {
        bestDist = distSq;
        bestIndex = idx;
      }
    }

    return bestIndex;
  };

  // RAF-based throttle: at most one hover check per animation frame, capped at ~30fps
  let lastHoverTime = 0;
  let pendingHoverEvent: MouseEvent | null = null;
  let rafId = 0;

  const processHover = (event: MouseEvent): void => {
    const instanceId = findNearestStar(
      event.clientX,
      event.clientY,
      HIT_RADIUS_PX,
    );

    if (instanceId >= 0) {
      const song = songsStore.listSong[instanceId];

      if (song) {
        hoveredInstanceId.value = instanceId;
        galaxyStore.hoveredStarId = song.id;

        tooltipVisible.value = true;
        tooltipX.value = event.clientX + 12;
        tooltipY.value = event.clientY + 12;
        tooltipText.value = song.title;
      }
    } else {
      hoveredInstanceId.value = null;
      galaxyStore.hoveredStarId = null;
      tooltipVisible.value = false;
    }
  };

  const flushPendingHover = (): void => {
    rafId = 0;
    if (!pendingHoverEvent) {
      return;
    }

    const now = performance.now();
    if (now - lastHoverTime < THROTTLE_MS) {
      // Still within throttle window — schedule again on next frame
      rafId = requestAnimationFrame(flushPendingHover);
      return;
    }

    lastHoverTime = now;
    const event = pendingHoverEvent;
    pendingHoverEvent = null;
    processHover(event);
  };

  const onMouseMove = (event: MouseEvent): void => {
    pendingHoverEvent = event;

    if (rafId === 0) {
      rafId = requestAnimationFrame(flushPendingHover);
    }
  };

  const onClick = (event: MouseEvent): void => {
    // If a star is already hovered, use it directly (most accurate —
    // hover detection already found the closest star to the cursor).
    let instanceId = hoveredInstanceId.value;

    if (instanceId === null || instanceId < 0) {
      // Force-invalidate cache so click uses fresh projections
      invalidateCache();
      instanceId = findNearestStar(event.clientX, event.clientY, HIT_RADIUS_PX);
    }

    if (instanceId >= 0) {
      const song = songsStore.listSong[instanceId];

      if (song) {
        // Fly camera to the clicked star and zoom in for focus
        galaxyStore.flyToStar(song.id);
        // Call playAudio directly in the click handler (synchronous)
        // so the browser's user-gesture context is preserved.
        playAudio(song);
        playerStore.play(song);
      }
    }
  };

  return {
    hoveredInstanceId,
    tooltipVisible,
    tooltipX,
    tooltipY,
    tooltipText,
    onMouseMove,
    onClick,
  };
};
