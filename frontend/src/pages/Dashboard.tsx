import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { DataWorkspace } from "@/components/DataWorkspace";
import { DangerModal } from "@/components/DangerModal";
import { ConnectionsView } from "@/components/ConnectionsView";
import { SettingsView } from "@/components/SettingsView";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useGlobalState } from "@/context/GlobalStateContext";

export default function Dashboard() {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed
  } = useGlobalState();
  const [activeWorkspaceData, setActiveWorkspaceData] = useState<any[]>([]);
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [pendingSQL, setPendingSQL] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeTab with URL
  useEffect(() => {
    if (location.pathname.includes("/dashboard/modeling")) {
      setActiveTab("modeling");
      return;
    }

    if (location.pathname.includes("/dashboard/builder")) {
      setActiveTab("dashboards");
      return;
    }

    // Keep current tab on /dashboard to avoid one-click reset bugs (e.g. settings/reports -> connections).
    // Only coerce if we came from a route-backed tab that no longer matches current path.
    if (location.pathname === "/dashboard" && ["modeling", "dashboards"].includes(activeTab)) {
      setActiveTab("connections");
    }
  }, [location.pathname, activeTab, setActiveTab]);

  const handleLogout = async () => {
    localStorage.removeItem("license_key");
    localStorage.removeItem("access_token");
    toast({ title: "Signed out", description: "License session cleared." });
    window.location.href = "/license";
  };

  const handleOpenDangerModal = (sql: string) => {
    setPendingSQL(sql);
    setDangerModalOpen(true);
  };

  const handleReject = () => {
    setDangerModalOpen(false);
    setPendingSQL("");
    toast({
      title: "Query Rejected",
      description: "The operation has been cancelled. No changes were made.",
    });
  };

  const handleConfirm = () => {
    setDangerModalOpen(false);
    setPendingSQL("");
    toast({
      title: "Query Executed",
      description: "3 rows have been updated successfully.",
      variant: "destructive",
    });
  };

  // Check if we are in a nested active route (e.g. /dashboard/modeling)
  const isNestedRoute = location.pathname !== "/dashboard";
  const appVersion = (import.meta as any)?.env?.VITE_APP_VERSION || "0.0.0";

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "dashboards") {
            navigate("/dashboard/builder");
          } else if (tab === "modeling") {
            navigate("/dashboard/modeling");
          } else {
            navigate("/dashboard");
          }
        }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isNestedRoute ? (
          <Outlet />
        ) : (
          <>
            {/* Connections Tab (Mounted but potentially hidden) */}
            <div className={activeTab === "connections" ? "contents" : "hidden"}>
              <ConnectionsView />
            </div>

            {/* Settings Tab */}
            <div className={activeTab === "settings" ? "contents" : "hidden"}>
              <SettingsView />
            </div>

            {/* Other Tabs (Chat/Workspace) */}
            <div className={cn(
              "flex-1 flex flex-col md:flex-row overflow-hidden",
              (activeTab !== "connections" && activeTab !== "settings") ? "flex" : "hidden"
            )}>
              {/* Chat Panel */}
              <div className="flex-1 min-w-0 border-r border-border">
                <ChatPanel
                  onDataUpdate={setActiveWorkspaceData}
                  onOpenDangerModal={handleOpenDangerModal}
                />
              </div>

              {/* Data Workspace */}
              <div className="flex-1 min-w-0">
                <DataWorkspace data={activeWorkspaceData} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dev testing watermark */}
      <div className="pointer-events-none fixed bottom-3 left-3 z-50 rounded border border-primary/25 bg-background/80 px-2 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur-sm">
        DEV TESTING • v{appVersion}
      </div>

      {/* Danger Modal */}
      <DangerModal
        open={dangerModalOpen}
        onClose={() => setDangerModalOpen(false)}
        sql={pendingSQL}
        onReject={handleReject}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
