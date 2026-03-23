import { ref } from 'vue';
import * as THREE from 'three';
import { useGalaxyStore } from '@/stores/galaxy';
import { usePlayerStore } from '@/stores/player';
import { useSongsStore } from '@/stores/songs';

export const useStarInteraction = (
  meshRef: { value: THREE.InstancedMesh | null },
  camera: { value: THREE.Camera | null },
) => {
  const galaxyStore = useGalaxyStore();
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const hoveredInstanceId = ref<number | null>(null);

  // Tooltip state
  const tooltipVisible = ref(false);
  const tooltipX = ref(0);
  const tooltipY = ref(0);
  const tooltipText = ref('');

  // Convert a MouseEvent to Normalized Device Coordinates [-1, 1]
  const toNDC = (event: MouseEvent): void => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  const castRay = (): THREE.Intersection | null => {
    const mesh = meshRef.value;
    const cam = camera.value;
    if (!mesh || !cam) {
      return null;
    }

    raycaster.setFromCamera(mouse, cam);
    const intersections = raycaster.intersectObject(mesh);

    if (intersections.length > 0) {
      return intersections[0];
    }

    return null;
  };

  const onMouseMove = (event: MouseEvent): void => {
    toNDC(event);
    const hit = castRay();

    if (hit !== null && hit.instanceId !== undefined) {
      const instanceId = hit.instanceId;
      const song = songsStore.listSong[instanceId];

      if (song) {
        hoveredInstanceId.value = instanceId;
        galaxyStore.hoveredStarId = song.id;

        tooltipVisible.value = true;
        // Offset tooltip slightly so it does not sit directly under the cursor
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
    toNDC(event);
    const hit = castRay();

    if (hit !== null && hit.instanceId !== undefined) {
      const instanceId = hit.instanceId;
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
