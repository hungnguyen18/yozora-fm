<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import changelogRaw from '../../../CHANGELOG.md?raw';

const router = useRouter();

const navigateHome = () => {
  router.push('/');
};

const content = computed(() => parseChangelog(changelogRaw));

const parseChangelog = (md: string): string => {
  return md
    .split('\n')
    .map((line) => {
      // H1
      if (line.startsWith('# ')) {
        return `<h1 class="text-3xl font-bold text-white mb-2">${escapeHtml(line.slice(2))}</h1>`;
      }
      // H2 — version headers
      if (line.startsWith('## ')) {
        const text = escapeHtml(line.slice(3));
        const isUnreleased = text.includes('Unreleased');
        const cls = isUnreleased
          ? 'text-indigo-400'
          : 'text-white';
        return `<h2 class="text-xl font-semibold ${cls} mt-10 mb-3 pb-2 border-b border-white/10">${text}</h2>`;
      }
      // H3 — section headers (Added, Changed, Fixed, Removed)
      if (line.startsWith('### ')) {
        const text = escapeHtml(line.slice(4));
        const colorMap: Record<string, string> = {
          'Added': 'text-emerald-400',
          'Changed': 'text-amber-400',
          'Fixed': 'text-sky-400',
          'Removed': 'text-red-400',
          'Other': 'text-gray-400',
        };
        const cls = colorMap[text] || 'text-gray-300';
        return `<h3 class="text-sm font-semibold uppercase tracking-wider ${cls} mt-6 mb-2">${text}</h3>`;
      }
      // List items
      if (line.startsWith('- ')) {
        const text = line.slice(2);
        // Bold text between **...**
        const formatted = escapeHtml(text).replace(
          /\*\*(.*?)\*\*/g,
          '<span class="text-white font-medium">$1</span>',
        );
        return `<li class="text-gray-300 text-sm leading-relaxed ml-4 mb-1.5 list-disc">${formatted}</li>`;
      }
      // Paragraph text (non-empty, non-heading)
      if (line.trim() && !line.startsWith('Format follows')) {
        return `<p class="text-gray-400 text-sm mb-4">${escapeHtml(line)}</p>`;
      }
      return '';
    })
    .join('\n');
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
</script>

<template>
  <div class="changelog-page">
    <div class="changelog-container">
      <button
        class="back-button"
        @click="navigateHome"
      >
        <ArrowLeft :size="16" />
        <span>Back to Galaxy</span>
      </button>

      <div
        class="changelog-content"
        v-html="content"
      />
    </div>
  </div>
</template>

<style scoped>
.changelog-page {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #0A0B1A;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(155, 155, 180, 0.2) transparent;
}

.changelog-container {
  max-width: 680px;
  margin: 0 auto;
  padding: 3rem 1.5rem 6rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(155, 155, 180, 0.6);
  font-size: 0.875rem;
  margin-bottom: 2rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-button:hover {
  color: rgba(232, 232, 240, 0.9);
  border-color: rgba(155, 155, 180, 0.15);
  background: rgba(155, 155, 180, 0.05);
}

.back-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.changelog-content :deep(ul) {
  list-style: disc;
  padding-left: 1rem;
}
</style>
