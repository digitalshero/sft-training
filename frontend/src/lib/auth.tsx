import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { api, storeTokens, clearTokens, getAccessToken } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  permissions: string[];
  is_super_admin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Called by login page after successful sign-in */
  setUser: (u: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if we have a stored token, fetch /auth/me to hydrate user
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<AuthUser>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/signout");
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
