<script setup lang="ts">
import { computed } from 'vue';
import { useGalaxyStore, LIST_ERA } from '@/stores/galaxy';

const galaxyStore = useGalaxyStore();
const currentEra = computed(() => galaxyStore.focusedEra);
const isBannerVisible = computed(() => galaxyStore.lodTier !== 'far' && currentEra.value !== null);

function eraClick(decade: number): void {
  galaxyStore.flyToEra(decade);
}

function isActive(decade: number): boolean {
  return currentEra.value?.decade === decade;
}
</script>

<template>
  <!-- Era buttons — always visible on the left sidebar -->
  <div class="era-sidebar">
    <button
      v-for="era in LIST_ERA"
      :key="era.decade"
      class="era-button"
      :class="{ 'era-button--active': isActive(era.decade) }"
      :title="era.name"
      @click="eraClick(era.decade)"
    >
      <span class="era-button-decade">{{ era.decade }}s</span>
      <span class="era-button-name">{{ era.name }}</span>
    </button>
  </div>

  <!-- Era banner — shows when focused on an era at mid/close zoom -->
  <Transition name="era-fade">
    <div v-if="isBannerVisible" class="era-indicator">
      <span class="era-decade">{{ currentEra?.decade }}s</span>
      <span class="era-name">{{ currentEra?.name }}</span>
    </div>
  </Transition>
</template>

<style scoped>
/* Sidebar — fixed left, vertically centered */
.era-sidebar {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  transform: translateY(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.era-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  padding: 0.5rem 0.75rem;
  background: rgba(20, 21, 41, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(79, 70, 229, 0.12);
  border-radius: 0.5rem;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.15s ease;
  user-select: none;
  min-width: 7rem;
}

.era-button:hover {
  background: rgba(20, 21, 41, 0.75);
  border-color: rgba(79, 70, 229, 0.35);
  transform: translateX(2px);
}

.era-button--active {
  background: rgba(79, 70, 229, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
}

.era-button--active:hover {
  background: rgba(79, 70, 229, 0.2);
  border-color: rgba(245, 158, 11, 0.5);
}

.era-button-decade {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1;
  color: #E8E8F0;
  letter-spacing: 0.02em;
}

.era-button--active .era-button-decade {
  color: #F59E0B;
}

.era-button-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.625rem;
  font-weight: 400;
  color: #9B9BB4;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 8rem;
}

/* Banner — top center */
.era-indicator {
  position: absolute;
  top: 3.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.75rem;
  background: rgba(20, 21, 41, 0.65);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 0.75rem;
  border: 1px solid rgba(79, 70, 229, 0.2);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.15),
    0 4px 20px rgba(0, 0, 0, 0.3);
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
