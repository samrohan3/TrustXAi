import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  loginWithBackend,
  setStoredAuthToken,
} from "@/lib/backendApi";

export type UserRole = "admin" | "analyst" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  institution: string;
  role: UserRole;
  avatar: string;
}

export const ROLE_DASHBOARD_ROUTE: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  analyst: "/dashboard/analyst",
  viewer: "/dashboard/viewer",
};

export const getDashboardRouteForRole = (role: UserRole) => ROLE_DASHBOARD_ROUTE[role];

const DEMO_USERS: Record<string, User> = {
  "admin@rbi.gov.in": {
    id: "usr_001",
    email: "admin@rbi.gov.in",
    name: "Rajesh Chandra",
    institution: "RBI CFMC",
    role: "admin",
    avatar: "RC",
  },
  "analyst@sbi.co.in": {
    id: "usr_002",
    email: "analyst@sbi.co.in",
    name: "Priya Sharma",
    institution: "State Bank of India",
    role: "analyst",
    avatar: "PS",
  },
  "viewer@hdfc.com": {
    id: "usr_003",
    email: "viewer@hdfc.com",
    name: "Amit Patel",
    institution: "HDFC Bank",
    role: "viewer",
    avatar: "AP",
  },
};

interface AuthContextType {
  user: User | null;
  authToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  demoUsers: typeof DEMO_USERS;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("tc_user");
    const storedToken = getStoredAuthToken();

    if (storedToken) {
      setAuthToken(storedToken);
    }

    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem("tc_user"); }
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const backendLogin = await loginWithBackend(normalizedEmail, password);
      const mappedUser: User = {
        id: String(backendLogin.user.id),
        email: backendLogin.user.email,
        name: backendLogin.user.name,
        institution: backendLogin.user.institution,
        role: backendLogin.user.role,
        avatar: backendLogin.user.avatar,
      };

      setUser(mappedUser);
      setAuthToken(backendLogin.access_token);
      localStorage.setItem("tc_user", JSON.stringify(mappedUser));
      setStoredAuthToken(backendLogin.access_token);
      return { success: true, user: mappedUser };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      const isNetworkError = /unreachable|fetch|network/i.test(message);
      const fallbackUser = DEMO_USERS[normalizedEmail];

      if (isNetworkError && fallbackUser && password === "demo1234") {
        setUser(fallbackUser);
        setAuthToken(null);
        clearStoredAuthToken();
        localStorage.setItem("tc_user", JSON.stringify(fallbackUser));
        return { success: true, user: fallbackUser };
      }

      return { success: false, error: message || "Invalid email or password" };
    }
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem("tc_user");
    clearStoredAuthToken();
  };

  return (
    <AuthContext.Provider value={{ user, authToken, isAuthenticated: !!user, login, logout, demoUsers: DEMO_USERS }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
