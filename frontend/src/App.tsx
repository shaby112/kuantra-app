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
import LicenseGate from "./pages/LicenseGate";

const queryClient = new QueryClient();

function ProtectedLayout() {
  const hasLicense = typeof window !== "undefined" && !!localStorage.getItem("license_key");
  if (!hasLicense) return <Navigate to="/license" replace />;
  return <Outlet />;
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
            <Route path="/license" element={<LicenseGate />} />

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
