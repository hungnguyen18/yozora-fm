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
.genre-legend {
  position: fixed;
  bottom: 5rem;
  left: 0.75rem;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(13, 14, 34, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(155, 155, 180, 0.06);
}

.genre-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.genre-legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.genre-legend-label {
  font-size: 0.625rem;
  color: rgba(155, 155, 180, 0.6);
  text-transform: capitalize;
  letter-spacing: 0.02em;
}
</style>
