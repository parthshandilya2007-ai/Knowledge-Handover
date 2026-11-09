import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, configureApiAuth } from "../../lib/api/client";
import { connectSocket, disconnectSocket } from "../../lib/socket/socketClient";
import { User } from "../../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("accessToken"));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("accessToken", newToken);
      connectSocket(newToken);
    } else {
      localStorage.removeItem("accessToken");
      disconnectSocket();
    }
  };

  // Wire token getter/setter to axios
  useEffect(() => {
    configureApiAuth(
      () => token,
      (newToken) => setToken(newToken)
    );
  }, [token]);

  const refreshUser = async () => {
    try {
      const data = await api.get<{ user: User }>("/users/me");
      setUser(data.user);
    } catch {
      setUser(null);
      setToken(null);
    }
  };

  // Initial load
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          await refreshUser();
          connectSocket(token);
        } catch {
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/register", {
      email,
      password,
      name
    });
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

