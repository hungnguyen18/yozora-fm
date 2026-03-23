<script setup lang="ts">
// Yozora.fm — root application shell
import GalaxyScene from '@/components/galaxy/GalaxyScene.vue';
import DetailPanel from '@/components/player/DetailPanel.vue';
import EraIndicator from '@/components/navigation/EraIndicator.vue';
import Minimap from '@/components/navigation/Minimap.vue';
</script>

<template>
  <div class="w-screen h-screen overflow-hidden bg-[#0A0B1A] relative">
    <GalaxyScene />
    <DetailPanel />
    <EraIndicator />
    <Minimap />
  </div>
</template>
