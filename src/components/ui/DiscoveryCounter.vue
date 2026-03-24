<script setup lang="ts">
import { useDiscovery } from '@/composables/useDiscovery';
import { useExplorerPassport } from '@/composables/useExplorerPassport';

const { discoveredCount, totalCount } = useDiscovery();
const { completionPercent } = useExplorerPassport();
</script>

<template>
  <div v-if="totalCount > 0" class="discovery-counter">
    <span class="discovery-count">{{ discoveredCount.toLocaleString() }}</span>
    <span class="discovery-separator"> / </span>
    <span class="discovery-total">{{ totalCount.toLocaleString() }}</span>
    <span class="discovery-label"> discovered</span>
    <span class="discovery-explored"> · {{ completionPercent }}% explored</span>
  </div>
</template>

<style scoped>
.discovery-counter {
  position: absolute;
  bottom: 8.5rem;
  right: 0.75rem;
  z-index: 20;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  border: 1px solid rgba(155, 155, 180, 0.08);
  background: rgba(13, 14, 34, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-size: 0.6875rem;
  font-family: 'Space Grotesk', sans-serif;
  color: rgba(155, 155, 180, 0.6);
  white-space: nowrap;
  user-select: none;
  transition: border-color 0.2s ease;
}

.discovery-counter:hover {
  border-color: rgba(155, 155, 180, 0.2);
}

.discovery-count {
  color: rgba(255, 215, 0, 0.85);
  font-weight: 600;
}

.discovery-separator,
.discovery-total {
  color: rgba(155, 155, 180, 0.45);
}

.discovery-label {
  color: rgba(155, 155, 180, 0.5);
}

.discovery-explored {
  color: rgba(79, 70, 229, 0.7);
  font-weight: 500;
}
</style>
