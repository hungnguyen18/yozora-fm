import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// No-op lock: executes the callback immediately without acquiring
// navigator.locks, which eliminates the "Lock ... to recover" warnings.
// Matches the LockFunc signature from @supabase/auth-js.
const lockNoOp = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => {
  return fn();
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    lock: lockNoOp,
    storageKey: "yozora-auth",
    detectSessionInUrl: true,
  },
});
