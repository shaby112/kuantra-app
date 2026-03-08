import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { setAuthTokenProvider } from "@/lib/api";

const PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY;

function AuthTokenBootstrap() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenProvider(() => getToken());
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  return null;
}

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AuthTokenBootstrap />
      <App />
    </ClerkProvider>
  </StrictMode>,
);
