import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { AuthContext } from "./context";
import { normalizeRole } from "@/lib/rbac";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );

  const loadProfile = async (userId: string | undefined | null) => {
    if (!userId) {
      setProfile(null);
      setRole(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, role")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Supabase profile error:", error);
      setProfile(null);
      setRole(null);
      return;
    }

    if (data) {
      setProfile(data);
      setRole(normalizeRole(data.role));
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Supabase session error:", error);
      }

      setSession(session);
      setUser(session?.user ?? null);
      await loadProfile(session?.user?.id);
      setLoading(false);
    };

    initAuth();

    if (!isSupabaseConfigured) {
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      void loadProfile(session?.user?.id);

      if (event === "SIGNED_OUT") {
        toast.error("Session expired", {
          description: "Please sign in again.",
        });
        setUser(null);
        setProfile(null);
        setRole(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [isSupabaseConfigured]);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error("Supabase authentication is not configured."),
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error("Supabase authentication is not configured."),
      };
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          auto_confirm: true,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
