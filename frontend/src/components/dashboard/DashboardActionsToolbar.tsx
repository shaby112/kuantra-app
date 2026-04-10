import { Icon } from "@/components/Icon";
import { ExportDropdown } from "./ExportDropdown";
import type { DashboardConfig } from "@/types/dashboard";

interface DashboardActionsToolbarProps {
  dashboard: DashboardConfig;
  onShare: () => void;
  onAddWidget: () => void;
  onSave: () => void;
  onCreateDemo: () => void;
  onFullscreen: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function DashboardActionsToolbar({
  dashboard,
  onShare,
  onAddWidget,
  onSave,
  onCreateDemo,
  onFullscreen,
  containerRef,
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
        {/* Add Widget */}
        <button
          onClick={onAddWidget}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-primary-container text-obsidian-surface text-xs font-bold hover:bg-obsidian-primary transition-colors"
        >
          <Icon name="add" size="sm" />
          <span className="hidden sm:inline">Add</span>
        </button>

        <button
          onClick={onSave}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors"
        >
          <Icon name="save" size="sm" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <button
          onClick={onCreateDemo}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors"
        >
          <Icon name="auto_awesome" size="sm" />
          <span className="hidden sm:inline">Demo</span>
        </button>

        {/* Fullscreen in New Tab */}
        <button
          onClick={onFullscreen}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors"
          title="Open in new tab (fullscreen)"
        >
          <Icon name="open_in_new" size="sm" />
          <span className="hidden sm:inline">Fullscreen</span>
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant text-xs font-medium hover:bg-obsidian-surface-high hover:text-obsidian-on-surface transition-colors"
        >
          <Icon name="share" size="sm" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Export */}
        <ExportDropdown dashboard={dashboard} containerRef={containerRef} />
      </div>
    </div>
  );
}
