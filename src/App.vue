<script setup lang="ts">
// Yozora.fm — root application shell
import { onMounted } from 'vue';
import GalaxyScene from '@/components/galaxy/GalaxyScene.vue';
import DetailPanel from '@/components/player/DetailPanel.vue';
import PipPlayer from '@/components/player/PipPlayer.vue';
import EraIndicator from '@/components/navigation/EraIndicator.vue';
import EraSummary from '@/components/navigation/EraSummary.vue';
import Minimap from '@/components/navigation/Minimap.vue';
import AuthButton from '@/components/ui/AuthButton.vue';
import UserMenu from '@/components/ui/UserMenu.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

onMounted(() => {
  authStore.initAuth();
});
</script>

<template>
  <div class="w-screen h-screen overflow-hidden bg-[#0A0B1A] relative">
    <GalaxyScene />
    <DetailPanel />
    <PipPlayer />
    <EraIndicator />
    <EraSummary />
    <Minimap />
    <AuthButton v-if="!authStore.isAuthenticated" />
    <UserMenu v-else />
  </div>
</template>
