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
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Plus, ZoomIn, ZoomOut, RotateCcw, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Handle Pan Tool Mouse Events
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

  // Stop panning if mouse leaves window/container
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Fetch connections for data source selection
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

  // ... (Zoom gesture logic - keep existing) ...
  // Handle trackpad/mouse wheel zoom with pinch gesture support
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if it's a pinch gesture (ctrlKey is true for trackpad pinch on macOS)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // deltaY is negative when zooming in, positive when zooming out
        const delta = -e.deltaY * 0.01;
        setZoomLevel(prev => {
          const newZoom = Math.min(Math.max(prev + delta, 0.3), 2);
          return Math.round(newZoom * 100) / 100; // Round to 2 decimal places
        });
      }
    };

    // Use both wheel and gesturechange for better cross-browser support
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

  // Handle touch zoom for mobile
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

  // Measure container width
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setIsEditMode(prev => !prev);
        toast({ title: isEditMode ? "View Mode" : "Edit Mode" });
      }
      // Zoom shortcuts
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
      // Pan tool shortcut (Spacebar or H)
      if (e.code === "Space" && !isPanning) {
        // Spacebar for temporary pan could be implemented, but simple H for toggle is safer for now
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, toast, isPanning]);

  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    // Only update if we are allowed to (not panning)
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
    // Prevent opening settings if panning
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

  // Calculate dynamic dot size based on zoom
  const dotSize = Math.max(1, 1.5 / zoomLevel);
  const dotSpacing = 24 * zoomLevel;

  // Calculate Grid Width
  // If fixedLayout is true, use a large fixed width (e.g. 1920px) scaled by zoom
  // If false, use responsive container width (guarded > 0)
  const gridWidth = fixedLayout ? 1920 : Math.max(600, (containerWidth - 32) / zoomLevel);

  // Empty state
  if (dashboard.widgets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/50">
        {/* ... (keep existing empty state) ... */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-md p-8"
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <LayoutDashboard className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Your dashboard will appear here</h3>
            <p className="text-muted-foreground">
              Use the AI assistant on the left to describe what kind of dashboard you want to create, then click "Generate Dashboard".
            </p>
          </div>
          <Button onClick={onAddWidget} className="gap-2">
            <Plus className="w-4 h-4" />
            Add First Widget
          </Button>
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

      {/* Zoom Controls - Fixed bottom-left */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 p-2 bg-background/95 backdrop-blur-md border border-border/50 rounded-xl shadow-lg">
        {/* ... (zoom controls stay same) ... */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.3}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="w-24">
          <Slider
            value={[zoomLevel * 100]}
            min={30}
            max={200}
            step={5}
            onValueChange={([value]) => setZoomLevel(value / 100)}
          />
        </div>
        <span className="text-xs font-medium w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          disabled={zoomLevel >= 2}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleResetZoom}
          title="Reset zoom (Ctrl+0)"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-hidden p-4 bg-background/30 scrollbar-thin scrollbar-thumb-primary/20 relative",
          toolMode === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        style={{
          // Dynamic dot pattern that scales with zoom
          backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.3) ${dotSize}px, transparent ${dotSize}px)`,
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
            width: fixedLayout ? 1920 : `${100 / zoomLevel}%`, // Fixed width or relative to zoom
            minHeight: "100%",
            transition: isPanning ? "none" : "transform 0.1s ease-out"
          }}
          className="transition-transform duration-100 ease-out"
        >
          {/* Layout Grid */}
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
              preventCollision={compactType === null} // Prevent overlap if free movement
              margin={[16, 16]}
            >
              {dashboard.widgets.map((widget) => (
                <div key={widget.id} className="overflow-hidden">
                  <WidgetCard
                    config={widget}
                    isEditMode={isEditMode && toolMode === "select"} // Disable editing interactions in pan mode
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
