import type { ReactNode } from "react";
import type { DashboardConfig, DashboardPlan } from "@/types/dashboard";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useDashboardStore } from "@/stores/dashboard-store";

type SetStateAction<T> = T | ((prev: T) => T);

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  isDangerous?: boolean;
};

interface GlobalState {
  chatMessages: Message[];
  setChatMessages: (messages: SetStateAction<Message[]>) => void;
  currentConversationId: string | null;
  setCurrentConversationId: (id: SetStateAction<string | null>) => void;
  dashboard: DashboardConfig;
  setDashboard: (dashboard: SetStateAction<DashboardConfig>) => void;
  currentPlan: DashboardPlan | null;
  setCurrentPlan: (plan: SetStateAction<DashboardPlan | null>) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

// Compatibility no-op provider (state is now backed by Zustand stores).
export function GlobalStateProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useGlobalState(): GlobalState {
  const chatMessages = useChatStore((s) => s.messages as Message[]);
  const setChatMessages = useChatStore((s) => s.setMessages);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const setCurrentConversationId = useChatStore((s) => s.setCurrentConversationId);

  const dashboard = useDashboardStore((s) => s.dashboard);
  const setDashboard = useDashboardStore((s) => s.setDashboard);
  const currentPlan = useDashboardStore((s) => s.currentPlan);
  const setCurrentPlan = useDashboardStore((s) => s.setCurrentPlan);

  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  return {
    chatMessages,
    setChatMessages,
    currentConversationId,
    setCurrentConversationId,
    dashboard,
    setDashboard,
    currentPlan,
    setCurrentPlan,
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
  };
}
