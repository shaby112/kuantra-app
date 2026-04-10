import { useEffect, useRef, useState } from "react";
import { WidgetChart } from "@/components/dashboard/WidgetChart";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

/**
 * Fullscreen view-only dashboard.
 * - No dotted canvas, no editor chrome
 * - Fixed grid layout with min/max boundaries
 * - Browser zoom only (no canvas zoom)
 * - Clean background
 */
export default function DashboardView() {
  const dashboard = useDashboardStore((s) => s.dashboard);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewDashboard, setViewDashboard] = useState(dashboard);

  useEffect(() => {
    if (dashboard.widgets.length > 0) {
      setViewDashboard(dashboard);
      return;
    }

    try {
      const cached = localStorage.getItem("kuantra.fullscreenDashboard");
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.widgets) && Array.isArray(parsed.layout)) {
        setViewDashboard(parsed);
      }
    } catch (e) {
      console.warn("Failed to load fullscreen dashboard cache", e);
    }
  }, [dashboard]);

  // If no widgets, show message
  if (viewDashboard.widgets.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-obsidian-surface">
        <div className="text-center space-y-3">
          <Icon name="dashboard" size="lg" className="text-obsidian-on-surface-variant mx-auto" />
          <p className="text-obsidian-on-surface-variant text-sm">No widgets to display. Build a dashboard first.</p>
        </div>
      </div>
    );
  }

  // Compute grid positions → absolute pixel positions for the fixed layout
  const COL_COUNT = 12;
  const ROW_HEIGHT = 80;
  const GAP = 16;
  const PADDING = 24;

  // Calculate total grid dimensions
  const maxRow = viewDashboard.layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const totalHeight = maxRow * ROW_HEIGHT + (maxRow - 1) * GAP + PADDING * 2;

  return (
    <div className="h-screen w-screen bg-obsidian-surface overflow-auto">
      {/* Minimal top bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-6 h-12 bg-obsidian-surface-low/95 backdrop-blur-sm border-b border-obsidian-outline-variant/10">
        <div className="flex items-center gap-3">
          <Icon name="dashboard" size="sm" className="text-obsidian-primary" />
          <h1 className="text-sm font-bold text-obsidian-on-surface">{viewDashboard.title}</h1>
          <span className="px-2 py-0.5 bg-obsidian-surface-highest text-[10px] font-label text-obsidian-primary rounded">
            {viewDashboard.widgets.length} widget{viewDashboard.widgets.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high transition-colors"
        >
          <Icon name="close" size="sm" />
          Close
        </button>
      </div>

      {/* Dashboard grid */}
      <div
        ref={containerRef}
        className="relative mx-auto"
        style={{
          maxWidth: 1440,
          minWidth: 800,
          padding: PADDING,
          minHeight: totalHeight,
        }}
      >
        {viewDashboard.widgets.map((widget) => {
          const layoutItem = viewDashboard.layout.find((l) => l.i === widget.id);
          if (!layoutItem) return null;

          const colWidth = (100 / COL_COUNT);
          const left = `calc(${layoutItem.x * colWidth}% + ${layoutItem.x > 0 ? GAP / 2 : 0}px)`;
          const width = `calc(${layoutItem.w * colWidth}% - ${GAP}px)`;
          const top = layoutItem.y * (ROW_HEIGHT + GAP);
          const height = layoutItem.h * ROW_HEIGHT + (layoutItem.h - 1) * GAP;

          return (
            <div
              key={widget.id}
              className={cn(
                "absolute rounded-lg overflow-hidden",
                "bg-obsidian-surface-low/70 backdrop-blur-md border border-obsidian-outline-variant/15",
              )}
              style={{
                left: `${(layoutItem.x / COL_COUNT) * 100}%`,
                width: `${(layoutItem.w / COL_COUNT) * 100}%`,
                top,
                height,
                padding: `0 ${GAP / 2}px`,
                boxSizing: "border-box",
              }}
            >
              <div className="h-full w-full flex flex-col">
                {/* Widget title */}
                <div className="px-4 py-2.5 border-b border-obsidian-outline-variant/10 bg-obsidian-surface-mid/40 shrink-0">
                  <h3 className="text-xs font-bold text-obsidian-on-surface truncate">{widget.title}</h3>
                </div>
                {/* Widget content */}
                <div className="flex-1 min-h-0 p-4">
                  <WidgetChart config={widget} isEditMode={false} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
