import { create } from "zustand";
import type { DashboardConfig, DashboardPlan, WidgetConfig } from "@/types/dashboard";

type SetStateAction<T> = T | ((prev: T) => T);

const initialDashboard: DashboardConfig = {
  id: "dashboard-initial",
  title: "New Dashboard",
  widgets: [],
  layout: [],
  isPublic: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface DashboardState {
  dashboard: DashboardConfig;
  currentPlan: DashboardPlan | null;
  isEditing: boolean;

  setDashboard: (dashboard: SetStateAction<DashboardConfig>) => void;
  setCurrentPlan: (plan: SetStateAction<DashboardPlan | null>) => void;
  setIsEditing: (editing: boolean) => void;
  updateWidget: (widgetId: string, updates: Partial<WidgetConfig>) => void;
  addWidget: (widget: WidgetConfig) => void;
  removeWidget: (widgetId: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  dashboard: initialDashboard,
  currentPlan: null,
  isEditing: false,

  setDashboard: (dashboard) =>
    set((state) => ({
      dashboard:
        typeof dashboard === "function"
          ? (dashboard as (prev: DashboardConfig) => DashboardConfig)(state.dashboard)
          : dashboard,
    })),

  setCurrentPlan: (currentPlan) =>
    set((state) => ({
      currentPlan:
        typeof currentPlan === "function"
          ? (currentPlan as (prev: DashboardPlan | null) => DashboardPlan | null)(state.currentPlan)
          : currentPlan,
    })),

  setIsEditing: (isEditing) => set({ isEditing }),

  updateWidget: (widgetId, updates) =>
    set((state) => ({
      dashboard: {
        ...state.dashboard,
        widgets: state.dashboard.widgets.map((w) =>
          w.id === widgetId ? { ...w, ...updates } : w,
        ),
      },
    })),

  addWidget: (widget) =>
    set((state) => ({
      dashboard: {
        ...state.dashboard,
        widgets: [...state.dashboard.widgets, widget],
      },
    })),

  removeWidget: (widgetId) =>
    set((state) => ({
      dashboard: {
        ...state.dashboard,
        widgets: state.dashboard.widgets.filter((w) => w.id !== widgetId),
      },
    })),
}));
