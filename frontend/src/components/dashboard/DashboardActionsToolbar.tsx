import { Icon } from "@/components/Icon";
import { Switch } from "@/components/ui/switch";
import { ExportDropdown } from "./ExportDropdown";
import type { DashboardConfig } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

interface DashboardActionsToolbarProps {
  dashboard: DashboardConfig;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onShare: () => void;
  onAddWidget: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  toolMode: "select" | "pan";
  onToolModeChange: (mode: "select" | "pan") => void;
  fixedLayout: boolean;
  onFixedLayoutChange: (fixed: boolean) => void;
  compactType: "vertical" | null;
  onCompactTypeChange: (type: "vertical" | null) => void;
}

export function DashboardActionsToolbar({
  dashboard,
  isEditMode,
  onToggleEditMode,
  onShare,
  onAddWidget,
  containerRef,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  toolMode,
  onToolModeChange,
  fixedLayout,
  onFixedLayoutChange,
  compactType,
  onCompactTypeChange,
}: DashboardActionsToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 h-12 bg-obsidian-surface-low/80 backdrop-blur-sm z-50 relative border-b border-obsidian-outline-variant/10">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold text-obsidian-on-surface truncate max-w-[200px]">{dashboard.title}</h1>
        <span className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-obsidian-surface-highest text-[10px] font-label text-obsidian-primary rounded">
          <Icon name="widgets" size="sm" className="text-obsidian-primary" />
          {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar">
        {/* Tool Modes */}
        <div className="flex items-center p-0.5 rounded-lg bg-obsidian-surface-mid">
          <Toggle
            size="sm"
            pressed={toolMode === "select"}
            onPressedChange={() => onToolModeChange("select")}
            aria-label="Select Tool"
            className="h-7 w-7 data-[state=on]:bg-obsidian-surface-highest data-[state=on]:text-obsidian-primary rounded"
          >
            <Icon name="arrow_selector_tool" size="sm" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={toolMode === "pan"}
            onPressedChange={() => onToolModeChange("pan")}
            aria-label="Pan Tool"
            className="h-7 w-7 data-[state=on]:bg-obsidian-surface-highest data-[state=on]:text-obsidian-primary rounded"
          >
            <Icon name="pan_tool" size="sm" />
          </Toggle>
        </div>

        {/* Layout Controls */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-obsidian-surface-mid">
          <Toggle
            size="sm"
            pressed={fixedLayout}
            onPressedChange={(pressed) => onFixedLayoutChange(pressed)}
            aria-label="Fixed Layout"
            className="h-7 px-2 gap-1.5 text-xs data-[state=on]:bg-obsidian-surface-highest data-[state=on]:text-obsidian-primary rounded"
          >
            <Icon name="desktop_windows" size="sm" />
            <span className="hidden lg:inline font-label text-[10px] tracking-wider">FIXED</span>
          </Toggle>
          <Toggle
            size="sm"
            pressed={compactType === null}
            onPressedChange={(pressed) => onCompactTypeChange(pressed ? null : "vertical")}
            aria-label="Free Movement"
            className="h-7 px-2 gap-1.5 text-xs data-[state=on]:bg-obsidian-surface-highest data-[state=on]:text-obsidian-primary rounded"
          >
            <Icon name={compactType === null ? "lock_open" : "lock"} size="sm" />
            <span className="hidden lg:inline font-label text-[10px] tracking-wider">FREE</span>
          </Toggle>
        </div>

        {/* Edit Mode Toggle */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-obsidian-surface-mid">
          <Icon name="visibility" size="sm" className={cn(!isEditMode && "text-obsidian-primary")} />
          <Switch
            checked={isEditMode}
            onCheckedChange={onToggleEditMode}
            className="data-[state=checked]:bg-obsidian-primary h-4 w-8"
          />
          <Icon name="edit" size="sm" className={cn(isEditMode && "text-obsidian-primary")} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-1">
          {isEditMode && (
            <button
              onClick={onAddWidget}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-primary-container text-obsidian-surface text-xs font-bold hover:bg-obsidian-primary transition-colors"
            >
              <Icon name="add" size="sm" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}

          <button
            onClick={onShare}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors"
          >
            <Icon name="share" size="sm" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <ExportDropdown dashboard={dashboard} containerRef={containerRef} />
        </div>
      </div>
    </div>
  );
}
