<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useDailyChallenge } from '@/composables/useDailyChallenge';
import { Trophy, Star } from 'lucide-vue-next';

const { progress, isComplete, description, state } = useDailyChallenge();

const goal = computed(() => state.value.goal);
const progressPercent = computed(() => Math.min(100, (progress.value / goal.value) * 100));

// Auto-hide after completion celebration
const isHiddenAfterComplete = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

watch(isComplete, (complete) => {
  if (complete) {
    hideTimer = setTimeout(() => {
      isHiddenAfterComplete.value = true;
    }, 3000);
  }
});

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
});
</script>

<template>
  <Transition name="challenge-fade">
    <div
      v-if="!isHiddenAfterComplete"
      class="daily-challenge"
      :class="{ 'daily-challenge--complete': isComplete }"
    >
      <div class="daily-challenge__header">
        <Trophy v-if="isComplete" :size="12" class="daily-challenge__icon daily-challenge__icon--trophy" />
        <Star v-else :size="12" class="daily-challenge__icon" />
        <span class="daily-challenge__title">{{ isComplete ? 'Challenge Complete!' : 'Daily Challenge' }}</span>
      </div>

      <p class="daily-challenge__description">{{ description }}</p>

      <div class="daily-challenge__bar-track">
        <div
          class="daily-challenge__bar-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="daily-challenge__count">
        {{ progress }} / {{ goal }}
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.daily-challenge {
  position: fixed;
  top: 3.5rem;
  right: 0.75rem;
  z-index: 20;
  width: 180px;
  padding: 0.5rem 0.625rem;
  border-radius: 8px;
  border: 1px solid rgba(155, 155, 180, 0.08);
  background: rgba(13, 14, 34, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-family: 'Space Grotesk', sans-serif;
  user-select: none;
  transition: border-color 0.2s ease;
}

.daily-challenge:hover {
  border-color: rgba(155, 155, 180, 0.2);
}

.daily-challenge--complete {
  border-color: rgba(255, 215, 0, 0.3);
}

.daily-challenge__header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.25rem;
}

.daily-challenge__icon {
  color: rgba(155, 155, 180, 0.5);
  flex-shrink: 0;
}

.daily-challenge__icon--trophy {
  color: rgba(255, 215, 0, 0.85);
}

.daily-challenge__title {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(155, 155, 180, 0.55);
}

.daily-challenge--complete .daily-challenge__title {
  color: rgba(255, 215, 0, 0.85);
}

.daily-challenge__description {
  font-size: 0.6875rem;
  color: rgba(232, 232, 240, 0.75);
  margin: 0 0 0.375rem;
  line-height: 1.3;
}

.daily-challenge__bar-track {
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: rgba(155, 155, 180, 0.12);
  overflow: hidden;
}

.daily-challenge__bar-fill {
  height: 100%;
  border-radius: 2px;
  background: rgba(79, 70, 229, 0.8);
  transition: width 0.4s ease;
}

.daily-challenge--complete .daily-challenge__bar-fill {
  background: rgba(255, 215, 0, 0.8);
}

.daily-challenge__count {
  font-size: 0.625rem;
  color: rgba(155, 155, 180, 0.45);
  text-align: right;
  margin-top: 0.2rem;
}

/* Transition */
.challenge-fade-enter-active,
.challenge-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.challenge-fade-enter-from,
.challenge-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
