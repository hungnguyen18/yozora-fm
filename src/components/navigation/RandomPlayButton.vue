<script setup lang="ts">
import { ref, computed } from 'vue';
import { Zap } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';
import { useSongsStore } from '@/stores/songs';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

interface IEraSegment {
  decade: number;
  shortLabel: string;
  name: string;
  songCount: number;
  dominantGenreColor: string;
}

const playerStore = usePlayerStore();
const songsStore = useSongsStore();

// Which segment is currently pulsing (after click)
const pulsingDecade = ref<number | null>(null);

// Compute era stats from song data
const listEraSegment = computed((): IEraSegment[] => {
  const listSong = songsStore.listSong;
  const eraDefinitions: { decade: number; shortLabel: string; name: string }[] = [
    { decade: 1980, shortLabel: '80s', name: 'Dawn' },
    { decade: 1990, shortLabel: '90s', name: 'Golden' },
    { decade: 2000, shortLabel: '00s', name: 'Digital' },
    { decade: 2010, shortLabel: '10s', name: 'Stream' },
    { decade: 2020, shortLabel: '20s', name: 'New' },
  ];

  return eraDefinitions.map((era) => {
    const genreCount: Record<string, number> = {};
    let songCount = 0;

    for (let i = 0; i < listSong.length; i += 1) {
      const s = listSong[i];
      const songDecade = Math.floor((s.year ?? 1980) / 10) * 10;
      if (songDecade === era.decade) {
        songCount += 1;
        const genre = s.genre ?? 'other';
        genreCount[genre] = (genreCount[genre] ?? 0) + 1;
      }
    }

    // Find dominant genre
    let topGenre = 'other';
    let topCount = 0;
    for (const [genre, count] of Object.entries(genreCount)) {
      if (count > topCount) {
        topCount = count;
        topGenre = genre;
      }
    }

    return {
      decade: era.decade,
      shortLabel: era.shortLabel,
      name: era.name,
      songCount,
      dominantGenreColor: GENRE_COLOR_MAP[topGenre as TGenre] ?? GENRE_COLOR_MAP.other,
    };
  });
});

// Which decade is currently playing
const activeDecade = computed((): number | null => {
  const song = playerStore.currentSong;
  if (!song?.year) {
    return null;
  }
  return Math.floor(song.year / 10) * 10;
});

const formatCount = (n: number): string => {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
};

const onEraClick = (decade: number): void => {
  pulsingDecade.value = decade;
  setTimeout(() => {
    pulsingDecade.value = null;
  }, 600);
  playerStore.playRandom(decade);
};

const onWarpClick = (): void => {
  pulsingDecade.value = -1;
  setTimeout(() => {
    pulsingDecade.value = null;
  }, 600);
  playerStore.playRandom();
};
</script>

<template>
  <div class="era-dial">
    <!-- Era segments -->
    <div class="era-dial__bar">
      <button
        v-for="era in listEraSegment"
        :key="era.decade"
        class="era-segment"
        :class="{
          'era-segment--active': activeDecade === era.decade,
          'era-segment--pulsing': pulsingDecade === era.decade,
        }"
        :style="{
          '--era-color': era.dominantGenreColor,
        }"
        :title="`Tune into the ${era.shortLabel}`"
        @click="onEraClick(era.decade)"
      >
        <!-- Glowing top edge -->
        <span class="era-segment__glow" />
        <!-- Pulse ring (on click) -->
        <span
          v-if="pulsingDecade === era.decade"
          class="era-segment__pulse"
        />
        <span class="era-segment__decade">{{ era.shortLabel }}</span>
        <span class="era-segment__name">{{ era.name }}</span>
        <span class="era-segment__count">{{ formatCount(era.songCount) }}</span>
      </button>

      <!-- Divider -->
      <span class="era-dial__divider" />

      <!-- Warp (random) button -->
      <button
        class="warp-btn"
        :class="{ 'warp-btn--pulsing': pulsingDecade === -1 }"
        title="Warp — random era"
        @click="onWarpClick"
      >
        <span
          v-if="pulsingDecade === -1"
          class="warp-btn__pulse"
        />
        <Zap :size="14" fill="currentColor" />
        <span class="warp-btn__label">Warp</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════
   ERA DIAL — Cosmic Radio Tuner
   ═══════════════════════════════════════════════ */

.era-dial {
  position: fixed;
  bottom: 1.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
}

.era-dial__bar {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 4px;
  border-radius: 16px;
  background: rgba(13, 14, 34, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(155, 155, 180, 0.08);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.3),
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(79, 70, 229, 0.06);
}

/* ═══════════════════════════════════════════════
   ERA SEGMENT
   ═══════════════════════════════════════════════ */

.era-segment {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 10px 16px 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-width: 64px;
}

.era-segment:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.03);
  border-color: color-mix(in srgb, var(--era-color) 25%, transparent);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.3),
    0 0 20px color-mix(in srgb, var(--era-color) 15%, transparent);
}

.era-segment:active {
  transform: translateY(-1px) scale(0.97);
}

/* Glowing top edge — always visible, intensifies on hover/active */
.era-segment__glow {
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--era-color);
  opacity: 0.35;
  transition: all 0.25s ease;
}

.era-segment:hover .era-segment__glow {
  opacity: 0.8;
  left: 10%;
  right: 10%;
  box-shadow: 0 0 8px var(--era-color);
}

.era-segment--active .era-segment__glow {
  opacity: 1;
  left: 5%;
  right: 5%;
  height: 2px;
  box-shadow: 0 0 12px var(--era-color);
  animation: glowBreathe 2.5s ease-in-out infinite;
}

@keyframes glowBreathe {
  0%, 100% { opacity: 0.7; box-shadow: 0 0 8px var(--era-color); }
  50% { opacity: 1; box-shadow: 0 0 16px var(--era-color); }
}

/* Active segment background */
.era-segment--active {
  background: color-mix(in srgb, var(--era-color) 6%, transparent);
  border-color: color-mix(in srgb, var(--era-color) 15%, transparent);
}

/* Pulse ring animation on click */
.era-segment__pulse {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 2px solid var(--era-color);
  animation: pulseRing 0.6s ease-out forwards;
  pointer-events: none;
}

@keyframes pulseRing {
  0% {
    opacity: 0.8;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.4);
  }
}

/* Text elements */
.era-segment__decade {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9375rem;
  font-weight: 700;
  color: rgba(232, 232, 240, 0.9);
  letter-spacing: -0.01em;
  line-height: 1;
  transition: color 0.2s;
}

.era-segment:hover .era-segment__decade {
  color: #E8E8F0;
}

.era-segment--active .era-segment__decade {
  color: var(--era-color);
}

.era-segment__name {
  font-size: 0.5625rem;
  color: rgba(155, 155, 180, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
  line-height: 1;
  transition: color 0.2s;
}

.era-segment:hover .era-segment__name {
  color: rgba(155, 155, 180, 0.75);
}

.era-segment__count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.5625rem;
  color: rgba(155, 155, 180, 0.35);
  line-height: 1;
  margin-top: 1px;
}

/* ═══════════════════════════════════════════════
   DIVIDER
   ═══════════════════════════════════════════════ */

.era-dial__divider {
  width: 1px;
  align-self: stretch;
  margin: 8px 4px;
  background: rgba(155, 155, 180, 0.12);
}

/* ═══════════════════════════════════════════════
   WARP BUTTON
   ═══════════════════════════════════════════════ */

.warp-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 14px 8px;
  border-radius: 12px;
  border: 1px solid rgba(79, 70, 229, 0.2);
  background: rgba(79, 70, 229, 0.06);
  color: rgba(129, 140, 248, 0.8);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.warp-btn:hover {
  transform: translateY(-3px);
  border-color: rgba(79, 70, 229, 0.4);
  background: rgba(79, 70, 229, 0.12);
  color: #A5B4FC;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.3),
    0 0 24px rgba(79, 70, 229, 0.15);
}

.warp-btn:active {
  transform: translateY(-1px) scale(0.97);
}

.warp-btn__label {
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.warp-btn__pulse {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 2px solid #818CF8;
  animation: pulseRing 0.6s ease-out forwards;
  pointer-events: none;
}

/* ═══════════════════════════════════════════════
   MOBILE RESPONSIVE
   ═══════════════════════════════════════════════ */

@media (max-width: 640px) {
  .era-dial__bar {
    gap: 1px;
    padding: 3px;
  }

  .era-segment {
    padding: 8px 10px 6px;
    min-width: 48px;
  }

  .era-segment__decade {
    font-size: 0.8125rem;
  }

  .era-segment__name {
    display: none;
  }

  .warp-btn {
    padding: 8px 10px 6px;
  }
}

@media (max-width: 420px) {
  .era-dial {
    left: 12px;
    right: 12px;
    transform: none;
  }

  .era-dial__bar {
    width: 100%;
    justify-content: space-between;
  }

  .era-segment {
    flex: 1;
    min-width: 0;
    padding: 8px 6px 6px;
  }
}
</style>
