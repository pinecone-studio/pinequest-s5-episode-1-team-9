import { createContext, useContext, useState, type ReactNode } from "react";

export type User = { name: string; email: string };

type AuthValue = {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
};

const STORAGE_KEY = "team9:user";
const AuthContext = createContext<AuthValue | null>(null);

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const login = (email: string) => {
    const next: User = { name: email.split("@")[0], email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
