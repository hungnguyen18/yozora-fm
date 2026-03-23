import { ref, watch, computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";

const STORAGE_KEY = "yozora_discovered_ids";

// Module-level singleton guard — prevents duplicate watchers across multiple calls
let watcherInstalled = false;

// Track the most recent first-time discovery for burst animation
const lastDiscoveryId = ref<number | null>(null);

export const useDiscovery = () => {
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();

  // Persist discovered IDs as JSON array in localStorage
  const listDiscoveredId = useLocalStorage<number[]>(STORAGE_KEY, []);

  const discoveredCount = computed(() => listDiscoveredId.value.length);
  const totalCount = computed(() => songsStore.listSong.length);

  const isDiscovered = (songId: number): boolean => {
    return listDiscoveredId.value.includes(songId);
  };

  // Install watcher once — mark newly played songs as discovered
  if (!watcherInstalled) {
    watcherInstalled = true;

    watch(
      () => playerStore.currentSong,
      (song) => {
        if (!song) {
          return;
        }
        if (!listDiscoveredId.value.includes(song.id)) {
          listDiscoveredId.value.push(song.id);
          lastDiscoveryId.value = song.id;
          // Clear after animation completes
          setTimeout(() => {
            if (lastDiscoveryId.value === song.id) {
              lastDiscoveryId.value = null;
            }
          }, 2000);
        }
      },
    );
  }

  return {
    listDiscoveredId,
    discoveredCount,
    totalCount,
    lastDiscoveryId,
    isDiscovered,
  };
};
