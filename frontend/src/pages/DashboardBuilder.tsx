import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardChat } from "@/components/dashboard/DashboardChat";
import { EditableDashboard } from "@/components/dashboard/EditableDashboard";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DashboardConfig, DashboardPlan, WidgetConfig, LayoutItem, DashboardOut, ChartType, ColorScheme } from "@/types/dashboard";
import { createWidgetFromPlan, generateDefaultLayout } from "@/lib/dashboard";
import { motion, AnimatePresence } from "framer-motion";
import { ApiError, apiFetch } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useGlobalState } from "@/context/GlobalStateContext";
import { executeSql } from "@/lib/chat";
import { ComponentLibrary } from "@/components/dashboard/ComponentLibrary";
import { saveDashboard } from "@/lib/dashboard";
import { TemplateStore } from "@/components/dashboard/TemplateStore";
import { DashboardHistory } from "@/components/dashboard/DashboardHistory";
import { DashboardSplitView } from "@/components/dashboard/DashboardSplitView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const COLOR_SCHEMES: { id: ColorScheme; name: string; colors: string[] }[] = [
  { id: "default", name: "Default", colors: ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6"] },
  { id: "ocean", name: "Ocean", colors: ["#3b82f6", "#06b6d4", "#14b8a6", "#0ea5e9"] },
  { id: "forest", name: "Forest", colors: ["#10b981", "#22c55e", "#84cc16", "#14b8a6"] },
  { id: "sunset", name: "Sunset", colors: ["#f97316", "#f59e0b", "#eab308", "#ef4444"] },
  { id: "midnight", name: "Midnight", colors: ["#6366f1", "#8b5cf6", "#a855f7", "#3b82f6"] },
  { id: "lavender", name: "Lavender", colors: ["#8b5cf6", "#a855f7", "#d946ef", "#ec4899"] },
  { id: "coral", name: "Coral", colors: ["#f43f5e", "#ec4899", "#ef4444", "#f97316"] },
  { id: "neon", name: "Neon", colors: ["#84cc16", "#06b6d4", "#d946ef", "#facc15"] },
  { id: "earth", name: "Earth", colors: ["#92400e", "#a16207", "#78716c", "#d97706"] },
  { id: "monochrome", name: "Monochrome", colors: ["#475569", "#64748b", "#94a3b8", "#334155"] },
  { id: "pastel", name: "Pastel", colors: ["#7dd3fc", "#f9a8d4", "#bef264", "#fde047"] },
  { id: "vibrant", name: "Vibrant", colors: ["#dc2626", "#2563eb", "#facc15", "#16a34a"] },
  { id: "corporate", name: "Corporate", colors: ["#1d4ed8", "#475569", "#059669", "#d97706"] },
  { id: "tropical", name: "Tropical", colors: ["#14b8a6", "#f97316", "#ec4899", "#84cc16"] },
  { id: "ruby", name: "Ruby", colors: ["#dc2626", "#f43f5e", "#be123c", "#fb7185"] },
  { id: "sapphire", name: "Sapphire", colors: ["#2563eb", "#3b82f6", "#1d4ed8", "#60a5fa"] },
  { id: "emerald", name: "Emerald", colors: ["#059669", "#10b981", "#047857", "#34d399"] },
  { id: "amethyst", name: "Amethyst", colors: ["#7c3aed", "#8b5cf6", "#6d28d9", "#a78bfa"] },
  { id: "gold", name: "Gold", colors: ["#ca8a04", "#eab308", "#a16207", "#fde047"] },
  { id: "slate", name: "Slate", colors: ["#475569", "#64748b", "#334155", "#94a3b8"] },
  { id: "crimson", name: "Crimson", colors: ["#be123c", "#e11d48", "#9f1239", "#fb7185"] },
  { id: "arctic", name: "Arctic", colors: ["#0ea5e9", "#38bdf8", "#0284c7", "#7dd3fc"] },
];

export default function DashboardBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const {
    dashboard,
    setDashboard,
    currentPlan,
    setCurrentPlan,
    sidebarCollapsed,
    setSidebarCollapsed,
    activeTab,
    setActiveTab
  } = useGlobalState();

  useEffect(() => {
    apiFetch<any[]>("/api/v1/connections/", { auth: true })
      .then(data => setConnections(data))
      .catch(() => setConnections([]));
  }, []);

  const handlePlanReady = (plan: DashboardPlan) => {
    setCurrentPlan(plan);
  };

  const handleGenerateDashboard = useCallback(async (connectionIds: string[]) => {
    if (!currentPlan) return;

    toast({ title: "Generating...", description: "Building your dashboard with AI..." });

    try {
      const response = await apiFetch<DashboardOut>("/api/v1/dashboards/generate", {
        method: "POST",
        body: JSON.stringify({ plan: currentPlan, connection_ids: connectionIds }),
        auth: true
      });
      const widgetStatus = Array.isArray(response.widget_status)
        ? response.widget_status
        : [];

      const statusByWidget = new Map(
        widgetStatus.map((s) => [s.widget_id, s]),
      );

      const newWidgets: WidgetConfig[] = response.config.widgets.map(w => {
        const isMetric = ["metric", "kpi", "number", "stat"].includes(w.type);
        const scalarValue = isMetric && w.data?.[0]
          ? w.data[0][Object.keys(w.data[0])[0]]
          : undefined;

        const titleLower = w.title.toLowerCase();
        const isCurrency = titleLower.includes("revenue") || titleLower.includes("value") || titleLower.includes("spend") || titleLower.includes("amount");

        return {
          id: w.id,
          title: w.title,
          chartType: w.type as any,
          data: w.data,
          indexField: w.index,
          categories: w.categories,
          colors: w.colors || ["violet"],
          valueFormat: (w.valueFormatter as any) || "number",
          dateRange: "30d",
          aggregation: "sum",
          connectionId: connectionIds.length > 0 ? connectionIds[0] : undefined,
          errorMessage: statusByWidget.get(w.id)?.error,
          sql_query: (w as any).sql_query || statusByWidget.get(w.id)?.sql,
          value: scalarValue,
          prefix: isCurrency && isMetric ? "$" : undefined,
        };
      });

      const newLayout = response.config.widgets.map(w => ({
        i: w.id,
        x: w.gridPosition.x,
        y: w.gridPosition.y,
        w: w.gridPosition.w,
        h: w.gridPosition.h
      }));

      setDashboard({
        id: response.id.toString(),
        title: response.title,
        widgets: newWidgets,
        layout: newLayout,
        isPublic: false,
        createdAt: response.created_at,
        updatedAt: response.updated_at
      });

      const failed = widgetStatus.filter((w) => w.status === "error");
      if (failed.length > 0) {
        toast({
          title: "Partial dashboard generated",
          description: `${failed.length} widget${failed.length > 1 ? "s" : ""} failed. Open widget cards to inspect errors.`,
          variant: "destructive",
        });
      }

      toast({ title: "Dashboard Ready!", description: `Created ${newWidgets.length} widgets.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Generation failed. Please try again.", variant: "destructive" });
    }
  }, [currentPlan, toast]);

  const handleRefreshWidgetData = useCallback(async (widgetId: string, sql: string) => {
    toast({ title: "Updating...", description: "Executing SQL query..." });
    try {
      const targetWidget = dashboard.widgets.find(w => w.id === widgetId);
      const connId = targetWidget?.connectionId;

      const { results } = await executeSql(sql, connId);
      if (!results || results.length === 0) {
        toast({ title: "No data", description: "Query returned no results." });
      }

      setDashboard((prev: DashboardConfig) => {
        const widgets = prev.widgets.map(w => {
          if (w.id === widgetId) {
            const keys = results.length > 0 ? Object.keys(results[0]) : [];
            const nextCategories = keys.slice(1).length > 0 ? keys.slice(1) : (keys[0] ? [keys[0]] : w.categories);
            const refreshedValue = results.length > 0 && nextCategories?.[0]
              ? results[0][nextCategories[0]]
              : w.value;
            return {
              ...w,
              data: results,
              sql_query: sql,
              value: typeof refreshedValue === 'number' || typeof refreshedValue === 'string' ? refreshedValue : w.value,
              errorMessage: undefined,
              indexField: keys[0] || w.indexField,
              categories: nextCategories
            };
          }
          return w;
        });
        return { ...prev, widgets, updatedAt: new Date().toISOString() };
      });

      toast({ title: "Success", description: "Widget data refreshed." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "SQL Error", description: e.message || "Failed to execute query", variant: "destructive" });
    }
  }, [dashboard.widgets, setDashboard, toast]);

  const handleUpdateDashboard = useCallback(async (updated: DashboardConfig) => {
    setDashboard({ ...updated, updatedAt: new Date().toISOString() });
    if (updated.id && !updated.id.startsWith("dashboard-")) {
      try {
        await saveDashboard(updated);
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }
  }, [setDashboard]);

  const handleColorSchemeChange = (scheme: ColorScheme) => {
    const schemeColors = COLOR_SCHEMES.find(s => s.id === scheme);
    const tremorColors: Record<ColorScheme, string[]> = {
      default: ["rose", "amber", "emerald", "blue", "violet", "cyan"],
      ocean: ["blue", "cyan", "teal", "sky", "indigo", "slate"],
      forest: ["emerald", "green", "lime", "teal", "cyan", "stone"],
      sunset: ["orange", "amber", "yellow", "red", "rose", "pink"],
      midnight: ["indigo", "violet", "purple", "blue", "slate", "zinc"],
      lavender: ["violet", "purple", "fuchsia", "pink", "rose", "slate"],
      coral: ["rose", "pink", "red", "orange", "amber", "stone"],
      neon: ["lime", "cyan", "fuchsia", "yellow", "green", "pink"],
      earth: ["amber", "orange", "stone", "yellow", "rose", "slate"],
      monochrome: ["slate", "gray", "zinc", "neutral", "stone", "slate"],
      pastel: ["sky", "pink", "lime", "amber", "violet", "teal"],
      vibrant: ["red", "blue", "yellow", "green", "purple", "orange"],
      corporate: ["blue", "slate", "emerald", "amber", "indigo", "gray"],
      tropical: ["teal", "orange", "pink", "lime", "cyan", "amber"],
      ruby: ["red", "rose", "pink", "orange", "amber", "rose"],
      sapphire: ["blue", "indigo", "cyan", "sky", "violet", "slate"],
      emerald: ["emerald", "green", "teal", "cyan", "lime", "stone"],
      amethyst: ["violet", "purple", "fuchsia", "pink", "indigo", "slate"],
      gold: ["yellow", "amber", "orange", "lime", "rose", "stone"],
      slate: ["slate", "gray", "zinc", "neutral", "stone", "slate"],
      crimson: ["rose", "red", "pink", "orange", "amber", "slate"],
      arctic: ["sky", "cyan", "blue", "teal", "indigo", "slate"],
    };

    setDashboard(prev => ({
      ...prev,
      colorScheme: scheme,
      widgets: prev.widgets.map((w, i) => ({
        ...w,
        colors: [tremorColors[scheme][i % tremorColors[scheme].length]]
      })),
      updatedAt: new Date().toISOString()
    }));

    toast({ title: "Color scheme applied", description: `Using ${schemeColors?.name} theme` });
  };

  const handleAddWidget = useCallback((type: string = 'chart') => {
    if (type === 'ai') {
      setChatCollapsed(false);
      toast({
        title: "Create with AI",
        description: "Describe the widget you want in the chat on the left.",
        duration: 5000
      });
      return;
    }

    const widgetDefaults: Record<string, Partial<WidgetConfig>> = {
      chart: { chartType: 'area' as ChartType },
      area: { chartType: 'area' as ChartType },
      line: { chartType: 'line' as ChartType },
      bar: { chartType: 'bar' as ChartType },
      donut: { chartType: 'donut' as ChartType },
      quickStats: { chartType: 'quickStats' as ChartType },
      funnel: {
        chartType: 'funnel' as ChartType, funnelStages: [
          { name: "Visitors", value: 10000 },
          { name: "Leads", value: 5000 },
          { name: "Customers", value: 1000 },
        ]
      },
      heatmap: { chartType: 'heatmap' as ChartType },
      radar: { chartType: 'radar' as ChartType },
      metric: { chartType: 'metric' as ChartType, value: 12500, trend: 12.5, prefix: '$' },
      kpi: { chartType: 'kpi' as ChartType, value: 8547, trend: -3.2 },
      number: { chartType: 'number' as ChartType, value: 42000, prefix: '$' },
      stat: { chartType: 'stat' as ChartType, value: 2847, trend: 8.2, icon: 'users' },
      comparison: { chartType: 'comparison' as ChartType, value: 15000, comparisonValue: 12000, comparisonLabel: 'Last Month' },
      progress: { chartType: 'progress' as ChartType, value: 75, target: 100 },
      progressRing: { chartType: 'progressRing' as ChartType, value: 65, target: 100, title: 'Weekly Goal' },
      gauge: { chartType: 'gauge' as ChartType, value: 72, target: 100 },
      sparkline: { chartType: 'sparkline' as ChartType, sparklineData: [10, 25, 15, 30, 45, 35, 50] },
      activityFeed: { chartType: 'activityFeed' as ChartType },
      table: { chartType: 'table' as ChartType },
      leaderboard: {
        chartType: 'leaderboard' as ChartType, listItems: [
          { label: "John Doe", value: 12500, trend: 12 },
          { label: "Jane Smith", value: 10200, trend: -3 },
          { label: "Bob Johnson", value: 9800, trend: 8 },
        ]
      },
      list: {
        chartType: 'list' as ChartType, listItems: [
          { label: "Item 1", value: "Value 1" },
          { label: "Item 2", value: "Value 2" },
          { label: "Item 3", value: "Value 3" },
        ]
      },
      ticker: {
        chartType: 'ticker' as ChartType, listItems: [
          { label: "AAPL", value: 185.92, trend: 2.3 },
          { label: "GOOGL", value: 141.80, trend: -0.5 },
        ]
      },
      calendar: { chartType: 'calendar' as ChartType },
      container: { chartType: 'container' as ChartType, showBorder: true, showBackground: false, textContent: "Container" },
      map: {
        chartType: 'map' as ChartType, mapData: [
          { region: "New York", value: 5000, lat: 40.7128, lng: -74.0060 },
          { region: "Los Angeles", value: 3500, lat: 34.0522, lng: -118.2437 },
        ]
      },
      colorBlock: { chartType: 'colorBlock' as ChartType, backgroundColor: "hsl(var(--primary) / 0.2)" },
      divider: { chartType: 'divider' as ChartType },
      header: { chartType: 'header' as ChartType, textContent: 'Section Title', headerLevel: 2 },
      text: { chartType: 'text' as ChartType, textContent: 'Add your notes or descriptions here...' },
      image: { chartType: 'image' as ChartType, imageUrl: '' },
      button: { chartType: 'button' as ChartType, buttonLabel: 'Click Me', buttonVariant: 'primary' },
      stopwatch: { chartType: 'stopwatch' as ChartType },
      countdown: { chartType: 'countdown' as ChartType, countdownTarget: new Date(Date.now() + 86400000 * 7).toISOString() },
      timeline: {
        chartType: 'timeline' as ChartType, timelineEvents: [
          { date: "2024-01-15", title: "Project Started" },
          { date: "2024-02-01", title: "Phase 1 Complete" },
        ]
      },
    };

    const defaults = widgetDefaults[type] || widgetDefaults.chart;

    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}`,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      chartType: defaults.chartType || 'area',
      data: [
        { name: 'Jan', value: 400 }, { name: 'Feb', value: 300 }, { name: 'Mar', value: 500 }
      ],
      indexField: "name",
      categories: ["value"],
      colors: ["rose"],
      valueFormat: "number",
      dateRange: "30d",
      aggregation: "sum",
      ...defaults
    };

    const smallWidgets = ['metric', 'sparkline', 'gauge', 'stat', 'number', 'button', 'countdown', 'stopwatch', 'progressRing'];
    const mediumWidgets = ['progress', 'comparison', 'kpi', 'text', 'header', 'divider', 'quickStats', 'activityFeed'];
    const wideWidgets = ['ticker', 'timeline', 'leaderboard', 'map'];

    let width = 6;
    let height = 4;

    if (smallWidgets.includes(type)) {
      width = 3;
      height = 2;
    } else if (mediumWidgets.includes(type)) {
      width = 4;
      height = 2;
    } else if (wideWidgets.includes(type)) {
      width = 6;
      height = 3;
    } else if (type === 'colorBlock' || type === 'container') {
      width = 2;
      height = 2;
    }

    // Find a free spot: scan rows from top to find an open position
    const occupied = new Set<string>();
    for (const item of dashboard.layout) {
      for (let gx = item.x; gx < item.x + item.w; gx++) {
        for (let gy = item.y; gy < item.y + item.h; gy++) {
          occupied.add(`${gx},${gy}`);
        }
      }
    }

    let placeX = 0;
    let placeY = 0;
    let found = false;
    for (let row = 0; row < 100 && !found; row++) {
      for (let col = 0; col <= 12 - width && !found; col++) {
        let fits = true;
        for (let dx = 0; dx < width && fits; dx++) {
          for (let dy = 0; dy < height && fits; dy++) {
            if (occupied.has(`${col + dx},${row + dy}`)) {
              fits = false;
            }
          }
        }
        if (fits) {
          placeX = col;
          placeY = row;
          found = true;
        }
      }
    }

    const newLayoutItem: LayoutItem = {
      i: newWidget.id,
      x: placeX,
      y: placeY,
      w: width,
      h: height,
      minW: 2,
      minH: 2,
    };

    setDashboard(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
      layout: [...prev.layout, newLayoutItem],
      updatedAt: new Date().toISOString(),
    }));

    toast({ title: "Widget added", description: "Drag to position it" });
  }, [toast, dashboard.layout, setDashboard]);

  const handleLoadTemplate = (config: DashboardConfig) => {
    setDashboard({
      ...config,
      id: `dashboard-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowTemplates(false);
    toast({ title: "Template loaded", description: `${config.title} is ready to customize` });
  };

  const handleLoadDashboard = (config: DashboardConfig) => {
    setDashboard(config);
    setShowHistory(false);
    toast({ title: "Dashboard loaded", description: config.title });
  };

  const handleOpenSaveModal = () => {
    setSaveTitle(dashboard.title || "New Dashboard");
    setSaveDate(new Date().toISOString().slice(0, 10));
    setShowSaveModal(true);
  };

  const handleSaveDashboard = async () => {
    try {
      const updated: DashboardConfig = {
        ...dashboard,
        title: saveTitle.trim() || dashboard.title || "New Dashboard",
        updatedAt: new Date(`${saveDate}T00:00:00.000Z`).toISOString(),
      };
      const saved = await saveDashboard(updated);
      setDashboard({
        ...updated,
        id: saved.id.toString(),
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      });
      setShowSaveModal(false);
      toast({ title: "Dashboard saved", description: `Saved as \"${updated.title}\"` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to save dashboard", variant: "destructive" });
    }
  };

  const handleCreateDemoDashboard = useCallback(async () => {
    toast({ title: "Building NovaMart dashboard...", description: "Querying live data..." });

    try {
      const response = await apiFetch<DashboardOut>("/api/v1/dashboards/demo/novamart", {
        method: "POST",
        auth: true
      });

      const widgetStatus = Array.isArray(response.widget_status) ? response.widget_status : [];
      const statusByWidget = new Map(widgetStatus.map((s) => [s.widget_id, s]));

      const newWidgets: WidgetConfig[] = response.config.widgets.map(w => {
        const isMetric = ["metric", "kpi", "number", "stat"].includes(w.type);
        const scalarValue = isMetric && w.data?.[0]
          ? w.data[0][Object.keys(w.data[0])[0]]
          : undefined;

        // Detect currency widgets from title
        const titleLower = w.title.toLowerCase();
        const isCurrency = titleLower.includes("revenue") || titleLower.includes("value") || titleLower.includes("spend");

        return {
          id: w.id,
          title: w.title,
          chartType: w.type as ChartType,
          data: w.data,
          indexField: w.index,
          categories: w.categories,
          colors: w.colors || ["violet"],
          valueFormat: (w.valueFormatter as any) || "number",
          dateRange: "30d",
          aggregation: "sum",
          errorMessage: statusByWidget.get(w.id)?.error,
          sql_query: (w as any).sql_query || statusByWidget.get(w.id)?.sql,
          value: scalarValue,
          prefix: isCurrency && isMetric ? "$" : undefined,
        };
      });

      const newLayout: LayoutItem[] = response.config.widgets.map(w => ({
        i: w.id,
        x: w.gridPosition.x,
        y: w.gridPosition.y,
        w: w.gridPosition.w,
        h: w.gridPosition.h,
      }));

      setDashboard({
        id: response.id.toString(),
        title: response.title,
        widgets: newWidgets,
        layout: newLayout,
        isPublic: false,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      });

      const failed = widgetStatus.filter((w) => w.status === "error");
      if (failed.length > 0) {
        toast({
          title: "Partial dashboard",
          description: `${failed.length} widget(s) had errors. Open widget cards to inspect.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "NovaMart Command Center ready!", description: `${newWidgets.length} widgets loaded with live data.` });
      }
    } catch (e) {
      console.error(e);
      let message = "Make sure NovaMart data is synced.";
      if (e instanceof ApiError) {
        message = typeof e.detail === "string" ? e.detail : e.message;
      }
      toast({ title: "Demo generation failed", description: message, variant: "destructive" });
    }
  }, [setDashboard, toast]);

  const hasWidgets = dashboard.widgets.length > 0;

  return (
    <ErrorBoundary>
      <div className="flex flex-1 h-full w-full overflow-hidden bg-obsidian-surface font-body">
        {/* Main Content — sidebar is rendered by parent Dashboard.tsx */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left: Chat Panel (Collapsible) */}
          <AnimatePresence initial={false}>
            {!chatCollapsed && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: sidebarCollapsed ? 340 : 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="z-20 bg-obsidian-surface overflow-hidden flex flex-col"
              >
                <DashboardChat
                  currentPlan={currentPlan}
                  onPlanReady={handlePlanReady}
                  onGenerateDashboard={handleGenerateDashboard}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right: Dashboard Preview (Canvas) */}
          <motion.div
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "flex-1 flex overflow-hidden relative bg-obsidian-surface transition-[padding] duration-300",
              libraryCollapsed ? "pr-14" : "pr-[280px]"
            )}
          >
            {/* Chat Toggle Button */}
            <button
              onClick={() => setChatCollapsed(!chatCollapsed)}
              className={cn(
                "absolute left-4 z-40 h-8 w-8 rounded-lg bg-obsidian-surface-mid/90 backdrop-blur-sm flex items-center justify-center hover:bg-obsidian-surface-high transition-all duration-200 border border-obsidian-outline-variant/10",
                hasWidgets ? "top-16" : "top-4"
              )}
            >
              <Icon name={chatCollapsed ? "left_panel_open" : "left_panel_close"} size="sm" className="text-obsidian-on-surface-variant" />
            </button>

            {dashboard.widgets.length === 0 ? (
              <DashboardSplitView />
            ) : (
              <EditableDashboard
                dashboard={dashboard}
                onUpdate={handleUpdateDashboard}
                onAddWidget={() => handleAddWidget()}
                onSaveDashboard={handleOpenSaveModal}
                onCreateDemoDashboard={handleCreateDemoDashboard}
                onRefreshWidget={handleRefreshWidgetData}
              />
            )}

            <div className="absolute right-0 top-0 bottom-0 z-40 pointer-events-auto">
              <ComponentLibrary
                collapsed={libraryCollapsed}
                onToggle={() => setLibraryCollapsed(!libraryCollapsed)}
                onAddWidget={handleAddWidget}
                onShowTemplates={() => setShowTemplates(true)}
                onShowHistory={() => setShowHistory(true)}
                onShowColors={() => setShowColorPicker(true)}
              />
            </div>

            {/* Save Dashboard Modal */}
            <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
              <DialogContent className="max-w-md bg-obsidian-surface-mid border-obsidian-outline-variant/20">
                <DialogHeader>
                  <DialogTitle className="text-obsidian-on-surface">Save Dashboard</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-obsidian-on-surface">Dashboard name</Label>
                    <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Q2 Revenue Command Center" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-obsidian-on-surface">Save date</Label>
                    <Input type="date" value={saveDate} onChange={(e) => setSaveDate(e.target.value)} />
                  </div>
                  <p className="text-xs text-obsidian-on-surface-variant">Created and updated timestamps are persisted with this save.</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowSaveModal(false)}>Cancel</Button>
                    <Button onClick={handleSaveDashboard}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Color Scheme Modal */}
            <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
              <DialogContent className="max-w-xs bg-obsidian-surface-mid border-obsidian-outline-variant/20">
                <DialogHeader>
                  <DialogTitle className="text-obsidian-on-surface">Color Schemes</DialogTitle>
                </DialogHeader>
                <div className="grid gap-1.5 py-4 max-h-[400px] overflow-y-auto scrollbar-thin">
                  {COLOR_SCHEMES.map((scheme) => (
                    <button
                      key={scheme.id}
                      className="w-full flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-obsidian-surface-high transition-colors text-left"
                      onClick={() => {
                        handleColorSchemeChange(scheme.id);
                        setShowColorPicker(false);
                      }}
                    >
                      <div className="flex gap-1">
                        {scheme.colors.map((color, i) => (
                          <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-obsidian-on-surface">{scheme.name}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>

        {/* Template Store Modal */}
        <TemplateStore
          open={showTemplates}
          onOpenChange={setShowTemplates}
          onSelectTemplate={handleLoadTemplate}
        />

        {/* Dashboard History Modal */}
        <DashboardHistory
          open={showHistory}
          onOpenChange={setShowHistory}
          onSelectDashboard={handleLoadDashboard}
          onCreateDemoDashboard={handleCreateDemoDashboard}
          currentDashboard={dashboard}
        />
      </div>
    </ErrorBoundary>
  );
}
