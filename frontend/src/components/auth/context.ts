import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
