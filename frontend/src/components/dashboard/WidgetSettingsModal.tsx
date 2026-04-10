import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { WidgetConfig, ChartType, DateRange, AggregationMethod, ValueFormat } from "@/types/dashboard";
import {
  BarChart3, LineChart, AreaChart, PieChart, Database, Layout,
  MousePointer, Calendar, MapPin, Type, Palette, Image as ImageIcon
} from "lucide-react";
import { getWidgetSettings, getWidgetDescription, getWidgetCategory } from "@/lib/widget-settings";

interface WidgetSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: WidgetConfig | null;
  onSave: (config: Partial<WidgetConfig>) => void;
  connections: { id: string; name: string }[];
}

const chartTypes: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: "line", label: "Line Chart", icon: <LineChart className="w-4 h-4" /> },
  { value: "bar", label: "Bar Chart", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "area", label: "Area Chart", icon: <AreaChart className="w-4 h-4" /> },
  { value: "donut", label: "Donut Chart", icon: <PieChart className="w-4 h-4" /> },
];

const colorPresets = [
  { colors: ["rose", "amber"], preview: ["#f43f5e", "#f59e0b"], name: "Rose & Amber" },
  { colors: ["blue", "emerald"], preview: ["#3b82f6", "#10b981"], name: "Blue & Emerald" },
  { colors: ["violet", "cyan"], preview: ["#8b5cf6", "#06b6d4"], name: "Violet & Cyan" },
  { colors: ["orange", "pink"], preview: ["#f97316", "#ec4899"], name: "Orange & Pink" },
  { colors: ["indigo", "teal"], preview: ["#6366f1", "#14b8a6"], name: "Indigo & Teal" },
  { colors: ["red", "blue"], preview: ["#ef4444", "#3b82f6"], name: "Red & Blue" },
];

export function WidgetSettingsModal({ open, onOpenChange, widget, onSave, connections }: WidgetSettingsModalProps) {
  const [chartType, setChartType] = useState<ChartType>("area");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [aggregation, setAggregation] = useState<AggregationMethod>("sum");
  const [valueFormat, setValueFormat] = useState<ValueFormat>("number");
  const [selectedColors, setSelectedColors] = useState<string[]>(["rose", "amber"]);
  const [connectionId, setConnectionId] = useState<string | undefined>(undefined);
  const [showBorder, setShowBorder] = useState(true);
  const [showBackground, setShowBackground] = useState(true);
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonAction, setButtonAction] = useState("");
  const [textContent, setTextContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetValue, setTargetValue] = useState<number>(100);
  const [countdownTarget, setCountdownTarget] = useState("");
  const [headerLevel, setHeaderLevel] = useState<1 | 2 | 3>(2);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (widget) {
      setChartType(widget.chartType);
      setDateRange(widget.dateRange);
      setAggregation(widget.aggregation);
      setValueFormat(widget.valueFormat);
      setSelectedColors(widget.colors);
      setConnectionId(widget.connectionId);
      setShowBorder(widget.showBorder !== false);
      setShowBackground(widget.showBackground !== false);
      setButtonLabel(widget.buttonLabel || "");
      setButtonAction(widget.buttonAction || "");
      setTextContent(widget.textContent || "");
      setImageUrl(widget.imageUrl || "");
      setTargetValue(widget.target || 100);
      setCountdownTarget(widget.countdownTarget || "");
      setHeaderLevel(widget.headerLevel || 2);
      setTitle(widget.title || "");
    }
  }, [widget]);

  const handleSave = () => {
    const updates: Partial<WidgetConfig> = {
      showBorder,
      showBackground,
      title: title.trim() || widget?.title || "Widget",
    };

    const settings = getWidgetSettings(widget?.chartType || chartType);

    if (settings.showChartType) {
      updates.chartType = chartType;
    }
    if (settings.showDataSource) {
      updates.connectionId = connectionId;
    }
    if (settings.showDateRange) {
      updates.dateRange = dateRange;
    }
    if (settings.showAggregation) {
      updates.aggregation = aggregation;
    }
    if (settings.showValueFormat) {
      updates.valueFormat = valueFormat;
    }
    if (settings.showColorScheme) {
      updates.colors = selectedColors;
    }
    if (settings.showTextContent) {
      updates.textContent = textContent;
      if (widget?.chartType === "header") {
        updates.headerLevel = headerLevel;
      }
    }
    if (settings.showImageUrl) {
      updates.imageUrl = imageUrl;
    }
    if (settings.showButtonConfig) {
      updates.buttonLabel = buttonLabel || undefined;
      updates.buttonAction = buttonAction || undefined;
    }
    if (settings.showTargetValue) {
      updates.target = targetValue;
    }
    if (settings.showTimeConfig && widget?.chartType === "countdown") {
      updates.countdownTarget = countdownTarget;
    }

    onSave(updates);
    onOpenChange(false);
  };

  if (!widget) return null;

  const settings = getWidgetSettings(widget.chartType);
  const description = getWidgetDescription(widget.chartType);
  const category = getWidgetCategory(widget.chartType);

  // Check if any settings are available for this widget
  const hasSettings = settings.showDataSource ||
    settings.showDateRange ||
    settings.showAggregation ||
    settings.showValueFormat ||
    settings.showChartType ||
    settings.showColorScheme ||
    settings.showTextContent ||
    settings.showImageUrl ||
    settings.showButtonConfig ||
    settings.showMapConfig ||
    settings.showTimeConfig ||
    settings.showTargetValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Widget Settings</DialogTitle>
            <Badge variant="secondary" className="text-[10px]">{category}</Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-foreground">Widget Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter widget title"
            />
          </div>
          {/* Chart Type Selection - Only for switchable chart widgets */}
          {settings.showChartType && (
            <div className="space-y-2">
              <Label className="text-foreground">Chart Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {chartTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setChartType(type.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${chartType === type.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted text-foreground"
                      }`}
                  >
                    {type.icon}
                    <span className="text-[10px] font-medium">{type.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Data Source Selection */}
          {settings.showDataSource && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <Label className="text-foreground">Data Source</Label>
              </div>
                <Select
                  value={connectionId?.toString()}
                  onValueChange={(v) => setConnectionId(v)}
                >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a data source" />
                </SelectTrigger>
                <SelectContent>
                  {connections.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No sources found
                    </SelectItem>
                  ) : (
                    connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id.toString()}>
                        {conn.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range */}
          {settings.showDateRange && (
            <div className="space-y-2">
              <Label className="text-foreground">Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aggregation */}
          {settings.showAggregation && (
            <div className="space-y-2">
              <Label className="text-foreground">Aggregation Method</Label>
              <Select value={aggregation} onValueChange={(v) => setAggregation(v as AggregationMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Raw Data)</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Value Format */}
          {settings.showValueFormat && (
            <div className="space-y-2">
              <Label className="text-foreground">Value Format</Label>
              <Select value={valueFormat} onValueChange={(v) => setValueFormat(v as ValueFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number (1,234)</SelectItem>
                  <SelectItem value="currency">Currency ($1,234)</SelectItem>
                  <SelectItem value="percentage">Percentage (12%)</SelectItem>
                  <SelectItem value="compact">Compact (1.2K)</SelectItem>
                  <SelectItem value="duration">Duration (1h 23m)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Color Scheme */}
          {settings.showColorScheme && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <Label className="text-foreground">Color Scheme</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {colorPresets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColors(preset.colors)}
                    className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all ${JSON.stringify(selectedColors) === JSON.stringify(preset.colors)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                      }`}
                  >
                    <div className="flex gap-1">
                      {preset.preview.map((color, j) => (
                        <div
                          key={j}
                          className="w-5 h-5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-medium text-foreground">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Content - For text and header widgets */}
          {settings.showTextContent && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" />
                <Label className="text-foreground">Content</Label>
              </div>
              {widget.chartType === "header" ? (
                <>
                  <Input
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter heading text..."
                    className="text-foreground"
                  />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Header Level</Label>
                    <Select value={headerLevel.toString()} onValueChange={(v) => setHeaderLevel(parseInt(v) as 1 | 2 | 3)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">H1 - Large</SelectItem>
                        <SelectItem value="2">H2 - Medium</SelectItem>
                        <SelectItem value="3">H3 - Small</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter your text content..."
                  rows={4}
                  className="resize-none text-foreground"
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                💡 Tip: You can also edit text directly by clicking on the widget in edit mode!
              </p>
            </div>
          )}

          {/* Image URL */}
          {settings.showImageUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <Label className="text-foreground">Image URL</Label>
              </div>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="text-foreground"
              />
            </div>
          )}

          {/* Target Value */}
          {settings.showTargetValue && (
            <div className="space-y-2">
              <Label className="text-foreground">Target Value</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                placeholder="100"
                className="text-foreground"
              />
            </div>
          )}

          {/* Time Configuration */}
          {settings.showTimeConfig && widget.chartType === "countdown" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <Label className="text-foreground">Countdown Target Date</Label>
              </div>
              <Input
                type="datetime-local"
                value={countdownTarget}
                onChange={(e) => setCountdownTarget(e.target.value)}
                className="text-foreground"
              />
            </div>
          )}

          {/* Button Configuration */}
          {settings.showButtonConfig && (
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-primary" />
                Button Settings
              </h4>
              <div className="space-y-2">
                <Label className="text-foreground">Button Label</Label>
                <Input
                  value={buttonLabel}
                  onChange={(e) => setButtonLabel(e.target.value)}
                  placeholder="e.g. View Details"
                  className="text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Click Action (URL or Trigger)</Label>
                <Input
                  value={buttonAction}
                  onChange={(e) => setButtonAction(e.target.value)}
                  placeholder="e.g. /connections or open_modal"
                  className="text-foreground"
                />
              </div>
            </div>
          )}

          {/* Map Configuration */}
          {settings.showMapConfig && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <Label className="text-foreground">Map Configuration</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Map data will be loaded from your selected data source. Ensure your data includes <code className="bg-muted px-1 rounded">lat</code> and <code className="bg-muted px-1 rounded">lng</code> columns for marker positioning.
              </p>
            </div>
          )}

          {/* Style & Layout - Always show */}
          {settings.showStyleOptions && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layout className="w-4 h-4 text-primary" />
                Style & Layout
              </h4>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">Show Border</Label>
                  <p className="text-[10px] text-muted-foreground">Toggle widget enclosure</p>
                </div>
                <Switch checked={showBorder} onCheckedChange={setShowBorder} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">Show Background</Label>
                  <p className="text-[10px] text-muted-foreground">Fill widget with card background</p>
                </div>
                <Switch checked={showBackground} onCheckedChange={setShowBackground} />
              </div>
            </div>
          )}

          {/* Empty state for widgets with no configurable settings */}
          {!hasSettings && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                This widget has no additional configuration options.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Style options are available below.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
