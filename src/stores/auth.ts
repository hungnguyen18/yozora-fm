import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import type { IUser } from "@/types";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as IUser | null,
    isLoading: false,
  }),
  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
  },
  actions: {
    async signInWithGoogle() {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    },

    async signInWithGithub() {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.origin },
      });
    },

    async signOut() {
      await supabase.auth.signOut();
      this.user = null;
    },

    // Call on app mount to restore session and listen for auth state changes.
    async initAuth() {
      this.isLoading = true;

      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        const sessionUser = data.session.user;
        this.user = {
          id: sessionUser.id,
          nickname:
            (sessionUser.user_metadata?.["full_name"] as string | undefined) ??
            sessionUser.email ??
            "Anonymous",
          avatarUrl:
            (sessionUser.user_metadata?.["avatar_url"] as string | undefined) ??
            "",
          provider: ((sessionUser.app_metadata?.["provider"] as
            | string
            | undefined) === "github"
            ? "github"
            : "google") as "google" | "github",
        };
      }

      this.isLoading = false;

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const authUser = session.user;
          this.user = {
            id: authUser.id,
            nickname:
              (authUser.user_metadata?.["full_name"] as string | undefined) ??
              authUser.email ??
              "Anonymous",
            avatarUrl:
              (authUser.user_metadata?.["avatar_url"] as string | undefined) ??
              "",
            provider: ((authUser.app_metadata?.["provider"] as
              | string
              | undefined) === "github"
              ? "github"
              : "google") as "google" | "github",
          };
        } else {
          this.user = null;
        }
      });
    },
  },
});
