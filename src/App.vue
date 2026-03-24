<script setup lang="ts">
// Yozora.fm — root application shell
// Global init runs once here, not per-view
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';
import { usePlayer } from '@/composables/usePlayer';
import { usePageTitle } from '@/composables/usePageTitle';

const authStore = useAuthStore();
const songsStore = useSongsStore();

usePlayer();
usePageTitle();

onMounted(async () => {
  await Promise.all([
    songsStore.fetchSongs(),
    authStore.initAuth(),
  ]);
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <keep-alive include="GalaxyView">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
