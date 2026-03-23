<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

onClickOutside(dropdownRef, () => {
  isOpen.value = false;
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

async function signOut() {
  isOpen.value = false;
  await authStore.signOut();
}
</script>

<template>
  <div ref="dropdownRef" class="fixed top-4 right-4 z-20">
    <button
      class="flex items-center gap-2 bg-midnight border border-primary/30 hover:border-primary px-3 py-1.5 rounded-lg transition-colors duration-150"
      @click="toggleDropdown"
    >
      <img
        :src="authStore.user!.avatarUrl"
        :alt="authStore.user!.nickname"
        class="w-8 h-8 rounded-full ring-2 ring-primary/50 object-cover"
      />
      <span class="text-sm text-soft-white max-w-[120px] truncate">
        {{ authStore.user!.nickname }}
      </span>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 mt-2 w-40 bg-midnight border border-white/10 rounded-lg shadow-xl overflow-hidden"
    >
      <button
        class="flex items-center gap-2 w-full px-4 py-3 text-sm text-soft-white hover:bg-white/5 transition-colors duration-150"
        @click="signOut"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </div>
  </div>
</template>
