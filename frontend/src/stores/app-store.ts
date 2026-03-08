import { create } from "zustand";

type ActiveTab =
  | "history"
  | "connections"
  | "modeling"
  | "dashboards"
  | "reports"
  | "settings";

interface AppState {
  activeTab: ActiveTab;
  sidebarCollapsed: boolean;

  setActiveTab: (tab: ActiveTab) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "connections",
  sidebarCollapsed: false,

  setActiveTab: (activeTab) => set({ activeTab }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
