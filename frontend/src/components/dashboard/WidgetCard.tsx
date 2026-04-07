import { useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WidgetChart } from "./WidgetChart";
import type { WidgetConfig } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { getWidgetSettings } from "@/lib/widget-settings";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface WidgetCardProps {
  config: WidgetConfig;
  isEditMode: boolean;
  onSettings: () => void;
  onDelete: () => void;
  onUpdate?: (updates: Partial<WidgetConfig>) => void;
  onExecuteQuery?: (sql: string) => void;
}

const COLOR_PRESETS = [
  { name: "Rose & Amber", colors: ["rose", "amber"], preview: ["#f43f5e", "#f59e0b"] },
  { name: "Blue & Emerald", colors: ["blue", "emerald"], preview: ["#3b82f6", "#10b981"] },
  { name: "Violet & Cyan", colors: ["violet", "cyan"], preview: ["#8b5cf6", "#06b6d4"] },
  { name: "Orange & Pink", colors: ["orange", "pink"], preview: ["#f97316", "#ec4899"] },
  { name: "Indigo & Teal", colors: ["indigo", "teal"], preview: ["#6366f1", "#14b8a6"] },
  { name: "Red & Blue", colors: ["red", "blue"], preview: ["#ef4444", "#3b82f6"] },
];

export function WidgetCard({
  config,
  isEditMode,
  onSettings,
  onDelete,
  onUpdate,
  onExecuteQuery,
}: WidgetCardProps) {
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [sqlInput, setSqlInput] = useState(config.sql_query || "");

  const widgetSettings = getWidgetSettings(config.chartType);

  useEffect(() => {
    if (config.sql_query !== undefined && config.sql_query !== sqlInput && !showSql) {
      setSqlInput(config.sql_query);
    }
  }, [config.sql_query, sqlInput, showSql]);

  const handleSaveSql = () => {
    onUpdate?.({ sql_query: sqlInput });
    onExecuteQuery?.(sqlInput);
    setShowSql(false);
    toast({
      title: "Query saved",
      description: "Widget data will refresh shortly",
    });
  };

  const handleColorChange = (colors: string[]) => {
    onUpdate?.({ colors });
    toast({
      title: "Colors updated",
      description: "Widget colors have been changed",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "h-full flex flex-col transition-all duration-200 rounded-lg",
        config.showBackground !== false ? "bg-obsidian-surface-low" : "bg-transparent",
        config.showBorder !== false ? "border border-obsidian-outline-variant/15" : "border-none",
        config.errorMessage && "border-red-500/40 ring-1 ring-red-500/20",
        isEditMode && "ring-1 ring-obsidian-primary/10 hover:ring-obsidian-primary/30",
        isHovered && isEditMode && "shadow-lg shadow-obsidian-primary/5",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      {(isEditMode || (config.showBorder !== false && config.showBackground !== false)) && (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2.5 border-b border-obsidian-outline-variant/10 bg-obsidian-surface-mid/30",
            !isEditMode && (config.showBorder === false || config.showBackground === false) && "hidden"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isEditMode && (
              <div className="drag-handle cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-obsidian-surface-high rounded transition-colors">
                <Icon name="drag_indicator" size="sm" className="text-obsidian-outline" />
              </div>
            )}
            <h3 className="text-xs font-bold text-obsidian-on-surface truncate">{config.title}</h3>
            {config.errorMessage && (
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-label font-bold text-red-400 uppercase tracking-wider">
                <Icon name="warning" size="sm" className="text-red-400" />
                Failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {widgetSettings.showSqlButton && (
              <button
                className={cn(
                  "h-6 w-6 rounded flex items-center justify-center hover:bg-obsidian-surface-high transition-colors",
                  showSql ? "text-obsidian-primary" : "text-obsidian-outline"
                )}
                onClick={() => setShowSql(!showSql)}
                title="View/Edit SQL Query"
              >
                <Icon name="code" size="sm" />
              </button>
            )}

            {widgetSettings.showColorScheme && isEditMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="h-6 w-6 rounded flex items-center justify-center text-obsidian-outline hover:bg-obsidian-surface-high hover:text-obsidian-primary transition-colors"
                    title="Change Colors"
                  >
                    <Icon name="palette" size="sm" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2 bg-obsidian-surface-mid border-obsidian-outline-variant/20" align="end">
                  <div className="space-y-0.5">
                    <p className="font-label text-[9px] uppercase tracking-[0.15em] text-obsidian-outline font-bold px-2 py-1">Color Scheme</p>
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleColorChange(preset.colors)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all",
                          "hover:bg-obsidian-surface-high",
                          JSON.stringify(config.colors) === JSON.stringify(preset.colors) && "bg-obsidian-primary/10 ring-1 ring-obsidian-primary/20"
                        )}
                      >
                        <div className="flex gap-1">
                          {preset.preview.map((color, i) => (
                            <div
                              key={i}
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-obsidian-on-surface">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {isEditMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-6 w-6 rounded flex items-center justify-center text-obsidian-outline hover:bg-obsidian-surface-high transition-colors">
                    <Icon name="more_vert" size="sm" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-obsidian-surface-mid border-obsidian-outline-variant/20">
                  <DropdownMenuItem onClick={onSettings} className="gap-2 text-xs">
                    <Icon name="settings" size="sm" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-obsidian-outline-variant/15" />
                  <DropdownMenuItem onClick={onDelete} className="gap-2 text-xs text-red-400 focus:text-red-400">
                    <Icon name="delete" size="sm" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Chart / Content / SQL */}
      <div
        className={cn(
          "flex-1 min-h-0 relative",
          config.showBackground !== false ? "bg-obsidian-surface-low" : "bg-transparent"
        )}
      >
        {config.errorMessage && !showSql && (
          <div className="px-4 pt-3 text-xs text-red-400">{config.errorMessage}</div>
        )}
        {showSql ? (
          <div className="absolute inset-0 p-4 bg-obsidian-surface flex flex-col z-10">
            {isEditMode ? (
              <>
                <textarea
                  className="flex-1 bg-obsidian-surface-lowest text-obsidian-primary/80 font-mono text-xs p-3 rounded-lg resize-none border border-obsidian-outline-variant/20 focus:outline-none focus:border-obsidian-primary mb-2"
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  placeholder="SELECT ... FROM ..."
                  spellCheck={false}
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="h-7 px-3 text-xs font-label rounded-lg bg-obsidian-surface-mid text-obsidian-on-surface-variant hover:bg-obsidian-surface-high transition-colors"
                    onClick={() => setShowSql(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-7 px-3 text-xs font-label rounded-lg bg-obsidian-primary-container text-obsidian-surface font-bold hover:bg-obsidian-primary transition-colors"
                    onClick={handleSaveSql}
                  >
                    Save & Run
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full rounded-lg bg-obsidian-surface-lowest p-3 border border-obsidian-outline-variant/10 overflow-auto">
                <pre className="text-xs leading-relaxed font-mono text-obsidian-primary/70 whitespace-pre-wrap">
                  {config.sql_query || "-- No SQL query configured for this widget"}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full w-full p-4">
            <WidgetChart
              config={config}
              isEditMode={isEditMode}
              onUpdate={onUpdate}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
