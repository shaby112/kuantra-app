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
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { apiFetch } from "@/lib/api";
import { Slider } from "@/components/ui/slider";

interface EditableDashboardProps {
  dashboard: DashboardConfig;
  onUpdate: (dashboard: DashboardConfig) => void;
  onAddWidget: () => void;
  onRefreshWidget?: (widgetId: string, sql: string) => void;
}

export function EditableDashboard({ dashboard, onUpdate, onAddWidget, onRefreshWidget }: EditableDashboardProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isEditMode, setIsEditMode] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetConfig | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const [fixedLayout, setFixedLayout] = useState(false);
  const [compactType, setCompactType] = useState<"vertical" | null>("vertical");
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (toolMode === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [toolMode, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && toolMode === "pan") {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, toolMode, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    apiFetch<any[]>("/api/v1/connections/", { auth: true })
      .then(data => setConnections(data))
      .catch(err => console.error("Failed to fetch connections", err));
  }, []);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.3));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = -e.deltaY * 0.01;
        setZoomLevel(prev => {
          const newZoom = Math.min(Math.max(prev + delta, 0.3), 2);
          return Math.round(newZoom * 100) / 100;
        });
      }
    };

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureChange = (e: any) => {
      e.preventDefault();
      const scale = e.scale;
      setZoomLevel(prev => {
        const newZoom = Math.min(Math.max(prev * scale, 0.3), 2);
        return Math.round(newZoom * 100) / 100;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart, { passive: false });
    container.addEventListener('gesturechange', handleGestureChange, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialZoom = zoomLevel;

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistance = getDistance(e.touches);
        initialZoom = zoomLevel;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance;
        const newZoom = Math.min(Math.max(initialZoom * scale, 0.3), 2);
        setZoomLevel(Math.round(newZoom * 100) / 100);
      }
    };

    const handleTouchEnd = () => {
      initialDistance = 0;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomLevel]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setIsEditMode(prev => !prev);
        toast({ title: isEditMode ? "View Mode" : "Edit Mode" });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, toast, isPanning]);

  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    if (toolMode === "pan") return;

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
  }, [dashboard, onUpdate, toolMode]);

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
    if (toolMode === "pan") return;
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

  const dotSize = Math.max(1, 1.5 / zoomLevel);
  const dotSpacing = 24 * zoomLevel;
  const gridWidth = fixedLayout ? 1920 : Math.max(600, (containerWidth - 32) / zoomLevel);

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
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onShare={() => setShareModalOpen(true)}
        onAddWidget={onAddWidget}
        containerRef={containerRef}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        toolMode={toolMode}
        onToolModeChange={setToolMode}
        fixedLayout={fixedLayout}
        onFixedLayoutChange={setFixedLayout}
        compactType={compactType}
        onCompactTypeChange={setCompactType}
      />

      {/* Zoom Controls */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 p-2 bg-obsidian-surface-mid/95 backdrop-blur-md rounded-lg border border-obsidian-outline-variant/10">
        <button
          className="h-7 w-7 rounded flex items-center justify-center text-obsidian-on-surface-variant hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors disabled:opacity-30"
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.3}
        >
          <Icon name="zoom_out" size="sm" />
        </button>
        <div className="w-20">
          <Slider
            value={[zoomLevel * 100]}
            min={30}
            max={200}
            step={5}
            onValueChange={([value]) => setZoomLevel(value / 100)}
          />
        </div>
        <span className="font-label text-[10px] font-bold w-10 text-center text-obsidian-on-surface-variant">{Math.round(zoomLevel * 100)}%</span>
        <button
          className="h-7 w-7 rounded flex items-center justify-center text-obsidian-on-surface-variant hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors disabled:opacity-30"
          onClick={handleZoomIn}
          disabled={zoomLevel >= 2}
        >
          <Icon name="zoom_in" size="sm" />
        </button>
        <div className="w-px h-5 bg-obsidian-outline-variant/20 mx-0.5" />
        <button
          className="h-7 w-7 rounded flex items-center justify-center text-obsidian-on-surface-variant hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors"
          onClick={handleResetZoom}
          title="Reset zoom (Ctrl+0)"
        >
          <Icon name="restart_alt" size="sm" />
        </button>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-hidden p-4 bg-obsidian-surface/50 scrollbar-thin relative",
          toolMode === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        style={{
          backgroundImage: `radial-gradient(circle, rgba(133,148,139,0.2) ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: "top left",
            width: fixedLayout ? 1920 : `${100 / zoomLevel}%`,
            minHeight: "100%",
            transition: isPanning ? "none" : "transform 0.1s ease-out"
          }}
          className="transition-transform duration-100 ease-out"
        >
          <div className={cn("transition-opacity duration-200", isPanning && "pointer-events-none")}>
            <GridLayout
              className="layout"
              layout={dashboard.layout}
              cols={12}
              rowHeight={80}
              width={gridWidth}
              onLayoutChange={handleLayoutChange}
              isDraggable={isEditMode && toolMode === "select"}
              isResizable={isEditMode && toolMode === "select"}
              draggableHandle=".drag-handle"
              compactType={compactType}
              preventCollision={compactType === null}
              margin={[16, 16]}
            >
              {dashboard.widgets.map((widget) => (
                <div key={widget.id} className="overflow-hidden">
                  <WidgetCard
                    config={widget}
                    isEditMode={isEditMode && toolMode === "select"}
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
        </div>
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
