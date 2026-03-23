import { useEventListener } from "@vueuse/core";
import { useGalaxyStore } from "@/stores/galaxy";
import { usePlayerStore } from "@/stores/player";

const PAN_STEP = 20;
const ZOOM_FACTOR_IN = 1.15;
const ZOOM_FACTOR_OUT = 0.85;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 120;

const isInputElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
};

export const useKeyboardNav = () => {
  const galaxyStore = useGalaxyStore();
  const playerStore = usePlayerStore();

  useEventListener(window, "keydown", (e: KeyboardEvent) => {
    if (isInputElement(e.target)) {
      return;
    }

    const panScale = 1 / galaxyStore.zoomLevel;

    switch (e.key) {
      // Arrow keys for panning
      case "ArrowLeft": {
        e.preventDefault();
        galaxyStore.setPan(
          galaxyStore.panX - PAN_STEP * panScale,
          galaxyStore.panY,
        );
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        galaxyStore.setPan(
          galaxyStore.panX + PAN_STEP * panScale,
          galaxyStore.panY,
        );
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        galaxyStore.setPan(
          galaxyStore.panX,
          galaxyStore.panY + PAN_STEP * panScale,
        );
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        galaxyStore.setPan(
          galaxyStore.panX,
          galaxyStore.panY - PAN_STEP * panScale,
        );
        break;
      }

      // +/= for zoom in, -/_ for zoom out
      case "+":
      case "=": {
        e.preventDefault();
        const zoomIn = Math.min(
          MAX_ZOOM,
          galaxyStore.zoomLevel * ZOOM_FACTOR_IN,
        );
        galaxyStore.setZoomLevel(zoomIn);
        break;
      }
      case "-":
      case "_": {
        e.preventDefault();
        const zoomOut = Math.max(
          MIN_ZOOM,
          galaxyStore.zoomLevel * ZOOM_FACTOR_OUT,
        );
        galaxyStore.setZoomLevel(zoomOut);
        break;
      }

      // Escape to close detail panel
      case "Escape": {
        if (playerStore.currentSong !== null) {
          e.preventDefault();
          if (playerStore.isPlaying) {
            playerStore.isPip = true;
          } else {
            playerStore.stop();
          }
          galaxyStore.selectedSongId = null;
        }
        break;
      }

      // Space to toggle play/pause
      case " ": {
        e.preventDefault();
        if (playerStore.currentSong !== null) {
          if (playerStore.isPlaying) {
            playerStore.pause();
          } else {
            playerStore.resume();
          }
        }
        break;
      }

      // N for next song
      case "n":
      case "N": {
        if (playerStore.autoPlay && playerStore.currentSong !== null) {
          e.preventDefault();
          playerStore.next();
        }
        break;
      }

      default:
        break;
    }
  });
};
