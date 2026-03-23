<script setup lang="ts">
// Yozora.fm — root application shell
import { ref, computed, onMounted } from 'vue';
import GalaxyScene from '@/components/galaxy/GalaxyScene.vue';
import DetailPanel from '@/components/player/DetailPanel.vue';
import PipPlayer from '@/components/player/PipPlayer.vue';
import EraIndicator from '@/components/navigation/EraIndicator.vue';
import EraSummary from '@/components/navigation/EraSummary.vue';
import Minimap from '@/components/navigation/Minimap.vue';
import AuthButton from '@/components/ui/AuthButton.vue';
import UserMenu from '@/components/ui/UserMenu.vue';
import LoadingScreen from '@/components/ui/LoadingScreen.vue';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';

const authStore = useAuthStore();
const songsStore = useSongsStore();

const isLoading = computed(() => songsStore.isLoading);

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

onMounted(async () => {
  await Promise.all([
    songsStore.fetchSongs(),
    authStore.initAuth(),
  ]);

  // Auto-dismiss onboarding after 5 seconds once loading completes
  if (isOnboardingVisible.value) {
    onboardingTimer = setTimeout(dismissOnboarding, 5000);
  }
});
</script>

<template>
  <div class="w-screen h-screen overflow-hidden bg-[#0A0B1A] relative">
    <LoadingScreen :is-loading="isLoading" />

    <GalaxyScene @pointerdown="dismissOnboarding" @wheel="dismissOnboarding" />
    <DetailPanel />
    <PipPlayer />
    <EraIndicator />
    <EraSummary />
    <Minimap />
    <AuthButton v-if="!authStore.isAuthenticated" />
    <UserMenu v-else />

    <!-- Onboarding tooltip: first-visit hint, auto-dismisses after 5s -->
    <Transition name="onboarding-fade">
      <div
        v-if="isOnboardingVisible && !isLoading"
        class="onboarding-tooltip"
        @click="dismissOnboarding"
      >
        Scroll to zoom &bull; Drag to pan &bull; Click a star to listen
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.onboarding-tooltip {
  position: fixed;
  bottom: 5.5rem;
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
  transform: translateX(-50%) translateY(8px);
}
</style>
