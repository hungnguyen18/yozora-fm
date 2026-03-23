<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Shuffle } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';

interface IDecadeOption {
  label: string;
  decade: number | null;
}

const LIST_DECADE_OPTION: IDecadeOption[] = [
  { label: 'Random from any era', decade: null },
  { label: '80s Golden Age', decade: 1980 },
  { label: '90s Renaissance', decade: 1990 },
  { label: '00s Digital Wave', decade: 2000 },
  { label: '10s Streaming Era', decade: 2010 },
  { label: '20s Modern', decade: 2020 },
];

const playerStore = usePlayerStore();
const isOpen = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectOption = (option: IDecadeOption) => {
  isOpen.value = false;
  playerStore.playRandom(option.decade ?? undefined);
};

const handleClickOutside = (event: MouseEvent) => {
  if (!isOpen.value) { return; }
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('pointerdown', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleClickOutside);
});
</script>

<template>
  <div ref="wrapperRef" class="random-play-wrapper">
    <Transition name="random-dropdown">
      <div v-if="isOpen" class="random-dropdown">
        <span class="random-dropdown-title">Discover by era</span>
        <button
          v-for="option in LIST_DECADE_OPTION"
          :key="option.label"
          class="random-dropdown-item"
          @click="selectOption(option)"
        >
          {{ option.label }}
        </button>
      </div>
    </Transition>

    <button
      class="random-play-btn"
      title="Random Play"
      @click="toggleDropdown"
    >
      <Shuffle :size="18" />
    </button>
  </div>
</template>

<style scoped>
.random-play-wrapper {
  position: fixed;
  bottom: 5.5rem;
  left: calc(50% - 10rem);
  z-index: 40;
}

.random-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(79, 70, 229, 0.3);
  background: rgba(20, 21, 41, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: rgba(232, 232, 240, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 24px rgba(79, 70, 229, 0.08);
}

.random-play-btn:hover {
  border-color: rgba(79, 70, 229, 0.6);
  color: #e8e8f0;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 32px rgba(79, 70, 229, 0.2);
  transform: scale(1.05);
}

.random-play-btn:active {
  transform: scale(0.95);
}

.random-dropdown {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(79, 70, 229, 0.25);
  background: rgba(20, 21, 41, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 48px rgba(79, 70, 229, 0.08);
  min-width: 12rem;
}

.random-dropdown-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.625rem;
  font-weight: 500;
  color: #9b9bb4;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.5rem;
  margin-bottom: 0.125rem;
}

.random-dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: rgba(232, 232, 240, 0.8);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.random-dropdown-item:hover {
  background: rgba(79, 70, 229, 0.15);
  color: #e8e8f0;
}

.random-dropdown-item:active {
  background: rgba(79, 70, 229, 0.25);
}

/* Dropdown transition */
.random-dropdown-enter-active,
.random-dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.random-dropdown-enter-from,
.random-dropdown-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
</style>
