<script setup lang="ts">
import { GENRE_COLOR_MAP, type TGenre } from '@/types';

const listGenreEntry = Object.entries(GENRE_COLOR_MAP) as [TGenre, string][];
</script>

<template>
  <div class="genre-legend">
    <div
      v-for="[genre, color] in listGenreEntry"
      :key="genre"
      class="genre-legend-item"
      :title="genre"
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
  position: fixed;
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
