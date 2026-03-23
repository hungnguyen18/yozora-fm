import { watch } from "vue";
import { useGalaxyStore } from "@/stores/galaxy";
import { usePlayerStore } from "@/stores/player";
import { useSongsStore } from "@/stores/songs";

/**
 * Lightweight URL routing via History API.
 * Syncs galaxy.selectedSongId ↔ browser URL path.
 *
 *   /             → galaxy view (no song selected)
 *   /song/:id     → detail panel open for that song
 *
 * Call once from App.vue.
 */
export const useRouting = () => {
  const galaxyStore = useGalaxyStore();
  const playerStore = usePlayerStore();
  const songsStore = useSongsStore();

  // Push URL when selectedSongId changes
  watch(
    () => galaxyStore.selectedSongId,
    (songId) => {
      const currentPath = window.location.pathname;
      if (songId !== null) {
        const target = `/song/${songId}`;
        if (currentPath !== target) {
          window.history.pushState({ songId }, "", target);
        }
      } else {
        if (currentPath !== "/") {
          window.history.pushState({}, "", "/");
        }
      }
    },
  );

  // Handle browser back/forward
  window.addEventListener("popstate", () => {
    const path = window.location.pathname;
    const match = path.match(/^\/song\/(\d+)$/);
    if (match) {
      const songId = parseInt(match[1], 10);
      const song = songsStore.listSong.find((s) => s.id === songId);
      if (song) {
        galaxyStore.selectedSongId = songId;
        playerStore.play(song);
        galaxyStore.flyToStar(songId);
      }
    } else {
      // Navigated back to root — close panel
      if (galaxyStore.selectedSongId !== null) {
        if (playerStore.isPlaying) {
          playerStore.isPip = true;
        }
        galaxyStore.selectedSongId = null;
      }
    }
  });

  // On initial load: if URL has /song/:id, open that song once data is ready
  const restoreFromUrl = (): void => {
    const path = window.location.pathname;
    const match = path.match(/^\/song\/(\d+)$/);
    if (!match) {
      return;
    }

    const songId = parseInt(match[1], 10);

    // Songs might not be loaded yet — watch for them
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
      // Wait until songs are loaded
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
