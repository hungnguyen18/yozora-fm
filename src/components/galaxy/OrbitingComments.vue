<script setup lang="ts">
// OrbitingComments — space emoji + comment text orbiting the active star.
// Each bubble = 1 comment. Emoji icon always visible, comment text appears for a random window then fades.
// Pure HTML/CSS overlay — no Three.js overhead for text rendering.

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { guestNameFromId } from '@/composables/useGuestIdentity';

import { supabase } from '@/lib/supabase';
import type { TGenre } from '@/types';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const { computeSinglePosition } = useGalaxyLayout();

const TAU = Math.PI * 2;
const MAX_COMMENT = 20;

const LIST_EMOJI = ['🚀', '☄️', '🛸', '🌙', '🛰️', '⭐', '🌠', '💫', '🪐', '🔭', '👽', '✨', '🌑', '💎', '☀️'];

// Deterministic hash
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── Comment data ──
interface IOrbitComment {
  id: number;
  username: string;
  content: string;
  emoji: string;
  radius: number;       // orbit radius in px
  speed: number;        // radians per second (gentle)
  phase: number;        // starting angle
  direction: number;    // 1 or -1
  showTextAt: number;   // elapsed time to start showing text
  showTextDuration: number; // how long text is visible (seconds)
}

const listOrbitComment = ref<IOrbitComment[]>([]);
const isVisible = ref(false);
const elapsed = ref(0);
let animFrameId = 0;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

// ── Screen position of active star ──
const starScreenX = ref(0);
const starScreenY = ref(0);

const updateStarScreen = (): void => {
  const song = playerStore.currentSong;
  if (!song) { return; }

  const pos = computeSinglePosition(song.id, song.year ?? 1980, song.genre as TGenre | undefined);

  // World → screen: apply camera pan and zoom
  const container = document.querySelector('canvas')?.parentElement;
  if (!container) { return; }

  const rect = container.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  starScreenX.value = cx + (pos.x - galaxyStore.panX) * galaxyStore.zoomLevel;
  starScreenY.value = cy - (pos.y - galaxyStore.panY) * galaxyStore.zoomLevel;
};

// ── Fetch comments + build orbit data ──
const fetchAndBuild = async (songId: number): Promise<void> => {
  const { data } = await supabase
    .from('comments')
    .select('id, content, guest_name')
    .eq('song_id', songId)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(MAX_COMMENT);

  if (!data || data.length === 0) {
    listOrbitComment.value = [];
    return;
  }

  const count = data.length;
  const list: IOrbitComment[] = [];

  for (let i = 0; i < count; i += 1) {
    const h1 = hash(data[i].id * 7 + 13);
    const h2 = hash(data[i].id * 31 + 7);
    const h3 = hash(data[i].id * 53 + 19);

    list.push({
      id: data[i].id,
      username: (data[i] as Record<string, unknown>).guest_name as string ?? guestNameFromId(data[i].id),
      content: data[i].content.slice(0, 60) + (data[i].content.length > 60 ? '…' : ''),
      emoji: LIST_EMOJI[data[i].id % LIST_EMOJI.length],
      radius: 60 + (i / count) * 120 + h2 * 40,
      speed: 0.08 + h1 * 0.15,  // gentle: 0.08–0.23 rad/s
      phase: (i / count) * TAU + h2 * 2,
      direction: h3 > 0.5 ? 1 : -1,
      showTextAt: h1 * 12,        // stagger text reveal: 0–12s
      showTextDuration: 3 + h2 * 4, // visible for 3–7s
    });
  }

  listOrbitComment.value = list;
};

// ── Realtime subscription ──
const subscribeRealtime = (songId: number): void => {
  unsubscribeRealtime();
  realtimeChannel = supabase
    .channel(`orbit-comments:${songId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `song_id=eq.${songId}`,
      },
      () => {
        fetchAndBuild(songId);
      },
    )
    .subscribe();
};

const unsubscribeRealtime = (): void => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
};

// ── Computed: per-comment position + text visibility ──
const listCommentStyle = computed(() => {
  return listOrbitComment.value.map((c) => {
    const angle = c.phase + elapsed.value * c.speed * c.direction;
    const x = Math.cos(angle) * c.radius;
    const y = Math.sin(angle) * c.radius;

    // Text visibility: cycle every (showTextAt + showTextDuration + 2s gap)
    const cycle = c.showTextAt + c.showTextDuration + 2;
    const t = elapsed.value % cycle;
    const isTextVisible = t >= c.showTextAt && t < c.showTextAt + c.showTextDuration;

    return {
      id: c.id,
      emoji: c.emoji,
      username: c.username,
      content: c.content,
      x,
      y,
      isTextVisible,
    };
  });
});

// ── Animation loop — throttled to 30fps for performance ──
let lastTickTime = 0;
const TICK_INTERVAL = 1000 / 30;

const tickThrottled = (now: number): void => {
  animFrameId = requestAnimationFrame(tickThrottled);
  if (now - lastTickTime < TICK_INTERVAL) { return; }
  const dt = (now - lastTickTime) / 1000;
  lastTickTime = now;
  elapsed.value += dt;
  updateStarScreen();
};

// ── Watch song changes ──
watch(
  () => playerStore.currentSong,
  async (song) => {
    if (!song) {
      isVisible.value = false;
      listOrbitComment.value = [];
      unsubscribeRealtime();
      return;
    }

    elapsed.value = 0;
    isVisible.value = true;
    await fetchAndBuild(song.id);
    subscribeRealtime(song.id);
  },
  { immediate: true },
);

// React to local comment additions (bypass realtime delay)
watch(
  () => playerStore.commentVersion,
  () => {
    const song = playerStore.currentSong;
    if (song) {
      fetchAndBuild(song.id);
    }
  },
);

onMounted(() => {
  lastTickTime = performance.now();
  animFrameId = requestAnimationFrame(tickThrottled);
});

onUnmounted(() => {
  cancelAnimationFrame(animFrameId);
  unsubscribeRealtime();
});
</script>

<template>
  <div
    v-if="isVisible && listOrbitComment.length > 0"
    class="orbiting-comments"
    :style="{
      left: starScreenX + 'px',
      top: starScreenY + 'px',
    }"
  >
    <div
      v-for="item in listCommentStyle"
      :key="item.id"
      class="orbit-bubble"
      :style="{
        transform: `translate(${item.x}px, ${item.y}px)`,
      }"
    >
      <span class="orbit-emoji">{{ item.emoji }}</span>
      <Transition name="comment-fade">
        <span
          v-if="item.isTextVisible"
          class="orbit-text"
        >
          <span class="orbit-text__name">{{ item.username }}</span>
          {{ item.content }}
        </span>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.orbiting-comments {
  position: fixed;
  z-index: 25;
  pointer-events: none;
  /* transform origin is the star's screen position */
}

.orbit-bubble {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  will-change: transform;
}

.orbit-emoji {
  font-size: 1.125rem;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
  flex-shrink: 0;
}

.orbit-text__name {
  color: rgba(129, 140, 248, 0.85);
  font-weight: 600;
  margin-right: 4px;
}

.orbit-text {
  display: inline-block;
  max-width: 220px;
  padding: 3px 8px;
  background: rgba(10, 11, 26, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(232, 232, 240, 0.8);
  font-size: 0.6875rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Fade transition for comment text */
.comment-fade-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.comment-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.comment-fade-enter-from {
  opacity: 0;
  transform: translateX(-4px);
}

.comment-fade-leave-to {
  opacity: 0;
  transform: translateX(4px);
}
</style>
