<script setup lang="ts">
import { ref, computed, toRef, nextTick } from 'vue';
import { formatTimeAgo } from '@vueuse/core';
import { Flag, Trash2, MessageCircle, Send, ChevronDown } from 'lucide-vue-next';
import { useComments } from '@/composables/useComments';
import { useGuestIdentity } from '@/composables/useGuestIdentity';

type TCommentListProps = {
  songId: number;
};

const props = defineProps<TCommentListProps>();

const songIdRef = toRef(props, 'songId');

const { listComment, isLoading, hasMore, loadMore, addComment, deleteComment, reportComment } =
  useComments(songIdRef);
const { guestName, guestId } = useGuestIdentity();

const newContent = ref('');
const isSubmitting = ref(false);
const isFocused = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const charCount = computed(() => newContent.value.length);
const isOverLimit = computed(() => charCount.value > 280);
const canSubmit = computed(
  () => charCount.value > 0 && !isOverLimit.value && !isSubmitting.value,
);
const isExpanded = computed(() => isFocused.value || newContent.value.length > 0);

const displayName = computed(() => guestName.value);

const avatarInitial = computed(() => displayName.value.charAt(0).toUpperCase());

const formatRelativeTime = (createdAt: string): string => {
  return formatTimeAgo(new Date(createdAt));
};

const handleFocus = () => {
  isFocused.value = true;
};

const handleBlur = () => {
  if (newContent.value.length === 0) {
    isFocused.value = false;
  }
};

const handleSubmit = async () => {
  if (!canSubmit.value) {
    return;
  }

  isSubmitting.value = true;
  await addComment(newContent.value);
  newContent.value = '';
  isSubmitting.value = false;
  isFocused.value = false;
  await nextTick();
  textareaRef.value?.blur();
};

const handleDelete = async (commentId: number) => {
  await deleteComment(commentId);
};

const handleReport = async (commentId: number) => {
  await reportComment(commentId);
};

const isMac = typeof globalThis.navigator !== 'undefined'
  && globalThis.navigator.platform?.includes('Mac');

const listPrompt = [
  'This OP hits different...',
  'The nostalgia is real',
  'Best anime opening ever?',
  'This brings back memories',
];
const randomPrompt = listPrompt[Math.floor(Math.random() * listPrompt.length)];
</script>

<template>
  <div class="comment-section">
    <!-- Compact chat-like input -->
    <div
      class="chat-input"
      :class="{ 'chat-input--expanded': isExpanded }"
    >
      <!-- Avatar + input row -->
      <div class="chat-input__row">
        <span class="chat-input__avatar">{{ avatarInitial }}</span>
        <div class="chat-input__field-wrap">
          <textarea
            ref="textareaRef"
            v-model="newContent"
            class="chat-input__field"
            :class="{ 'chat-input__field--over': isOverLimit }"
            :placeholder="randomPrompt"
            :rows="isExpanded ? 3 : 1"
            maxlength="300"
            @focus="handleFocus"
            @blur="handleBlur"
            @keydown.ctrl.enter="handleSubmit"
            @keydown.meta.enter="handleSubmit"
          />
        </div>
        <button
          class="chat-input__send"
          :class="{ 'chat-input__send--active': canSubmit }"
          :disabled="!canSubmit"
          aria-label="Post comment"
          @click="handleSubmit"
        >
          <Send :size="14" />
        </button>
      </div>

      <!-- Expanded footer -->
      <Transition name="expand-footer">
        <div v-if="isExpanded" class="chat-input__footer">
          <span class="chat-input__identity">
            as <strong>{{ displayName }}</strong>
          </span>
          <span class="chat-input__meta">
            <span
              class="chat-input__counter"
              :class="{ 'chat-input__counter--over': isOverLimit }"
            >{{ charCount }}/280</span>
            <span class="chat-input__hint">
              <kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd>+<kbd>↵</kbd>
            </span>
          </span>
        </div>
      </Transition>
    </div>

    <!-- Comments thread -->
    <div class="thread">
      <TransitionGroup name="comment-pop">
        <div
          v-for="comment in listComment"
          :key="comment.id"
          class="bubble"
        >
          <div class="bubble__header">
            <span class="bubble__avatar bubble__avatar--gen">
              {{ (comment.guest_name ?? '?').charAt(0).toUpperCase() }}
            </span>

            <span class="bubble__name">
              {{ comment.guest_name ?? 'Traveler' }}
            </span>
            <span class="bubble__time">
              {{ formatRelativeTime(comment.created_at) }}
            </span>

            <div class="bubble__actions">
              <button
                v-if="comment.user_id === guestId"
                class="bubble__action bubble__action--delete"
                aria-label="Delete comment"
                title="Delete"
                @click="handleDelete(comment.id)"
              >
                <Trash2 :size="12" />
              </button>
              <button
                class="bubble__action bubble__action--report"
                aria-label="Report comment"
                title="Report"
                @click="handleReport(comment.id)"
              >
                <Flag :size="12" />
              </button>
            </div>
          </div>
          <p class="bubble__text">{{ comment.content }}</p>
        </div>
      </TransitionGroup>

      <!-- Empty state — warm and inviting -->
      <div v-if="listComment.length === 0 && !isLoading" class="empty-state">
        <div class="empty-state__icon">
          <MessageCircle :size="20" />
        </div>
        <p class="empty-state__text">
          Be the first to leave a note on this star
        </p>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="thread-loading">
        <div class="thread-loading__dot" />
        <div class="thread-loading__dot" />
        <div class="thread-loading__dot" />
      </div>

      <!-- Load more -->
      <button
        v-if="hasMore && !isLoading"
        class="thread-more"
        @click="loadMore"
      >
        <ChevronDown :size="14" />
        <span>Earlier comments</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════
   COMMENT SECTION — Chat-like redesign
   ═══════════════════════════════════════════ */

.comment-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Chat Input ── */
.chat-input {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid rgba(155, 155, 180, 0.1);
  background: rgba(20, 21, 41, 0.4);
  padding: 8px 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-input--expanded {
  border-color: rgba(129, 140, 248, 0.25);
  background: rgba(20, 21, 41, 0.6);
  box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.08),
              0 4px 24px rgba(0, 0, 0, 0.2);
}

.chat-input__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.chat-input__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.chat-input__field-wrap {
  flex: 1;
  min-width: 0;
}

.chat-input__field {
  width: 100%;
  resize: none;
  background: transparent;
  border: none;
  outline: none;
  color: #E8E8F0;
  font-size: 0.8125rem;
  font-family: inherit;
  line-height: 1.5;
  padding: 4px 0;
  transition: height 0.2s ease;
}

.chat-input__field::placeholder {
  color: rgba(155, 155, 180, 0.4);
  font-style: italic;
}

.chat-input__field--over {
  color: #F97066;
}

.chat-input__send {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(155, 155, 180, 0.1);
  color: rgba(155, 155, 180, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-top: 1px;
}

.chat-input__send--active {
  background: linear-gradient(135deg, #6366F1, #818CF8);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

.chat-input__send--active:hover {
  transform: scale(1.08);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.5);
}

.chat-input__send:disabled {
  cursor: default;
}

/* Footer row — expands in */
.chat-input__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 0 36px; /* align with text field */
}

.chat-input__identity {
  font-size: 0.6875rem;
  color: rgba(155, 155, 180, 0.45);
}

.chat-input__identity strong {
  color: rgba(155, 155, 180, 0.65);
  font-weight: 600;
}

.chat-input__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-input__counter {
  font-size: 0.6875rem;
  color: rgba(155, 155, 180, 0.4);
  font-variant-numeric: tabular-nums;
}

.chat-input__counter--over {
  color: #F97066;
}

.chat-input__hint {
  font-size: 0.625rem;
  color: rgba(155, 155, 180, 0.3);
}

.chat-input__hint kbd {
  display: inline-block;
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(155, 155, 180, 0.08);
  border: 1px solid rgba(155, 155, 180, 0.12);
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
}

/* Footer expand transition */
.expand-footer-enter-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.expand-footer-leave-active {
  transition: all 0.15s ease;
}
.expand-footer-enter-from,
.expand-footer-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
}
.expand-footer-enter-to,
.expand-footer-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 40px;
}

/* ── Thread ── */
.thread {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Comment bubble */
.bubble {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(20, 21, 41, 0.35);
  border: 1px solid rgba(155, 155, 180, 0.06);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.bubble:hover {
  background: rgba(20, 21, 41, 0.55);
  border-color: rgba(155, 155, 180, 0.1);
}

.bubble__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bubble__avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.bubble__avatar--gen {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.6));
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.625rem;
  font-weight: 700;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bubble__name {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(200, 200, 220, 0.85);
}

.bubble__time {
  font-size: 0.6875rem;
  color: rgba(155, 155, 180, 0.4);
}

.bubble__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.bubble:hover .bubble__actions {
  opacity: 1;
}

.bubble__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  color: rgba(155, 155, 180, 0.5);
  transition: color 0.15s, background 0.15s;
}

.bubble__action:hover {
  background: rgba(155, 155, 180, 0.08);
}

.bubble__action--delete:hover {
  color: #F97066;
}

.bubble__action--report:hover {
  color: #F59E0B;
}

.bubble__text {
  font-size: 0.8125rem;
  color: rgba(232, 232, 240, 0.9);
  line-height: 1.55;
  word-break: break-word;
  margin: 0;
  padding-left: 28px;
}

/* Comment pop-in animation */
.comment-pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.comment-pop-leave-active {
  transition: all 0.2s ease;
}
.comment-pop-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.comment-pop-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
.comment-pop-move {
  transition: transform 0.3s ease;
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 0 8px;
}

.empty-state__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.08);
  color: rgba(129, 140, 248, 0.4);
  animation: emptyPulse 3s ease-in-out infinite;
}

@keyframes emptyPulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

.empty-state__text {
  font-size: 0.75rem;
  color: rgba(155, 155, 180, 0.45);
  font-style: italic;
  margin: 0;
}

/* ── Loading dots ── */
.thread-loading {
  display: flex;
  justify-content: center;
  gap: 5px;
  padding: 16px 0;
}

.thread-loading__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.4);
  animation: loadBounce 1.2s ease-in-out infinite;
}

.thread-loading__dot:nth-child(2) { animation-delay: 0.15s; }
.thread-loading__dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes loadBounce {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}

/* ── Load more ── */
.thread-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  align-self: center;
  background: transparent;
  border: none;
  color: rgba(155, 155, 180, 0.45);
  font-size: 0.75rem;
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}

.thread-more:hover {
  color: rgba(155, 155, 180, 0.7);
  background: rgba(155, 155, 180, 0.06);
}
</style>
