import { ref, watch } from "vue";
import type { Ref } from "vue";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useRealtimeComments } from "@/composables/useRealtime";
import type { IComment } from "@/types";

const PAGE_SIZE = 5;

export const useComments = (songId: Ref<number>) => {
  const authStore = useAuthStore();
  const listComment = ref<IComment[]>([]);
  const isLoading = ref(false);
  const hasMore = ref(true);
  const page = ref(0);

  const fetchComments = async (id: number) => {
    isLoading.value = true;

    const from = 0;
    const to = PAGE_SIZE - 1;

    const { data } = await supabase
      .from("comments")
      .select("id, song_id, user_id, content, report_count, status, created_at")
      .eq("song_id", id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data) {
      // Enrich each comment with user profile from auth.users metadata.
      // Supabase doesn't expose auth.users directly; we rely on a profiles view/table
      // or fall back to minimal display data stored on the comment row.
      listComment.value = data as IComment[];
      hasMore.value = data.length === PAGE_SIZE;
    }

    isLoading.value = false;
  };

  const loadMore = async () => {
    if (!hasMore.value || isLoading.value) {
      return;
    }

    isLoading.value = true;
    page.value += 1;

    const from = page.value * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from("comments")
      .select("id, song_id, user_id, content, report_count, status, created_at")
      .eq("song_id", songId.value)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data) {
      listComment.value = [...listComment.value, ...(data as IComment[])];
      hasMore.value = data.length === PAGE_SIZE;
    }

    isLoading.value = false;
  };

  const addComment = async (content: string) => {
    if (!authStore.isAuthenticated || !authStore.user) {
      return;
    }

    const trimmed = content.trim().slice(0, 280);

    if (!trimmed) {
      return;
    }

    await supabase.from("comments").insert({
      song_id: songId.value,
      user_id: authStore.user.id,
      content: trimmed,
    });

    // Realtime subscription will trigger a re-fetch; no optimistic update needed.
  };

  const deleteComment = async (commentId: number) => {
    if (!authStore.isAuthenticated || !authStore.user) {
      return;
    }

    await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", authStore.user.id);

    listComment.value = listComment.value.filter((c) => c.id !== commentId);
  };

  const reportComment = async (commentId: number) => {
    // Fetch current count, then increment (no RPC needed)
    const { data } = await supabase
      .from("comments")
      .select("report_count")
      .eq("id", commentId)
      .single();

    if (data) {
      await supabase
        .from("comments")
        .update({ report_count: (data.report_count ?? 0) + 1 })
        .eq("id", commentId);
    }
  };

  // Re-init when song changes
  watch(
    songId,
    (newId) => {
      listComment.value = [];
      page.value = 0;
      hasMore.value = true;
      fetchComments(newId);
    },
    { immediate: true },
  );

  // Realtime: prepend new comments from other users
  useRealtimeComments(songId.value, () => {
    fetchComments(songId.value);
  });

  return {
    listComment,
    isLoading,
    hasMore,
    loadMore,
    addComment,
    deleteComment,
    reportComment,
  };
};
