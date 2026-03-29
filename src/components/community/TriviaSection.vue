<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { Lightbulb, AlertCircle } from 'lucide-vue-next';
import { useTrivia } from '@/composables/useTrivia';

type TTriviaSectionProps = {
  songId: number;
};

const props = defineProps<TTriviaSectionProps>();

const songIdRef = toRef(props, 'songId');
const { listTrivia, isLoading, isSubmitting, error, submitTrivia, upvoteTrivia, reportTrivia } =
  useTrivia(songIdRef);

const MAX_CONTENT_LENGTH = 500;
const newTriviaContent = ref('');
const charCount = computed(() => newTriviaContent.value.length);
const isOverLimit = computed(() => charCount.value > MAX_CONTENT_LENGTH);
const hoveredTriviaId = ref<number | null>(null);

const handleSubmit = async () => {
  if (isOverLimit.value || isSubmitting.value) {
    return;
  }
  await submitTrivia(newTriviaContent.value);
  if (!error.value) {
    newTriviaContent.value = '';
  }
};
</script>

<template>
  <div class="trivia-section">
    <!-- Header -->
    <div class="trivia-header">
      <Lightbulb :size="16" class="trivia-header__icon" aria-hidden="true" />
      <h3 class="trivia-header__title">Did you know?</h3>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="trivia-loading">
      Loading trivia…
    </div>

    <!-- Trivia list -->
    <ul v-else-if="listTrivia.length > 0" class="trivia-list">
      <li
        v-for="item in listTrivia"
        :key="item.id"
        class="trivia-item"
        @mouseenter="hoveredTriviaId = item.id"
        @mouseleave="hoveredTriviaId = null"
      >
        <p class="trivia-item__content">{{ item.content }}</p>
        <div class="trivia-item__meta">
          <div class="trivia-item__actions">
            <!-- Report button — subtle, appears on hover -->
            <button
              v-if="hoveredTriviaId === item.id"
              class="trivia-item__report-btn"
              aria-label="Report trivia"
              @click="reportTrivia(item.id)"
            >
              ⚑ Report
            </button>
            <!-- Upvote button -->
            <button
              class="trivia-item__upvote-btn"
              aria-label="`Upvote trivia (${item.upvote_count})`"
              @click="upvoteTrivia(item.id)"
            >
              <span class="trivia-item__upvote-icon">▲</span>
              <span class="trivia-item__upvote-count">{{ item.upvote_count }}</span>
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Empty state -->
    <p v-else class="trivia-empty">
      No trivia yet. Be the first to share something interesting!
    </p>

    <!-- Error message — subtle inline notice -->
    <div v-if="error" class="trivia-error">
      <AlertCircle :size="14" class="trivia-error__icon" />
      <span class="trivia-error__text">{{ error }}</span>
    </div>

    <!-- Add trivia form -->
    <div class="trivia-form">
      <textarea
        v-model="newTriviaContent"
        class="trivia-form__textarea"
        :class="{ 'trivia-form__textarea--over-limit': isOverLimit }"
        placeholder="Share a fun fact about this song…"
        :maxlength="MAX_CONTENT_LENGTH + 50"
        rows="3"
      />
      <div class="trivia-form__footer">
        <span
          class="trivia-form__char-count"
          :class="{ 'trivia-form__char-count--over': isOverLimit }"
        >
          {{ charCount }} / {{ MAX_CONTENT_LENGTH }}
        </span>
        <button
          class="trivia-form__submit-btn"
          :disabled="isOverLimit || isSubmitting || charCount === 0"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Submitting…' : 'Submit' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Section wrapper */
.trivia-section {
  background-color: rgba(20, 21, 41, 0.5); /* bg-midnight/50 */
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header */
.trivia-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trivia-header__icon {
  color: #F59E0B;
  flex-shrink: 0;
}

.trivia-header__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #E8E8F0; /* text-soft-white */
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Loading */
.trivia-loading {
  font-size: 0.8125rem;
  color: #9B9BB4; /* muted-lavender */
  text-align: center;
  padding: 8px 0;
}

/* Trivia list */
.trivia-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Trivia item */
.trivia-item {
  background-color: rgba(155, 155, 180, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: background-color 0.15s ease;
}

.trivia-item:hover {
  background-color: rgba(155, 155, 180, 0.1);
}

.trivia-item__content {
  margin: 0;
  font-size: 0.875rem;
  color: #E8E8F0; /* text-soft-white */
  line-height: 1.5;
}

.trivia-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.trivia-item__author {
  font-size: 0.75rem;
  color: #9B9BB4; /* muted-lavender */
}

.trivia-item__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Report button — subtle */
.trivia-item__report-btn {
  background: transparent;
  border: none;
  padding: 2px 6px;
  font-size: 0.6875rem;
  color: #9B9BB4;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.2s;
  opacity: 0.7;
}

.trivia-item__report-btn:hover {
  color: #F97316;
  opacity: 1;
}

/* Upvote button */
.trivia-item__upvote-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid rgba(155, 155, 180, 0.2);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  color: #9B9BB4;
}

.trivia-item__upvote-btn:hover {
  border-color: #818CF8;
  color: #818CF8;
}

.trivia-item__upvote-icon {
  font-size: 0.625rem;
  line-height: 1;
}

.trivia-item__upvote-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: inherit;
}

/* Empty state */
.trivia-empty {
  margin: 0;
  font-size: 0.8125rem;
  color: #9B9BB4; /* muted-lavender */
  text-align: center;
  padding: 8px 0;
}

/* Error — subtle muted notice */
.trivia-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background-color: rgba(155, 155, 180, 0.06);
}

.trivia-error__icon {
  color: #9B9BB4;
  flex-shrink: 0;
}

.trivia-error__text {
  font-size: 0.75rem;
  color: #9B9BB4;
  line-height: 1.4;
}

/* Form */
.trivia-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trivia-form__textarea {
  width: 100%;
  box-sizing: border-box;
  background-color: rgba(155, 155, 180, 0.08);
  border: 1px solid rgba(155, 155, 180, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.875rem;
  color: #E8E8F0;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.trivia-form__textarea::placeholder {
  color: #9B9BB4;
  opacity: 0.6;
}

.trivia-form__textarea:focus {
  border-color: rgba(129, 140, 248, 0.5);
}

.trivia-form__textarea--over-limit {
  border-color: rgba(249, 115, 22, 0.6);
}

.trivia-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.trivia-form__char-count {
  font-size: 0.75rem;
  color: #9B9BB4;
  transition: color 0.2s;
}

.trivia-form__char-count--over {
  color: #F97316;
}

.trivia-form__submit-btn {
  background-color: #4F46E5;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #E8E8F0;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
}

.trivia-form__submit-btn:hover:not(:disabled) {
  background-color: #4338CA;
}

.trivia-form__submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
