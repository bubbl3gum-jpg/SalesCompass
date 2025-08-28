import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  sub: string; // user id (nik)
  username: string;
  email: string;
  role: string;
  store_id: string;
  store_name: string;
  perms: string[];
  can_access_all_stores: boolean;
}

interface LoginData {
  username: string;
  password: string;
  store_id: string;
  store_password: string;
}

interface SwitchStoreData {
  password: string;
  store_id: string;
  store_password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<{ access_token: string; user: User }, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  switchStoreMutation: UseMutationResult<{ access_token: string; user: User }, Error, SwitchStoreData>;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
}

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/': ['dashboard:read'],
  '/sales-entry': ['sales:create'],
  '/settlements': ['settlement:read'],
  '/stock-dashboard': ['stock:read'],
  '/stock-opname': ['stock:opname'],
  '/transfers': ['transfer:read'],
  '/price-lists': ['pricelist:read'],
  '/discounts': ['discount:read'],
  '/stores-overview': ['store:overview'],
  '/admin-settings': ['admin:settings'],
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem("accessToken")
  );

  // Fetch current user
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) return null;

      const res = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Try to refresh token
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem("accessToken", data.access_token);
            setAccessToken(data.access_token);
            return data.user;
          }

          // Clear invalid token
          localStorage.removeItem("accessToken");
          setAccessToken(null);
          return null;
        }
        throw new Error("Failed to fetch user");
      }

      return res.json();
    },
    retry: false,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }

      return res.json();
    },
    onSuccess: (data: { access_token: string; user: User }) => {
      localStorage.setItem("accessToken", data.access_token);
      setAccessToken(data.access_token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
      });
    },
    onSuccess: () => {
      localStorage.removeItem("accessToken");
      setAccessToken(null);
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Switch store mutation
  const switchStoreMutation = useMutation({
    mutationFn: async (data: SwitchStoreData) => {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/auth/switch-store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Store switch failed");
      }

      return res.json();
    },
    onSuccess: (data: { access_token: string; user: User }) => {
      localStorage.setItem("accessToken", data.access_token);
      setAccessToken(data.access_token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
      queryClient.clear(); // Clear all cached data for the old store
      toast({
        title: "Store switched",
        description: `Now working in: ${data.user.store_name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Store switch failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Permission helpers
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.perms.includes("admin:all")) return true;
    return user.perms.includes(permission);
  };

  const canAccessRoute = (route: string): boolean => {
    const requiredPerms = ROUTE_PERMISSIONS[route];
    if (!requiredPerms) return true; // No permission required
    return requiredPerms.some(perm => hasPermission(perm));
  };

  // Add auth header to all requests
  useEffect(() => {
    if (accessToken) {
      // Set default auth header for fetch
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const [resource, config] = args;
        
        // Skip adding auth header for auth endpoints
        if (typeof resource === 'string' && 
            (resource.includes('/auth/login') || 
             resource.includes('/auth/refresh'))) {
          return originalFetch(resource, config);
        }

        // Add auth header
        const headers = new Headers(config?.headers);
        if (!headers.has('Authorization') && accessToken) {
          headers.set('Authorization', `Bearer ${accessToken}`);
        }

        return originalFetch(resource, {
          ...config,
          headers,
        });
      };
    }
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        switchStoreMutation,
        hasPermission,
        canAccessRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useStoreAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useStoreAuth must be used within an AuthProvider");
  }
  return context;
}