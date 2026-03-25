import { watchEffect, onMounted, onUnmounted } from "vue";
import { useEventListener, useIntervalFn, useThrottleFn } from "@vueuse/core";
import { supabase } from "@/lib/supabase";
import { usePlayerStore } from "@/stores/player";
import { useGalaxyStore } from "@/stores/galaxy";

// Max age for a presence entry before we consider it stale (60 seconds)
const PRESENCE_MAX_AGE_MS = 60_000;

/**
 * Supabase Presence composable — broadcasts which song the local user is
 * playing and aggregates viewer counts from all connected users.
 *
 * Must be called inside a Vue component's setup context.
 */
export const usePresenceActivity = () => {
  const playerStore = usePlayerStore();
  const galaxyStore = useGalaxyStore();

  // Per-instance session key so HMR gets a fresh key
  const sessionKey = `yozora_presence_${crypto.randomUUID()}`;

  let channel: ReturnType<typeof supabase.channel> | null = null;
  let currentTrackedSongId: number | null = null;

  // ── Track presence (throttled via VueUse) ─────────────────────────
  const doTrack = (songId: number | null): void => {
    if (!channel) {
      return;
    }
    currentTrackedSongId = songId;
    channel.track({ songId, joinedAt: Date.now() });
  };

  const throttledTrack = useThrottleFn(doTrack, 2000);

  const trackSong = (songId: number | null): void => {
    if (!channel || songId === currentTrackedSongId) {
      return;
    }
    throttledTrack(songId);
  };

  // ── Aggregate presence state ──────────────────────────────────────
  const aggregatePresence = (): void => {
    if (!channel) {
      return;
    }

    const state = channel.presenceState();
    const mapCount = galaxyStore.mapActivityCount;
    mapCount.clear();
    const now = Date.now();

    for (const [key, listPresence] of Object.entries(state)) {
      if (key === sessionKey) {
        continue;
      }

      for (let i = 0; i < listPresence.length; i += 1) {
        const p = listPresence[i] as unknown as {
          songId: number | null;
          joinedAt: number;
        };
        const songId = p.songId;
        if (songId === null) {
          continue;
        }
        if (
          p.joinedAt !== undefined &&
          now - p.joinedAt > PRESENCE_MAX_AGE_MS
        ) {
          continue;
        }
        mapCount.set(songId, (mapCount.get(songId) ?? 0) + 1);
      }
    }

    galaxyStore.activityVersion += 1;
  };

  // ── Visibility change (auto-cleanup via useEventListener) ─────────
  useEventListener(document, "visibilitychange", () => {
    if (document.hidden) {
      trackSong(null);
    } else {
      const songId = playerStore.isPlaying
        ? (playerStore.currentSong?.id ?? null)
        : null;
      trackSong(songId);
    }
  });

  // ── Heartbeat every 30s (auto-cleanup via useIntervalFn) ──────────
  useIntervalFn(() => {
    if (currentTrackedSongId !== null && channel) {
      currentTrackedSongId = null; // force re-track
      const songId = playerStore.isPlaying
        ? (playerStore.currentSong?.id ?? null)
        : null;
      doTrack(songId);
    }
    aggregatePresence();
  }, 30_000);

  // ── Single watchEffect replaces two separate watchers ─────────────
  // Auto-stops on unmount — no manual stop handles needed
  watchEffect(() => {
    const song = playerStore.currentSong;
    const playing = playerStore.isPlaying;
    const songId = song && playing ? song.id : null;
    trackSong(songId);
  });

  // ── Channel lifecycle ─────────────────────────────────────────────
  onMounted(() => {
    channel = supabase.channel("galaxy-presence", {
      config: { presence: { key: sessionKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        aggregatePresence();
      })
      .on("presence", { event: "leave" }, () => {
        aggregatePresence();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const songId = playerStore.isPlaying
            ? (playerStore.currentSong?.id ?? null)
            : null;
          doTrack(songId);
        }
      });
  });

  onUnmounted(() => {
    if (channel) {
      channel.untrack();
      supabase.removeChannel(channel);
      channel = null;
    }

    galaxyStore.mapActivityCount.clear();
    galaxyStore.activityVersion += 1;
  });
};
