<script setup lang="ts">
import { computed } from 'vue';
import { useGalaxyStore } from '@/stores/galaxy';

const galaxyStore = useGalaxyStore();
const currentEra = computed(() => galaxyStore.focusedEra);
const isVisible = computed(() => galaxyStore.lodTier !== 'far' && currentEra.value !== null);
</script>

<template>
  <Transition name="era-fade">
    <div v-if="isVisible" class="era-indicator">
      <span class="era-decade">{{ currentEra?.decade }}s</span>
      <span class="era-name">{{ currentEra?.name }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.era-indicator {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.5rem;
  background: rgba(20, 21, 41, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 0.75rem;
  border: 1px solid rgba(79, 70, 229, 0.2);
  pointer-events: none;
  user-select: none;
}

.era-decade {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.875rem; /* text-3xl */
  font-weight: 600;
  line-height: 1;
  color: #F59E0B;
  letter-spacing: 0.02em;
}

.era-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.125rem; /* text-lg */
  font-weight: 400;
  color: #9B9BB4;
  letter-spacing: 0.04em;
}

/* Fade + slide-down transition */
.era-fade-enter-active,
.era-fade-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.era-fade-enter-from,
.era-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.era-fade-enter-to,
.era-fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
