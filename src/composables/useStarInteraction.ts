import { ref } from "vue";
import * as THREE from "three";
import { useGalaxyStore } from "@/stores/galaxy";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";
import { usePlayer } from "@/composables/usePlayer";
import type { IStarSpatialIndex } from "@/composables/useStarSpatialIndex";

// ─── Constants ───────────────────────────────────────────────────────
// Maximum screen-space distance (px) for a hit
const HIT_RADIUS_PX = 40;
// World-space search radius for the spatial grid (scaled by zoom)
const BASE_SEARCH_RADIUS = 120;
// Throttle hover to ~30 fps
const THROTTLE_MS = 33;

// ─── Reusable THREE objects (allocated once, reused every call) ──────
const _projected = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _unproject = new THREE.Vector3();

// ─── Helpers ─────────────────────────────────────────────────────────

/** Project a star's world position to screen pixels. Always fresh. */
const projectStar = (
  instanceIndex: number,
  mesh: THREE.InstancedMesh,
  cam: THREE.Camera,
): { sx: number; sy: number } | null => {
  mesh.getMatrixAt(instanceIndex, _matrix);
  _matrix.decompose(_pos, _quat, _scale);
  _projected.copy(_pos).project(cam);
  if (_projected.z > 1) {
    return null;
  }
  return {
    sx: (_projected.x * 0.5 + 0.5) * window.innerWidth,
    sy: (-_projected.y * 0.5 + 0.5) * window.innerHeight,
  };
};

/** Convert screen pixels to world XY (orthographic z=0 plane). */
const screenToWorld = (
  screenX: number,
  screenY: number,
  cam: THREE.Camera,
): { wx: number; wy: number } => {
  const ndcX = (screenX / window.innerWidth) * 2 - 1;
  const ndcY = -(screenY / window.innerHeight) * 2 + 1;
  _unproject.set(ndcX, ndcY, 0).unproject(cam);
  return { wx: _unproject.x, wy: _unproject.y };
};

// ─── Composable ──────────────────────────────────────────────────────

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

  /**
   * Find the nearest star to a screen position.
   * Always computes fresh projections — no caching.
   * Ensures the camera projection matrix is up-to-date before projecting.
   */
  const findNearestStar = (screenX: number, screenY: number): number => {
    const mesh = meshRef.value;
    const cam = camera.value;
    if (!mesh || !cam) {
      return -1;
    }

    // Ensure camera matrix is current (may be stale after tab switch,
    // flyToStar animation, or applyScaleCap modifications).
    if ("updateProjectionMatrix" in cam) {
      (cam as THREE.OrthographicCamera).updateProjectionMatrix();
    }

    // Unproject click to world coordinates for spatial query
    const { wx, wy } = screenToWorld(screenX, screenY, cam);
    const zoom = galaxyStore.zoomLevel;
    const searchRadius = BASE_SEARCH_RADIUS / Math.max(zoom, 0.2);

    // Query spatial grid for nearby star indices (~20-50 candidates)
    const listCandidate = spatialIndex.queryNear(wx, wy, searchRadius);

    let bestDist = HIT_RADIUS_PX * HIT_RADIUS_PX;
    let bestIndex = -1;

    for (let i = 0; i < listCandidate.length; i += 1) {
      const idx = listCandidate[i];
      const screenPos = projectStar(idx, mesh, cam);
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

  // ─── Hover (throttled to ~30 fps via RAF) ─────────────────────────

  let lastHoverTime = 0;
  let pendingHoverEvent: MouseEvent | null = null;
  let rafId = 0;

  const processHover = (event: MouseEvent): void => {
    const instanceId = findNearestStar(event.clientX, event.clientY);

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

  // ─── Click ────────────────────────────────────────────────────────

  const onClick = (event: MouseEvent): void => {
    const instanceId = findNearestStar(event.clientX, event.clientY);

    if (instanceId >= 0) {
      const song = songsStore.listSong[instanceId];
      if (song) {
        galaxyStore.flyToStar(song.id);
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
