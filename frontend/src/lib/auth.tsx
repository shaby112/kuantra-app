import React from "react";
import { apiFetch } from "@/lib/api";

export type SignUpResponse = {
  success: boolean;
  message: string;
  user_id: string;
  email: string;
  otp_code?: string;
};

export type SignInResponse = {
  success: boolean;
  access_token: string;
  token_type: string;
  user: { id: string; username: string; email: string; is_verified: boolean };
};

export async function signUp(args: {
  username: string;
  email: string;
  password: string;
}): Promise<SignUpResponse> {
  return apiFetch<SignUpResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function verifyEmail(args: {
  email: string;
  otp_code: string;
}): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function signIn(args: {
  username: string;
  password: string;
}): Promise<SignInResponse> {
  return apiFetch<SignInResponse>("/api/v1/auth/signin", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function saveAuth(data: SignInResponse) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

export function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export function getUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem("access_token");
}

// Clerk compatibility shim (Clerk removed from runtime)
export function ClerkProvider({ children }: { children: React.ReactNode; publishableKey?: string }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    isSignedIn: isAuthenticated(),
    getToken: async () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("access_token");
    },
  };
}

export function useClerk() {
  return {
    signOut: async () => {
      clearAuth();
    },
  };
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? null : <>{children}</>;
}

export function RedirectToSignIn() {
  return null;
}

export function SignIn() {
  return <div className="p-6 text-sm text-muted-foreground">Authentication is disabled in this build.</div>;
}

export function SignUp() {
  return <div className="p-6 text-sm text-muted-foreground">Authentication is disabled in this build.</div>;
}
