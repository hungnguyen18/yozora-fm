import { supabase } from '@/lib/supabase';
import { onUnmounted } from 'vue';

// Subscribe to vote count changes for a song and invoke callback with updated count.
export const useRealtimeVotes = (songId: number, onUpdate: (newCount: number) => void) => {
  const channel = supabase
    .channel(`votes:${songId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'votes',
        filter: `song_id=eq.${songId}`,
      },
      () => {
        supabase
          .from('songs')
          .select('vote_count')
          .eq('id', songId)
          .single()
          .then(({ data }) => {
            if (data) {
              onUpdate((data as { vote_count: number }).vote_count);
            }
          });
      },
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  return channel;
};

// Subscribe to new comments inserted for a song and invoke callback on each insert.
export const useRealtimeComments = (songId: number, onInsert: () => void) => {
  const channel = supabase
    .channel(`comments:${songId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `song_id=eq.${songId}`,
      },
      () => {
        onInsert();
      },
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  return channel;
};
