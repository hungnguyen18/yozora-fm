import { ref, watch, onUnmounted } from "vue";
import type { Ref } from "vue";
import { supabase } from "@/lib/supabase";
import { useGuestIdentity } from "@/composables/useGuestIdentity";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const useVote = (songId: Ref<number>) => {
  const { guestId } = useGuestIdentity();
  const hasVoted = ref(false);
  const voteCount = ref(0);
  const isLoading = ref(false);
  let voteChannel: RealtimeChannel | null = null;

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

    // Check if this guest has voted on this song
    const { data: voteData } = await supabase
      .from("votes")
      .select("user_id")
      .eq("song_id", id)
      .eq("user_id", guestId.value)
      .maybeSingle();

    hasVoted.value = voteData !== null;
  };

  const toggleVote = async () => {
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;

    // Optimistic update (clamp to 0 to prevent negative counts)
    const previousHasVoted = hasVoted.value;
    const previousVoteCount = voteCount.value;

    hasVoted.value = !previousHasVoted;
    voteCount.value = previousHasVoted
      ? Math.max(previousVoteCount - 1, 0)
      : previousVoteCount + 1;

    if (previousHasVoted) {
      const { error } = await supabase
        .from("votes")
        .delete()
        .eq("song_id", songId.value)
        .eq("user_id", guestId.value);

      if (error) {
        hasVoted.value = previousHasVoted;
        voteCount.value = previousVoteCount;
      }
    } else {
      const { error } = await supabase
        .from("votes")
        .insert({ song_id: songId.value, user_id: guestId.value });

      if (error) {
        hasVoted.value = previousHasVoted;
        voteCount.value = previousVoteCount;
      }
    }

    // Re-fetch actual state to correct any drift between optimistic UI and DB
    await fetchVoteState(songId.value);
    isLoading.value = false;
  };

  // Subscribe to realtime vote count changes — re-subscribes when songId changes
  const subscribeVotes = (id: number): void => {
    if (voteChannel) {
      supabase.removeChannel(voteChannel);
      voteChannel = null;
    }

    voteChannel = supabase
      .channel(`votes:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `song_id=eq.${id}`,
        },
        () => {
          supabase
            .from("songs")
            .select("vote_count")
            .eq("id", id)
            .single()
            .then(({ data }) => {
              if (data) {
                voteCount.value = (data as { vote_count: number }).vote_count;
              }
            });
        },
      )
      .subscribe();
  };

  // Re-fetch vote state + re-subscribe realtime when song changes
  watch(
    songId,
    (newId) => {
      fetchVoteState(newId);
      subscribeVotes(newId);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (voteChannel) {
      supabase.removeChannel(voteChannel);
      voteChannel = null;
    }
  });

  return {
    hasVoted,
    voteCount,
    isLoading,
    toggleVote,
  };
};
