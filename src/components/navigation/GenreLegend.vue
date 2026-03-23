<script setup lang="ts">
import { GENRE_COLOR_MAP, type TGenre } from '@/types';

const listGenreEntry = Object.entries(GENRE_COLOR_MAP) as [TGenre, string][];
</script>

<template>
  <div class="genre-legend">
    <span class="genre-legend-title">Genres</span>
    <div
      v-for="[genre, color] in listGenreEntry"
      :key="genre"
      class="genre-legend-item"
    >
      <span
        class="genre-legend-dot"
        :style="{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }"
      />
      <span class="genre-legend-label">{{ genre }}</span>
    </div>
  </div>
</template>

<style scoped>
.genre-legend {
  position: fixed;
  bottom: 1.25rem;
  left: 1.25rem;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  border-radius: 0.625rem;
  border: 1px solid rgba(79, 70, 229, 0.25);
  background: rgba(20, 21, 41, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(79, 70, 229, 0.06);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.genre-legend:hover {
  border-color: rgba(79, 70, 229, 0.45);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(79, 70, 229, 0.12);
}

.genre-legend-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.625rem;
  font-weight: 500;
  color: #9b9bb4;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.125rem;
}

.genre-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.genre-legend-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.genre-legend-label {
  font-size: 0.75rem;
  color: rgba(232, 232, 240, 0.75);
  text-transform: capitalize;
  letter-spacing: 0.02em;
}
</style>
