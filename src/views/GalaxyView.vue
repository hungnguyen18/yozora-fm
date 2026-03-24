<script lang="ts">
export default { name: 'GalaxyView' };
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import GalaxyScene from '@/components/galaxy/GalaxyScene.vue';
import DetailPanel from '@/components/player/DetailPanel.vue';
import PipPlayer from '@/components/player/PipPlayer.vue';
import GenreLegend from '@/components/navigation/GenreLegend.vue';
import Minimap from '@/components/navigation/Minimap.vue';
import RandomPlayButton from '@/components/navigation/RandomPlayButton.vue';
import SearchBar from '@/components/navigation/SearchBar.vue';
import AuthButton from '@/components/ui/AuthButton.vue';
import UserMenu from '@/components/ui/UserMenu.vue';
import LoadingScreen from '@/components/ui/LoadingScreen.vue';
import DiscoveryCounter from '@/components/ui/DiscoveryCounter.vue';
import { Eye, EyeOff } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGalaxyDataStore } from '@/stores/galaxy-data';
import { useKeyboardNav } from '@/composables/useKeyboardNav';
import { useRouting } from '@/composables/useRouting';
import { useDiscovery } from '@/composables/useDiscovery';
import { useExplorerPassport } from '@/composables/useExplorerPassport';

const authStore = useAuthStore();
const galaxyDataStore = useGalaxyDataStore();

useKeyboardNav();
useRouting();
useDiscovery();
useExplorerPassport();

const isLoading = computed(() => galaxyDataStore.isLoading);

// ── UI Visibility: auto-hide after idle, toggle with H key ──
const isUIVisible = ref(true);
const isUILocked = ref(false);
const IDLE_TIMEOUT_MS = 4000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const showUI = (): void => {
  if (isUILocked.value) { return; }
  isUIVisible.value = true;
  if (idleTimer) { clearTimeout(idleTimer); }
  idleTimer = setTimeout(() => {
    if (!isUILocked.value) {
      isUIVisible.value = false;
    }
  }, IDLE_TIMEOUT_MS);
};

const toggleUI = (): void => {
  isUILocked.value = !isUILocked.value;
  isUIVisible.value = isUILocked.value;
  if (idleTimer) { clearTimeout(idleTimer); }
};

const onKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'h' || e.key === 'H') {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
    toggleUI();
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  showUI();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (idleTimer) { clearTimeout(idleTimer); }
});

// Format song count with locale separators (e.g. "9,111")
const songCountLabel = computed(() => {
  const count = galaxyDataStore.listStar.length;
  return count > 0 ? `${count.toLocaleString()} stars to explore` : 'Stars to explore';
});

// Onboarding tooltip: show once per browser session
const ONBOARDING_KEY = 'yozora_hasSeenOnboarding';
const hasSeenOnboarding = ref(localStorage.getItem(ONBOARDING_KEY) === 'true');
const isOnboardingVisible = ref(!hasSeenOnboarding.value);
let onboardingTimer: ReturnType<typeof setTimeout> | null = null;

const dismissOnboarding = () => {
  if (!isOnboardingVisible.value) { return; }
  isOnboardingVisible.value = false;
  localStorage.setItem(ONBOARDING_KEY, 'true');
  if (onboardingTimer !== null) {
    clearTimeout(onboardingTimer);
    onboardingTimer = null;
  }
};

onMounted(() => {
  if (isOnboardingVisible.value) {
    onboardingTimer = setTimeout(dismissOnboarding, 5000);
  }
});
</script>

<template>
  <div
    class="w-screen h-screen overflow-hidden bg-[#0A0B1A] relative"
    @mousemove="showUI"
  >
    <LoadingScreen :is-loading="isLoading" />

    <GalaxyScene @pointerdown="dismissOnboarding" @wheel="dismissOnboarding" />
    <DetailPanel />
    <PipPlayer />

    <!-- Search: outside overlay-ui, trigger fades with UI -->
    <SearchBar :is-visible="isUIVisible" />

    <!-- Overlay UI — hidden during loading, fades on idle, toggle with H key -->
    <div class="overlay-ui" :class="{ 'overlay-ui--hidden': !isUIVisible || isLoading }">
      <Minimap />
      <GenreLegend />
      <RandomPlayButton />
      <DiscoveryCounter />
      <AuthButton v-if="!authStore.isAuthenticated" />
      <UserMenu v-else />
    </div>

    <!-- UI toggle button — always visible -->
    <button
      class="ui-toggle"
      :title="isUILocked ? 'Show UI (H)' : 'Hide UI (H)'"
      @click="toggleUI"
    >
      <EyeOff v-if="!isUIVisible" :size="14" />
      <Eye v-else :size="14" />
    </button>

    <!-- Onboarding tooltip -->
    <Transition name="onboarding-fade">
      <div
        v-if="isOnboardingVisible && !isLoading"
        class="onboarding-tooltip"
        @click="dismissOnboarding"
      >
        {{ songCountLabel }} &bull; Scroll to zoom &bull; Drag to pan &bull; Click a star &bull; Press H to hide UI
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.overlay-ui {
  transition: opacity 0.4s ease;
}

.overlay-ui--hidden {
  opacity: 0;
  pointer-events: none;
}

.ui-toggle {
  position: fixed;
  bottom: 0.5rem;
  left: 0.5rem;
  z-index: 45;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(155, 155, 180, 0.1);
  background: rgba(13, 14, 34, 0.6);
  color: rgba(155, 155, 180, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ui-toggle:hover {
  color: rgba(232, 232, 240, 0.8);
  border-color: rgba(155, 155, 180, 0.25);
  background: rgba(13, 14, 34, 0.85);
}

.ui-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.onboarding-tooltip {
  position: fixed;
  bottom: 6.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  background-color: rgba(10, 11, 26, 0.9);
  color: rgba(232, 232, 240, 0.8);
  font-size: 0.875rem;
  padding: 0.5rem 1.5rem;
  border-radius: 9999px;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  user-select: none;
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
