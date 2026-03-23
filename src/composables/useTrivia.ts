import { ref, watch } from "vue";
import type { Ref } from "vue";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { ITrivia } from "@/types";

const MAX_TRIVIA_CONTENT_LENGTH = 500;
const TRIVIA_DISPLAY_LIMIT = 3;

export const useTrivia = (songId: Ref<number>) => {
  const authStore = useAuthStore();
  const listTrivia = ref<ITrivia[]>([]);
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  const fetchTrivia = async (id: number) => {
    isLoading.value = true;
    error.value = null;

    const { data, error: fetchError } = await supabase
      .from("trivia")
      .select("*, user:user_id(id, nickname, avatarUrl, provider)")
      .eq("song_id", id)
      .eq("status", "approved")
      .order("upvote_count", { ascending: false })
      .limit(TRIVIA_DISPLAY_LIMIT);

    if (fetchError) {
      error.value = fetchError.message;
    } else {
      listTrivia.value = (data ?? []) as ITrivia[];
    }

    isLoading.value = false;
  };

  const submitTrivia = async (content: string) => {
    if (!authStore.isAuthenticated || !authStore.user) {
      error.value = "Authentication required to submit trivia.";
      return;
    }

    const trimmed = content.trim();

    if (trimmed.length === 0 || trimmed.length > MAX_TRIVIA_CONTENT_LENGTH) {
      error.value = `Trivia must be between 1 and ${MAX_TRIVIA_CONTENT_LENGTH} characters.`;
      return;
    }

    isSubmitting.value = true;
    error.value = null;

    const { error: insertError } = await supabase.from("trivia").insert({
      song_id: songId.value,
      user_id: authStore.user.id,
      content: trimmed,
    });

    if (insertError) {
      error.value = insertError.message;
    }

    isSubmitting.value = false;
  };

  const upvoteTrivia = async (triviaId: number) => {
    if (!authStore.isAuthenticated || !authStore.user) {
      error.value = "Authentication required to upvote.";
      return;
    }

    // Optimistic update on the local list
    const item = listTrivia.value.find((t) => t.id === triviaId);
    if (item) {
      item.upvote_count += 1;
    }

    const { error: upvoteError } = await supabase
      .from("trivia_upvotes")
      .insert({ trivia_id: triviaId, user_id: authStore.user.id });

    if (upvoteError) {
      // Rollback optimistic update on failure
      if (item) {
        item.upvote_count -= 1;
      }
      error.value = upvoteError.message;
    }
  };

  const reportTrivia = async (triviaId: number) => {
    const { data } = await supabase
      .from("trivia")
      .select("report_count")
      .eq("id", triviaId)
      .single();

    if (data) {
      const { error: updateError } = await supabase
        .from("trivia")
        .update({ report_count: (data.report_count ?? 0) + 1 })
        .eq("id", triviaId);

      if (updateError) {
        error.value = updateError.message;
      }
    }
  };

  watch(
    songId,
    (newId) => {
      fetchTrivia(newId);
    },
    { immediate: true },
  );

  return {
    listTrivia,
    isLoading,
    isSubmitting,
    error,
    fetchTrivia,
    submitTrivia,
    upvoteTrivia,
    reportTrivia,
  };
};
