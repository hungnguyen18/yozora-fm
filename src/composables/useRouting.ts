import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGalaxyStore } from "@/stores/galaxy";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";

/**
 * Syncs galaxy.selectedSongId ↔ vue-router URL.
 *
 *   /             → galaxy view (no song selected)
 *   /song/:id     → detail panel open for that song
 *
 * Call once from GalaxyView.vue.
 */
export const useRouting = () => {
  const route = useRoute();
  const router = useRouter();
  const galaxyStore = useGalaxyStore();
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();

  // Push URL when selectedSongId changes + close PiP when panel opens
  watch(
    () => galaxyStore.selectedSongId,
    (songId) => {
      if (songId !== null) {
        playerStore.isPip = false;
        const target = `/song/${songId}`;
        if (route.path !== target) {
          router.push(target);
        }
      } else {
        if (route.path !== "/") {
          router.push("/");
        }
      }
    },
  );

  // Handle route changes (browser back/forward)
  watch(
    () => route.params.id,
    (id) => {
      if (id) {
        const songId = parseInt(id as string, 10);
        const song = songsStore.listSong.find((s) => s.id === songId);
        if (song) {
          galaxyStore.selectedSongId = songId;
          playerStore.play(song);
          galaxyStore.flyToStar(songId);
        }
      } else if (route.name === "galaxy") {
        if (galaxyStore.selectedSongId !== null) {
          if (playerStore.isPlaying) {
            playerStore.isPip = true;
          }
          galaxyStore.selectedSongId = null;
        }
      }
    },
  );

  // On initial load: if URL has /song/:id, open that song once data is ready
  const restoreFromUrl = (): void => {
    const id = route.params.id as string | undefined;
    if (!id) {
      return;
    }

    const songId = parseInt(id, 10);

    const tryRestore = (): boolean => {
      if (songsStore.listSong.length === 0) {
        return false;
      }
      const song = songsStore.listSong.find((s) => s.id === songId);
      if (song) {
        galaxyStore.selectedSongId = songId;
        playerStore.play(song);
        galaxyStore.flyToStar(songId);
      }
      return true;
    };

    if (!tryRestore()) {
      const unwatch = watch(
        () => songsStore.listSong.length,
        (length) => {
          if (length > 0) {
            tryRestore();
            unwatch();
          }
        },
      );
    }
  };

  restoreFromUrl();
};
