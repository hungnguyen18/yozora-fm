import { ref, watch } from "vue";
import type { Ref } from "vue";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useRealtimeVotes } from "@/composables/useRealtime";

export const useVote = (songId: Ref<number>) => {
  const authStore = useAuthStore();
  const hasVoted = ref(false);
  const voteCount = ref(0);
  const isLoading = ref(false);

  const fetchVoteState = async (id: number) => {
    // Fetch current vote count
    const { data: songData } = await supabase
      .from("songs")
      .select("vote_count")
      .eq("id", id)
      .single();

    if (songData) {
      voteCount.value = (songData as { vote_count: number }).vote_count;
    }

    // Check if the authenticated user has voted on this song
    if (!authStore.isAuthenticated || !authStore.user) {
      hasVoted.value = false;
      return;
    }

    const { data: voteData } = await supabase
      .from("votes")
      .select("user_id")
      .eq("song_id", id)
      .eq("user_id", authStore.user.id)
      .maybeSingle();

    hasVoted.value = voteData !== null;
  };

  const toggleVote = async () => {
    if (!authStore.isAuthenticated || !authStore.user || isLoading.value) {
      return;
    }

    isLoading.value = true;

    // Optimistic update
    const previousHasVoted = hasVoted.value;
    const previousVoteCount = voteCount.value;

    hasVoted.value = !previousHasVoted;
    voteCount.value = previousHasVoted
      ? previousVoteCount - 1
      : previousVoteCount + 1;

    if (previousHasVoted) {
      const { error } = await supabase
        .from("votes")
        .delete()
        .eq("song_id", songId.value)
        .eq("user_id", authStore.user.id);

      if (error) {
        // Rollback on error
        hasVoted.value = previousHasVoted;
        voteCount.value = previousVoteCount;
      }
    } else {
      const { error } = await supabase
        .from("votes")
        .insert({ song_id: songId.value, user_id: authStore.user.id });

      if (error) {
        // Rollback on error
        hasVoted.value = previousHasVoted;
        voteCount.value = previousVoteCount;
      }
    }

    isLoading.value = false;
  };

  // Subscribe to realtime vote count changes
  useRealtimeVotes(songId.value, (newCount: number) => {
    voteCount.value = newCount;
  });

  // Re-fetch vote state when song changes
  watch(
    songId,
    (newId) => {
      fetchVoteState(newId);
    },
    { immediate: true },
  );

  return {
    hasVoted,
    voteCount,
    isLoading,
    toggleVote,
  };
};
