import { createClient } from "@supabase/supabase-js";
import type { LockFunc } from "@supabase/auth-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// No-op lock: executes the callback immediately without acquiring
// navigator.locks, which eliminates the "Lock ... to recover" warnings.
const lockNoOp: LockFunc = async (_name, _acquireTimeout, fn) => {
  return fn();
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    lock: lockNoOp,
    storageKey: "yozora-auth",
    detectSessionInUrl: true,
  },
});
