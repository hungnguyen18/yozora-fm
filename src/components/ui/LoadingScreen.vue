<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { useGalaxyDataStore } from '@/stores/galaxy-data';

const props = defineProps<{ isLoading: boolean }>();

const galaxyDataStore = useGalaxyDataStore();

const isVisible = ref(true);
const isExiting = ref(false);
let hasBeenLoading = false;

// Animated star counter that increments toward the real count
const displayCount = ref(0);
let countInterval: ReturnType<typeof setInterval> | null = null;

const starCountText = computed(() => {
  if (displayCount.value === 0) { return 'Discovering stars...'; }
  return `Loading ${displayCount.value.toLocaleString()} stars...`;
});

// Animate the counter toward the actual song count
watch(
  () => galaxyDataStore.listStar.length,
  (target) => {
    if (target === 0) { return; }
    if (countInterval) { clearInterval(countInterval); }

    const step = Math.max(1, Math.floor(target / 60));
    countInterval = setInterval(() => {
      displayCount.value = Math.min(displayCount.value + step, target);
      if (displayCount.value >= target) {
        displayCount.value = target;
        if (countInterval) { clearInterval(countInterval); }
      }
    }, 16);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (countInterval) { clearInterval(countInterval); }
});

// Progress bar: show real progress (0-100) based on songs loaded vs expected total
const progressPercent = computed(() => {
  const count = galaxyDataStore.listStar.length;
  if (count === 0) { return 0; }
  // Estimate ~9000 songs total; cap at 100
  const estimated = 9000;
  return Math.min(100, Math.round((count / estimated) * 100));
});

// Minimum time the loading screen stays visible (ms).
// Even on fast CDN loads, users should see the branded intro.
const MIN_DISPLAY_MS = 1500;
const mountTime = Date.now();

const beginExit = () => {
  if (isExiting.value) { return; }

  // Ensure minimum display time
  const elapsed = Date.now() - mountTime;
  if (elapsed < MIN_DISPLAY_MS) {
    setTimeout(beginExit, MIN_DISPLAY_MS - elapsed);
    return;
  }

  isExiting.value = true;
  setTimeout(() => {
    isVisible.value = false;
  }, 900);
};

// Dismiss once galaxy data has loaded (stars available for rendering).
watch(
  () => galaxyDataStore.listStar.length,
  (count) => {
    if (count > 0) {
      beginExit();
    }
  },
  { immediate: true },
);

// Also watch the prop as a fallback
watch(
  () => props.isLoading,
  (loading) => {
    if (loading) { hasBeenLoading = true; }
    if (!loading && hasBeenLoading) { beginExit(); }
  },
  { immediate: true },
);
</script>

<template>
  <Transition name="loading-fade">
    <div
      v-if="isVisible"
      class="loading-screen"
      :class="{ 'loading-exit': isExiting }"
    >
      <!-- Animated spiral star icon -->
      <div class="star-icon-wrapper">
        <svg
          class="star-icon"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <!-- Spiral trails -->
          <circle cx="40" cy="40" r="30" stroke="rgba(79,70,229,0.15)" stroke-width="1" fill="none" />
          <circle cx="40" cy="40" r="22" stroke="rgba(79,70,229,0.2)" stroke-width="1" fill="none" />
          <circle cx="40" cy="40" r="14" stroke="rgba(245,158,11,0.2)" stroke-width="1" fill="none" />
          <!-- Star shape -->
          <path
            d="M40 8 L44.7 27.5 L64 29.5 L50.3 42.5 L54.7 62 L40 52 L25.3 62 L29.7 42.5 L16 29.5 L35.3 27.5 Z"
            fill="none"
            stroke="#4F46E5"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <!-- Inner glow dot -->
          <circle cx="40" cy="40" r="4" fill="#F59E0B" opacity="0.9" />
          <!-- Trailing sparkle dots -->
          <circle cx="40" cy="10" r="1.5" fill="#4F46E5" opacity="0.6" />
          <circle cx="68" cy="30" r="1" fill="#F59E0B" opacity="0.5" />
          <circle cx="60" cy="62" r="1.2" fill="#4F46E5" opacity="0.5" />
          <circle cx="20" cy="62" r="1" fill="#F59E0B" opacity="0.4" />
          <circle cx="12" cy="30" r="1.5" fill="#4F46E5" opacity="0.5" />
        </svg>
      </div>

      <!-- Logotype -->
      <h1 class="logotype">Yozora.fm</h1>

      <!-- Tagline -->
      <p class="tagline">
        Every song is a star. Tune in to the night sky of your memories.
      </p>

      <!-- Star count -->
      <p class="star-count">{{ starCountText }}</p>

      <!-- Progress bar -->
      <div class="progress-track">
        <div
          class="progress-fill"
          :class="{ 'progress-determinate': progressPercent > 0 }"
          :style="progressPercent > 0 ? { width: progressPercent + '%' } : {}"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 50;
  background-color: #0A0B1A;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  transition: opacity 0.8s ease-out, transform 0.8s ease-out;
}

.loading-screen.loading-exit {
  opacity: 0;
  transform: scale(1.02);
}

/* Star icon */
.star-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.star-icon {
  width: 5rem;
  height: 5rem;
  animation: starSpin 8s linear infinite, starPulse 3s ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(79, 70, 229, 0.6));
}

@keyframes starSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes starPulse {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px rgba(79, 70, 229, 0.6)); }
  50% { opacity: 0.75; filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.7)); }
}

/* Logotype */
.logotype {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.875rem;
  font-weight: 700;
  color: #E8E8F0;
  letter-spacing: 0.04em;
  text-shadow:
    0 0 20px rgba(245, 158, 11, 0.4),
    0 0 40px rgba(245, 158, 11, 0.2);
  margin: 0;
}

/* Tagline */
.tagline {
  font-size: 0.875rem;
  color: #9B9BB4;
  text-align: center;
  max-width: 22rem;
  line-height: 1.6;
  margin: 0;
  animation: fadeIn 0.6s ease-out 0.5s both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Star count */
.star-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(155, 155, 180, 0.7);
  letter-spacing: 0.06em;
  margin: 0;
  animation: fadeIn 0.6s ease-out 0.8s both;
}

/* Progress bar */
.progress-track {
  width: 12rem;
  height: 2px;
  background-color: #1a1b2e;
  border-radius: 9999px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.progress-fill {
  height: 100%;
  background-color: #4F46E5;
  border-radius: 9999px;
  animation: progressIndeterminate 1.8s ease-in-out infinite;
  transform-origin: left center;
}

.progress-fill.progress-determinate {
  animation: none;
  margin-left: 0;
  transition: width 0.3s ease-out;
}

@keyframes progressIndeterminate {
  0% { width: 0%; margin-left: 0%; }
  40% { width: 60%; margin-left: 20%; }
  80% { width: 20%; margin-left: 80%; }
  100% { width: 0%; margin-left: 100%; }
}
</style>
