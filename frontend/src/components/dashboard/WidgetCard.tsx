import { useState, useEffect } from "react";
import { GripVertical, Settings, Trash2, MoreVertical, Code2, Palette, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Color presets with actual CSS colors for the picker
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

  // Get widget-specific settings
  const widgetSettings = getWidgetSettings(config.chartType);

  // Sync state if config changes externally
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
        "h-full flex flex-col transition-all duration-200",
        config.showBackground !== false ? "bg-card" : "bg-transparent",
        config.showBorder !== false ? "border border-border rounded-xl" : "border-none",
        config.errorMessage && "border-destructive/60 ring-1 ring-destructive/20",
        isEditMode && "ring-1 ring-primary/20 hover:ring-primary/40",
        isHovered && isEditMode && "shadow-lg shadow-primary/10",
        isEditMode && "rounded-xl border border-border bg-card/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      {(isEditMode || (config.showBorder !== false && config.showBackground !== false)) && (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30",
            !isEditMode && (config.showBorder === false || config.showBackground === false) && "hidden"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isEditMode && (
              <div className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded transition-colors">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-foreground truncate">{config.title}</h3>
            {config.errorMessage && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* SQL Button - Only show for data widgets */}
            {widgetSettings.showSqlButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setShowSql(!showSql)}
                title="View/Edit SQL Query"
              >
                <Code2 className={cn("w-4 h-4", showSql ? "text-primary" : "text-muted-foreground")} />
              </Button>
            )}

            {/* Color Picker - Only show for widgets with color schemes */}
            {widgetSettings.showColorScheme && isEditMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Change Colors"
                  >
                    <Palette className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Color Scheme</p>
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleColorChange(preset.colors)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all",
                          "hover:bg-muted",
                          JSON.stringify(config.colors) === JSON.stringify(preset.colors) && "bg-primary/10 ring-1 ring-primary/20"
                        )}
                      >
                        <div className="flex gap-1">
                          {preset.preview.map((color, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-foreground">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {isEditMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={onSettings} className="gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4" />
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
          config.showBackground !== false ? "bg-card" : "bg-transparent"
        )}
      >
        {config.errorMessage && !showSql && (
          <div className="px-4 pt-3 text-xs text-destructive">{config.errorMessage}</div>
        )}
        {showSql ? (
          <div className="absolute inset-0 p-4 bg-background flex flex-col z-10">
            {isEditMode ? (
              <>
                <textarea
                  className="flex-1 bg-zinc-950 dark:bg-zinc-900 text-zinc-300 font-mono text-xs p-3 rounded-md resize-none border border-border focus:outline-none focus:ring-2 focus:ring-primary mb-2"
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  placeholder="SELECT ... FROM ..."
                  spellCheck={false}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowSql(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveSql}>
                    Save & Run
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-full rounded-lg bg-zinc-950 dark:bg-zinc-900 p-3 shadow-inner border border-zinc-800 overflow-auto">
                <pre className="text-xs leading-relaxed font-mono text-zinc-300 whitespace-pre-wrap">
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
