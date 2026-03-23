import { ref } from "vue";
import * as THREE from "three";
import { useGalaxyStore } from "@/stores/galaxy";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";

// Maximum screen-space distance (pixels) to count as a star click/hover
const HIT_RADIUS_PX = 16;

export const useStarInteraction = (
  meshRef: { value: THREE.InstancedMesh | null },
  camera: { value: THREE.Camera | null },
) => {
  const galaxyStore = useGalaxyStore();
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();

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

  // Find the nearest star instance to a screen position (in pixels).
  // Returns the instance index or -1 if none is within HIT_RADIUS_PX.
  const findNearestStar = (screenX: number, screenY: number): number => {
    const mesh = meshRef.value;
    const cam = camera.value;
    if (!mesh || !cam) {
      return -1;
    }

    let bestDist = HIT_RADIUS_PX * HIT_RADIUS_PX;
    let bestIndex = -1;

    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, _matrix);
      _matrix.decompose(_pos, _quat, _scale);

      // Project world position to NDC then to screen pixels
      _projected.copy(_pos).project(cam);

      // Skip points behind camera
      if (_projected.z > 1) {
        continue;
      }

      const sx = (_projected.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_projected.y * 0.5 + 0.5) * window.innerHeight;

      const dx = sx - screenX;
      const dy = sy - screenY;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDist) {
        bestDist = distSq;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  const onMouseMove = (event: MouseEvent): void => {
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

  const onClick = (event: MouseEvent): void => {
    const instanceId = findNearestStar(event.clientX, event.clientY);

    if (instanceId >= 0) {
      const song = songsStore.listSong[instanceId];

      if (song) {
        galaxyStore.selectedSongId = song.id;
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
