<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useVote } from '@/composables/useVote';
import { useAuthStore } from '@/stores/auth';

type TVoteButtonProps = {
  songId: number;
};

const props = defineProps<TVoteButtonProps>();

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const songIdRef = toRef(props, 'songId');
const { hasVoted, voteCount, isLoading, toggleVote } = useVote(songIdRef);

const handleClick = () => {
  if (!isAuthenticated.value) {
    return;
  }
  toggleVote();
};
</script>

<template>
  <div class="vote-button-wrapper">
    <button
      class="vote-btn"
      :class="{ 'vote-btn--voted': hasVoted, 'vote-btn--loading': isLoading }"
      :disabled="!isAuthenticated || isLoading"
      :title="isAuthenticated ? (hasVoted ? 'Remove vote' : 'Vote for this song') : 'Sign in to vote'"
      :aria-label="isAuthenticated ? (hasVoted ? 'Remove vote' : 'Vote for this song') : 'Sign in to vote'"
      @click="handleClick"
    >
      <span class="vote-btn__icon" :class="{ 'vote-btn__icon--glow': hasVoted }">
        {{ hasVoted ? '⭐' : '☆' }}
      </span>
      <span class="vote-btn__count">{{ voteCount }}</span>
    </button>

    <span
      v-if="!isAuthenticated"
      class="vote-tooltip"
      aria-hidden="true"
    >
      Sign in to vote
    </span>
  </div>
</template>

<style scoped>
.vote-button-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.vote-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgba(155, 155, 180, 0.25);
  border-radius: 9999px;
  padding: 5px 14px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #9B9BB4;
  transition: border-color 0.2s, color 0.2s, background-color 0.2s;
  user-select: none;
}

.vote-btn:hover:not(:disabled) {
  border-color: rgba(245, 158, 11, 0.5);
  color: #F59E0B;
}

.vote-btn--voted {
  border-color: rgba(245, 158, 11, 0.6);
  color: #F59E0B;
  background-color: rgba(245, 158, 11, 0.08);
}

.vote-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.vote-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.vote-btn--loading {
  opacity: 0.7;
}

/* Star icon */
.vote-btn__icon {
  font-size: 1rem;
  line-height: 1;
  display: inline-block;
  transition: transform 0.15s;
}

.vote-btn__icon--glow {
  animation: star-glow 0.4s ease-out forwards;
}

.vote-btn__count {
  font-weight: 600;
  min-width: 1ch;
}

/* Gold glow animation on vote */
@keyframes star-glow {
  0% {
    transform: scale(1);
    filter: drop-shadow(0 0 0px #F59E0B);
  }
  40% {
    transform: scale(1.4);
    filter: drop-shadow(0 0 8px #F59E0B);
  }
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 4px #F59E0B);
  }
}

/* Tooltip */
.vote-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1E1E30;
  border: 1px solid rgba(155, 155, 180, 0.2);
  color: #9B9BB4;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

.vote-button-wrapper:hover .vote-tooltip {
  opacity: 1;
}
</style>
