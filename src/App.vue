<script setup lang="ts">
// Yozora.fm — root application shell
// Global init runs once here, not per-view
//
// Data loading strategy (3-tier):
// 1. galaxy-data.json (CDN, ~150KB) → galaxy renders immediately
// 2. Songs slim fetch (Supabase, ~1.5MB) → search + tooltips (parallel, non-blocking)
// 3. Song detail (Supabase, single row) → on click (lazy)
import { onMounted } from 'vue';
import { useSongsStore } from '@/stores/songs';
import { useGalaxyDataStore } from '@/stores/galaxy-data';
import { usePlayer } from '@/composables/usePlayer';
import { usePageTitle } from '@/composables/usePageTitle';

const songsStore = useSongsStore();
const galaxyDataStore = useGalaxyDataStore();

usePlayer();
usePageTitle();

onMounted(async () => {
  // Tier 1: load galaxy rendering data from CDN (fast, no DB query)
  await galaxyDataStore.fetchGalaxyData();

  // Tier 2: load songs for search + tooltips
  songsStore.fetchSongs();
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <keep-alive include="GalaxyView">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
