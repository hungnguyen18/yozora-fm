<script setup lang="ts">
import { computed } from 'vue';
import { useGalaxyStore } from '@/stores/galaxy';
import { useSongsStore } from '@/stores/songs';
import { useLOD } from '@/composables/useLOD';

const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();
const { lodTier } = useLOD();

const isVisible = computed(() => lodTier.value === 'mid' && galaxyStore.focusedEra !== null);

// Compute stats for current era
const eraStats = computed(() => {
  if (!galaxyStore.focusedEra) { return null; }
  const era = galaxyStore.focusedEra;
  const eraSongs = songsStore.listSong.filter(s => (s.year ?? 0) >= era.startYear && (s.year ?? 0) <= era.endYear);

  const songCount = eraSongs.length;

  // Top artist (most songs in this era)
  const artistCounts = new Map<string, number>();
  for (let i = 0; i < eraSongs.length; i += 1) {
    const artistName = eraSongs[i].artist?.name ?? 'Unknown';
    artistCounts.set(artistName, (artistCounts.get(artistName) ?? 0) + 1);
  }
  let topArtist = 'Unknown';
  let topArtistCount = 0;
  artistCounts.forEach((count, artistName) => {
    if (count > topArtistCount) {
      topArtistCount = count;
      topArtist = artistName;
    }
  });

  // Most iconic (highest vote_count)
  let mostIconic = eraSongs[0] ?? null;
  for (let i = 1; i < eraSongs.length; i += 1) {
    if (eraSongs[i].vote_count > (mostIconic?.vote_count ?? 0)) {
      mostIconic = eraSongs[i];
    }
  }

  return { songCount, topArtist, topArtistCount, mostIconic };
});

function navigateToIconic(): void {
  if (!eraStats.value?.mostIconic) { return; }
  galaxyStore.flyToStar(eraStats.value.mostIconic.id);
}
</script>

<template>
  <Transition name="era-summary-fade">
    <div v-if="isVisible" class="era-summary">
      <!-- Songs count -->
      <div class="stat-item">
        <span class="stat-value stat-value--gold">{{ eraStats?.songCount ?? 0 }}</span>
        <span class="stat-label">songs</span>
      </div>

      <!-- Divider -->
      <div class="stat-divider" aria-hidden="true" />

      <!-- Top artist -->
      <div class="stat-item">
        <span class="stat-value">{{ eraStats?.topArtist ?? '—' }}</span>
        <span class="stat-label">{{ eraStats?.topArtistCount ?? 0 }} tracks · top artist</span>
      </div>

      <!-- Divider -->
      <div class="stat-divider" aria-hidden="true" />

      <!-- Most iconic -->
      <div class="stat-item">
        <button
          class="stat-value stat-value--clickable"
          :title="`Navigate to ${eraStats?.mostIconic?.title}`"
          @click="navigateToIconic"
        >
          {{ eraStats?.mostIconic?.title ?? '—' }}
        </button>
        <span class="stat-label">most iconic</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.era-summary {
  position: fixed;
  top: 7.5rem; /* ~120px — sits below the EraIndicator */
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  padding: 0.875rem 1.75rem;
  background: rgba(20, 21, 41, 0.80);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  user-select: none;
  white-space: nowrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0 1.25rem;
}

.stat-divider {
  width: 1px;
  height: 2.25rem;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.875rem; /* text-sm */
  font-weight: 500;
  color: #E8E8F0; /* soft-white */
  line-height: 1.3;
  background: none;
  border: none;
  padding: 0;
  cursor: default;
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value--gold {
  font-size: 1.5rem; /* text-2xl */
  font-weight: 600;
  color: #F59E0B; /* gold */
  line-height: 1;
}

.stat-value--clickable {
  cursor: pointer;
  color: #E8E8F0;
  transition: color 0.2s ease;
}

.stat-value--clickable:hover {
  color: #F59E0B; /* gold on hover */
}

.stat-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.6875rem; /* ~text-xs */
  font-weight: 400;
  color: #9B9BB4; /* muted-lavender */
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Fade + slide-down transition */
.era-summary-fade-enter-active,
.era-summary-fade-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.era-summary-fade-enter-from,
.era-summary-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.era-summary-fade-enter-to,
.era-summary-fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
