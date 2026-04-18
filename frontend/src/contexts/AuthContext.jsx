import React, { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=anon, obj=user
  useEffect(() => {
    const token = localStorage.getItem("gr_token");
    if (!token) { setUser(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem("gr_token"); setUser(false); });
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("gr_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  };
  const logout = () => {
    localStorage.removeItem("gr_token");
    setUser(false);
  };
  const refresh = async () => {
    try { const r = await api.get("/auth/me"); setUser(r.data); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
