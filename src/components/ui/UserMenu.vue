<script setup lang="ts">
import { ref, computed } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { LogOut, ChevronDown, User } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const hasAvatar = computed(() => {
  return authStore.user?.avatarUrl && authStore.user.avatarUrl.length > 0;
});

const providerLabel = computed(() => {
  if (!authStore.user) {
    return '';
  }
  return authStore.user.provider === 'github' ? 'GitHub' : 'Google';
});

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
      class="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 border"
      :class="[
        isOpen
          ? 'bg-white/10 border-white/15'
          : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
      ]"
      @click="toggleDropdown"
    >
      <img
        v-if="hasAvatar"
        :src="authStore.user!.avatarUrl"
        :alt="authStore.user!.nickname"
        class="w-8 h-8 rounded-full ring-2 ring-primary/50 object-cover"
      />
      <div
        v-else
        class="w-8 h-8 rounded-full ring-2 ring-primary/50 bg-primary/20 flex items-center justify-center"
      >
        <User :size="16" class="text-primary-light" />
      </div>

      <span class="text-sm text-soft-white max-w-[120px] truncate hidden sm:inline">
        {{ authStore.user!.nickname }}
      </span>

      <ChevronDown
        :size="14"
        class="shrink-0 text-muted-lavender transition-transform duration-150 hidden sm:block"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-56 rounded-lg shadow-2xl overflow-hidden"
        style="background-color: #1a1b35; border: 1px solid rgba(255, 255, 255, 0.12);"
      >
        <!-- User info header -->
        <div class="px-4 py-3 border-b" style="border-color: rgba(255, 255, 255, 0.08);">
          <div class="flex items-center gap-3">
            <img
              v-if="hasAvatar"
              :src="authStore.user!.avatarUrl"
              :alt="authStore.user!.nickname"
              class="w-10 h-10 rounded-full ring-2 ring-primary/40 object-cover shrink-0"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full ring-2 ring-primary/40 bg-primary/20 flex items-center justify-center shrink-0"
            >
              <User :size="18" class="text-primary-light" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-soft-white truncate">
                {{ authStore.user!.nickname }}
              </p>
              <p class="text-xs text-muted-lavender">
                via {{ providerLabel }}
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="py-1">
          <button
            class="flex items-center gap-3 w-full px-4 py-3 text-sm text-soft-white transition-colors duration-150 hover:bg-white/5"
            @click="signOut"
          >
            <LogOut :size="16" class="shrink-0 text-accent" />
            Sign out
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
