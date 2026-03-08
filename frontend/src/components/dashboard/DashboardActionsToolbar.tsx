import {
  Edit, Eye, Share2, Plus, Search,
  Hand, MousePointer2, Monitor, Lock, Unlock, Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ExportDropdown } from "./ExportDropdown";
import type { DashboardConfig } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
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
  // New props for layout stability
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
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm z-50 relative">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold truncate max-w-[200px]">{dashboard.title}</h1>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
          <Layout className="w-3 h-3" />
          <span>{dashboard.widgets.length} widgets</span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar">
        {/* Tool Modes */}
        <div className="flex items-center p-1 rounded-lg bg-muted/50 border border-border">
          <Toggle
            size="sm"
            pressed={toolMode === "select"}
            onPressedChange={() => onToolModeChange("select")}
            aria-label="Select Tool"
            className="h-7 w-7 data-[state=on]:bg-background data-[state=on]:text-primary"
          >
            <MousePointer2 className="w-4 h-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={toolMode === "pan"}
            onPressedChange={() => onToolModeChange("pan")}
            aria-label="Pan Tool"
            className="h-7 w-7 data-[state=on]:bg-background data-[state=on]:text-primary"
          >
            <Hand className="w-4 h-4" />
          </Toggle>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Layout Controls */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
          <Toggle
            size="sm"
            pressed={fixedLayout}
            onPressedChange={(pressed) => onFixedLayoutChange(pressed)}
            aria-label="Fixed Layout"
            className="h-7 px-2 gap-2 text-xs data-[state=on]:bg-background data-[state=on]:text-primary"
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden lg:inline">Fixed Size</span>
          </Toggle>
          <Toggle
            size="sm"
            pressed={compactType === null}
            onPressedChange={(pressed) => onCompactTypeChange(pressed ? null : "vertical")}
            aria-label="Free Movement"
            className="h-7 px-2 gap-2 text-xs data-[state=on]:bg-background data-[state=on]:text-primary"
          >
            {compactType === null ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            <span className="hidden lg:inline">Free Move</span>
          </Toggle>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Edit Mode Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
          <Eye className={cn("w-4 h-4", !isEditMode && "text-primary")} />
          <Switch
            checked={isEditMode}
            onCheckedChange={onToggleEditMode}
            className="data-[state=checked]:bg-primary h-5 w-9"
          />
          <Edit className={cn("w-4 h-4", isEditMode && "text-primary")} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-2">
          {isEditMode && (
            <Button
              variant="default" // Changed to primary for visibility
              size="sm"
              onClick={onAddWidget}
              className="gap-2 h-8"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            className="gap-2 h-8"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <ExportDropdown dashboard={dashboard} containerRef={containerRef} />
        </div>
      </div>
    </div>
  );
}
