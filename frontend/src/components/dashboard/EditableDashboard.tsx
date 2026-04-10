import { useState, useRef, useCallback, useEffect } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WidgetCard } from "./WidgetCard";
import { WidgetSettingsModal } from "./WidgetSettingsModal";
import { ShareModal } from "./ShareModal";
import { DashboardActionsToolbar } from "./DashboardActionsToolbar";
import type { DashboardConfig, WidgetConfig, LayoutItem } from "@/types/dashboard";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api";

interface EditableDashboardProps {
  dashboard: DashboardConfig;
  onUpdate: (dashboard: DashboardConfig) => void;
  onAddWidget: () => void;
  onSaveDashboard: () => void;
  onCreateDemoDashboard: () => void;
  onRefreshWidget?: (widgetId: string, sql: string) => void;
}

export function EditableDashboard({ dashboard, onUpdate, onAddWidget, onSaveDashboard, onCreateDemoDashboard, onRefreshWidget }: EditableDashboardProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetConfig | null>(null);
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    apiFetch<any[]>("/api/v1/connections/", { auth: true })
      .then(data => setConnections(data))
      .catch(err => console.error("Failed to fetch connections", err));
  }, []);

  // --- Resize observer for container width ---
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Fullscreen in new tab ---
  const handleFullscreen = useCallback(() => {
    try {
      localStorage.setItem("kuantra.fullscreenDashboard", JSON.stringify(dashboard));
    } catch (e) {
      console.warn("Failed to cache dashboard for fullscreen", e);
    }
    window.open('/dashboard/view', '_blank');
  }, [dashboard]);

  // --- Layout change ---
  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    const updatedLayout: LayoutItem[] = newLayout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
    }));
    onUpdate({ ...dashboard, layout: updatedLayout });
  }, [dashboard, onUpdate]);

  const handleDeleteWidget = (widgetId: string) => {
    const confirmed = window.confirm("Delete this widget?");
    if (!confirmed) return;
    onUpdate({
      ...dashboard,
      widgets: dashboard.widgets.filter(w => w.id !== widgetId),
      layout: dashboard.layout.filter(l => l.i !== widgetId),
    });
    toast({ title: "Widget deleted" });
  };

  const handleOpenSettings = (widget: WidgetConfig) => {
    setSelectedWidget(widget);
    setSettingsModalOpen(true);
  };

  const handleSaveSettings = (updates: Partial<WidgetConfig>) => {
    if (!selectedWidget) return;
    onUpdate({
      ...dashboard,
      widgets: dashboard.widgets.map(w =>
        w.id === selectedWidget.id ? { ...w, ...updates } : w
      ),
    });
    toast({ title: "Widget updated" });
  };

  const handleTogglePublic = (isPublic: boolean) => {
    onUpdate({ ...dashboard, isPublic });
    toast({ title: isPublic ? "Dashboard is now public" : "Dashboard is now private" });
  };

  const gridWidth = Math.max(600, containerWidth - 32);

  if (dashboard.widgets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-obsidian-surface">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-md p-8"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-obsidian-surface-mid border border-obsidian-outline-variant/15">
            <Icon name="dashboard_customize" size="lg" className="text-obsidian-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-obsidian-on-surface">Your dashboard will appear here</h3>
            <p className="text-sm text-obsidian-on-surface-variant">
              Use the AI assistant on the left to describe what kind of dashboard you want to create, then click "Generate Dashboard".
            </p>
          </div>
          <button
            onClick={onAddWidget}
            className="flex items-center gap-2 h-10 px-5 rounded-lg bg-obsidian-primary-container text-obsidian-surface font-bold text-sm hover:bg-obsidian-primary transition-colors"
          >
            <Icon name="add" size="sm" />
            Add First Widget
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DashboardActionsToolbar
        dashboard={dashboard}
        onShare={() => setShareModalOpen(true)}
        onAddWidget={onAddWidget}
        onSave={onSaveDashboard}
        onCreateDemo={onCreateDemoDashboard}
        onFullscreen={handleFullscreen}
        containerRef={containerRef}
      />

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-obsidian-surface scrollbar-thin"
      >
        <GridLayout
          className="layout"
          layout={dashboard.layout}
          cols={12}
          rowHeight={80}
          width={gridWidth}
          onLayoutChange={handleLayoutChange}
          isDraggable={true}
          isResizable={true}
          draggableHandle=".drag-handle"
          compactType={null}
          preventCollision={true}
          margin={[12, 12]}
        >
          {dashboard.widgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              <WidgetCard
                config={widget}
                isEditMode={true}
                onSettings={() => handleOpenSettings(widget)}
                onDelete={() => handleDeleteWidget(widget.id)}
                onUpdate={(updates) => {
                  onUpdate({
                    ...dashboard,
                    widgets: dashboard.widgets.map((w) =>
                      w.id === widget.id ? { ...w, ...updates } : w
                    ),
                  });
                }}
                onExecuteQuery={(sql) => onRefreshWidget?.(widget.id, sql)}
              />
            </div>
          ))}
        </GridLayout>
      </div>

      <WidgetSettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        widget={selectedWidget}
        onSave={handleSaveSettings}
        connections={connections}
      />

      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        dashboardId={dashboard.id}
        dashboardTitle={dashboard.title}
        isPublic={dashboard.isPublic}
        onTogglePublic={handleTogglePublic}
      />
    </div>
  );
}
