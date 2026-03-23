<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { LogOut } from 'lucide-vue-next';
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
        <LogOut :size="16" class="shrink-0" />
        Sign out
      </button>
    </div>
  </div>
</template>
