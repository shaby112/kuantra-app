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
import { Icon } from "@/components/Icon";
import DashboardBuilder from "./DashboardBuilder";

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

  useEffect(() => {
    if (location.pathname.includes("/dashboard/modeling")) {
      setActiveTab("modeling");
      return;
    }
    // Don't reset tab based on URL for builder — we manage it inline now
    if (location.pathname === "/dashboard" && activeTab === "modeling") {
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

  const isModelingRoute = location.pathname.includes("/dashboard/modeling");
  const appVersion = (import.meta as any)?.env?.VITE_APP_VERSION || "0.0.0";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-obsidian-surface">
      {/* Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "modeling") {
            navigate("/dashboard/modeling");
          } else {
            // Stay on /dashboard for everything — builder is inline
            if (location.pathname !== "/dashboard") {
              navigate("/dashboard");
            }
          }
        }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header Bar */}
        <header className="flex justify-between items-center w-full px-6 h-14 border-b border-obsidian-outline-variant/15 bg-obsidian-surface shrink-0">
          <div className="flex items-center gap-8">
            <div className="relative flex items-center bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 px-3 py-1.5 rounded-lg">
              <Icon name="search" className="text-zinc-500" size="sm" />
              <input
                className="bg-transparent border-none text-xs focus:ring-0 focus:outline-none text-obsidian-on-surface placeholder:text-zinc-600 w-48 ml-2"
                placeholder="Search insights..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-zinc-400 hover:text-primary transition-colors">
              <Icon name="notifications" />
            </button>
            <button className="text-zinc-400 hover:text-primary transition-colors">
              <Icon name="help_outline" />
            </button>
            <div className="h-8 w-8 rounded-full bg-obsidian-surface-highest overflow-hidden border border-obsidian-outline-variant/30 flex items-center justify-center">
              <Icon name="person" className="text-zinc-500" size="sm" />
            </div>
          </div>
        </header>

        {/* Modeling route — uses Outlet */}
        {isModelingRoute && <Outlet />}

        {/* Dashboard Builder — always mounted, hidden when not active */}
        <div className={cn(
          "flex-1 overflow-hidden",
          activeTab === "dashboards" && !isModelingRoute ? "flex" : "hidden"
        )}>
          <DashboardBuilder />
        </div>

        {/* Connections Tab */}
        <div className={cn(
          "flex-1 overflow-hidden",
          activeTab === "connections" && !isModelingRoute ? "contents" : "hidden"
        )}>
          <ConnectionsView />
        </div>

        {/* Settings Tab */}
        <div className={cn(
          "flex-1 overflow-hidden",
          activeTab === "settings" && !isModelingRoute ? "contents" : "hidden"
        )}>
          <SettingsView />
        </div>

        {/* AI Assistant / Chat Tab */}
        <div className={cn(
          "flex-1 flex flex-col md:flex-row overflow-hidden",
          activeTab === "history" && !isModelingRoute ? "flex" : "hidden"
        )}>
          <div className="flex-1 min-w-0 border-r border-obsidian-outline-variant/10">
            <ChatPanel
              onDataUpdate={setActiveWorkspaceData}
              onOpenDangerModal={handleOpenDangerModal}
            />
          </div>
          <div className="flex-1 min-w-0">
            <DataWorkspace data={activeWorkspaceData} />
          </div>
        </div>
      </div>

      {/* Dev watermark */}
      <div className="pointer-events-none fixed bottom-3 left-3 z-50 rounded border border-primary/25 bg-obsidian-surface/80 px-2 py-1 text-[11px] font-label text-zinc-500 backdrop-blur-sm">
        DEV TESTING v{appVersion}
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
