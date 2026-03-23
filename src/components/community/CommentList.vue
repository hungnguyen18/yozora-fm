<script setup lang="ts">
import { ref, computed, toRef } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useComments } from '@/composables/useComments';

type TCommentListProps = {
  songId: number;
};

const props = defineProps<TCommentListProps>();

const authStore = useAuthStore();
const songIdRef = toRef(props, 'songId');

const { listComment, isLoading, hasMore, loadMore, addComment, deleteComment, reportComment } =
  useComments(songIdRef);

const newContent = ref('');
const isSubmitting = ref(false);

const charCount = computed(() => newContent.value.length);
const isOverLimit = computed(() => charCount.value > 280);
const canSubmit = computed(
  () => charCount.value > 0 && !isOverLimit.value && !isSubmitting.value,
);

const formatRelativeTime = (createdAt: string): string => {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
};

const handleSubmit = async () => {
  if (!canSubmit.value) {
    return;
  }

  isSubmitting.value = true;
  await addComment(newContent.value);
  newContent.value = '';
  isSubmitting.value = false;
};

const handleDelete = async (commentId: number) => {
  await deleteComment(commentId);
};

const handleReport = async (commentId: number) => {
  await reportComment(commentId);
};
</script>

<template>
  <div class="comment-list">
    <h3 class="comment-list__heading">Comments</h3>

    <!-- Comment input — visible only when authenticated -->
    <div class="comment-form">
      <textarea
        v-model="newContent"
        class="comment-form__textarea"
        :class="{ 'comment-form__textarea--over': isOverLimit }"
        placeholder="Share your thoughts… (max 280 chars)"
        rows="3"
        maxlength="300"
        @keydown.ctrl.enter="handleSubmit"
        @keydown.meta.enter="handleSubmit"
      />
      <div class="comment-form__footer">
        <span
          class="comment-form__counter"
          :class="{ 'comment-form__counter--over': isOverLimit }"
        >
          {{ charCount }}/280
        </span>
        <button
          class="comment-form__submit"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Posting…' : 'Post' }}
        </button>
      </div>
    </div>

    <!-- Comment list -->
    <ul v-if="listComment.length > 0" class="comment-list__items">
      <li
        v-for="comment in listComment"
        :key="comment.id"
        class="comment-item"
      >
        <!-- Avatar + nickname -->
        <div class="comment-item__header">
          <img
            v-if="comment.user?.avatarUrl"
            :src="comment.user.avatarUrl"
            :alt="comment.user.nickname"
            class="comment-item__avatar"
          />
          <span v-else class="comment-item__avatar comment-item__avatar--placeholder">
            {{ (comment.user?.nickname ?? 'U').charAt(0).toUpperCase() }}
          </span>

          <span class="comment-item__nickname">
            {{ comment.user?.nickname ?? 'Anonymous' }}
          </span>
          <span class="comment-item__time">
            {{ formatRelativeTime(comment.created_at) }}
          </span>

          <!-- Action buttons -->
          <div class="comment-item__actions">
            <!-- Delete — own comment only -->
            <button
              v-if="comment.user_id === authStore.user?.id"
              class="comment-item__action comment-item__action--delete"
              aria-label="Delete comment"
              title="Delete"
              @click="handleDelete(comment.id)"
            >
              🗑
            </button>

            <!-- Report — hover-visible flag -->
            <button
              class="comment-item__action comment-item__action--report"
              aria-label="Report comment"
              title="Report"
              @click="handleReport(comment.id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <p class="comment-item__content">{{ comment.content }}</p>
      </li>
    </ul>

    <!-- Empty state -->
    <p v-else-if="!isLoading" class="comment-list__empty">
      No comments yet. Be the first to share your thoughts!
    </p>

    <!-- Loading indicator -->
    <p v-if="isLoading" class="comment-list__loading">Loading…</p>

    <!-- Load more -->
    <button
      v-if="hasMore && !isLoading"
      class="comment-list__load-more"
      @click="loadMore"
    >
      Load more
    </button>
  </div>
</template>

<style scoped>
/* Container */
.comment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-list__heading {
  font-size: 0.875rem;
  font-weight: 600;
  color: #9B9BB4;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Comment form */
.comment-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background-color: rgba(20, 21, 41, 0.5);
  border: 1px solid rgba(155, 155, 180, 0.15);
  border-radius: 8px;
  padding: 10px;
}

.comment-form__textarea {
  width: 100%;
  resize: vertical;
  background: transparent;
  border: none;
  outline: none;
  color: #E8E8F0;
  font-size: 0.8125rem;
  font-family: 'Inter', sans-serif;
  line-height: 1.5;
}

.comment-form__textarea::placeholder {
  color: rgba(155, 155, 180, 0.6);
}

.comment-form__textarea--over {
  color: #F97066;
}

.comment-form__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.comment-form__counter {
  font-size: 0.75rem;
  color: #9B9BB4;
}

.comment-form__counter--over {
  color: #F97066;
}

.comment-form__submit {
  padding: 4px 14px;
  border-radius: 6px;
  border: none;
  background-color: #4F46E5;
  color: #E8E8F0;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
}

.comment-form__submit:hover:not(:disabled) {
  background-color: #6366F1;
}

.comment-form__submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Comment items */
.comment-list__items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.comment-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background-color: rgba(20, 21, 41, 0.5);
  border: 1px solid rgba(155, 155, 180, 0.1);
  border-radius: 8px;
}

.comment-item__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Avatar */
.comment-item__avatar {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  object-fit: cover;
  flex-shrink: 0;
}

.comment-item__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #4F46E5;
  color: #E8E8F0;
  font-size: 0.6875rem;
  font-weight: 600;
  /* width/height inherited from avatar class via shared selector */
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.comment-item__nickname {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #E8E8F0;
  flex-shrink: 0;
}

.comment-item__time {
  font-size: 0.75rem;
  color: #9B9BB4;
  flex-shrink: 0;
}

/* Action buttons — push to right */
.comment-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.comment-item__action {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: opacity 0.15s, color 0.15s;
  font-size: 0.75rem;
  color: #9B9BB4;
}

.comment-item__action:hover {
  opacity: 1;
}

.comment-item__action--delete:hover {
  color: #F97066;
}

/* Report button is subtle — only fully visible on hover of parent */
.comment-item__action--report {
  opacity: 0;
}

.comment-item:hover .comment-item__action--report {
  opacity: 0.5;
}

.comment-item__action--report:hover {
  opacity: 1 !important;
  color: #F59E0B;
}

/* Comment content */
.comment-item__content {
  font-size: 0.8125rem;
  color: #E8E8F0;
  line-height: 1.55;
  word-break: break-word;
  margin: 0;
  padding-left: 30px; /* aligns with text after avatar */
}

/* States */
.comment-list__empty,
.comment-list__loading {
  font-size: 0.8125rem;
  color: #9B9BB4;
  text-align: center;
  padding: 12px 0;
}

/* Load more */
.comment-list__load-more {
  align-self: center;
  background: transparent;
  border: 1px solid rgba(155, 155, 180, 0.25);
  border-radius: 6px;
  color: #9B9BB4;
  font-size: 0.8125rem;
  padding: 6px 18px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.comment-list__load-more:hover {
  border-color: rgba(155, 155, 180, 0.5);
  color: #E8E8F0;
}
</style>
