import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { setAuthTokenProvider } from "@/lib/api";

const PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY;

function MissingConfig() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-3">Configuration Required</h1>
        <p className="text-muted-foreground leading-relaxed">
          <code>VITE_CLERK_PUBLISHABLE_KEY</code> is missing. Add it to your frontend
          environment and rebuild.
        </p>
      </div>
    </div>
  );
}

function AuthTokenBootstrap() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenProvider(() => getToken());
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  return null;
}

const root = createRoot(document.getElementById("root")!);

if (!PUBLISHABLE_KEY) {
  root.render(
    <StrictMode>
      <MissingConfig />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <AuthTokenBootstrap />
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}
