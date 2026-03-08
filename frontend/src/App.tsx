import { SignedIn, SignedOut, RedirectToSignIn, SignIn, SignUp } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import DashboardBuilder from "./pages/DashboardBuilder";
import ModelingStudio from "./pages/ModelingStudio";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

function ProtectedLayout() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
            <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />

            {/* Backward-compatible auth paths */}
            <Route path="/signin/*" element={<Navigate to="/sign-in" replace />} />
            <Route path="/signup/*" element={<Navigate to="/sign-up" replace />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Dashboard />}>
                <Route path="builder" element={<DashboardBuilder />} />
                <Route path="builder/:id" element={<DashboardBuilder />} />
                <Route path="modeling" element={<ModelingStudio />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
