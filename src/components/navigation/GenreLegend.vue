<script setup lang="ts">
import { GENRE_COLOR_MAP, type TGenre } from '@/types';
import { useGalaxyStore } from '@/stores/galaxy';

const galaxyStore = useGalaxyStore();
const listGenreEntry = Object.entries(GENRE_COLOR_MAP) as [TGenre, string][];

const onGenreClick = (genre: TGenre) => {
  if (galaxyStore.highlightedGenre === genre) {
    galaxyStore.highlightedGenre = null;
  } else {
    galaxyStore.highlightedGenre = genre;
  }
};
</script>

<template>
  <div class="genre-legend">
    <div
      v-for="[genre, color] in listGenreEntry"
      :key="genre"
      class="genre-legend-item"
      :class="{
        'genre-legend-item--active': galaxyStore.highlightedGenre === genre,
        'genre-legend-item--dimmed': galaxyStore.highlightedGenre !== null && galaxyStore.highlightedGenre !== genre,
      }"
      :title="genre"
      tabindex="0"
      role="button"
      @click="onGenreClick(genre)"
      @keydown.enter="onGenreClick(genre)"
      @keydown.space.prevent="onGenreClick(genre)"
    >
      <span
        class="genre-legend-dot"
        :style="{ backgroundColor: color, boxShadow: `0 0 5px ${color}66` }"
      />
      <span class="genre-legend-label">{{ genre }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Genre legend — vertical, left side below era dial */
.genre-legend {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 7px;
  border-radius: 8px;
  background: rgba(13, 14, 34, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.genre-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: opacity 0.2s ease, border-color 0.2s ease;
}

.genre-legend-item:hover {
  border-color: rgba(155, 155, 180, 0.25);
}

.genre-legend-item--active {
  border-color: rgba(200, 200, 230, 0.5);
}

.genre-legend-item--active .genre-legend-dot {
  box-shadow: 0 0 8px currentColor !important;
}

.genre-legend-item--active .genre-legend-label {
  color: rgba(220, 220, 240, 0.9);
}

.genre-legend-item--dimmed {
  opacity: 0.4;
}

.genre-legend-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.genre-legend-dot {
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.genre-legend-label {
  font-size: 0.5625rem;
  color: rgba(155, 155, 180, 0.45);
  text-transform: capitalize;
}
</style>
