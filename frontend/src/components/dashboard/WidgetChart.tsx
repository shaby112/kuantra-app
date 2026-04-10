import type { WidgetConfig, ChartType } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EChart } from "./EChart";
import {
  TrendingUp, TrendingDown, Minus, Target, Activity, Image as ImageIcon, FileText,
  ArrowRight, Clock, Calendar, MapPin, Filter, ChevronDown, Play, Pause,
  Users, DollarSign, ShoppingCart, Star, Zap, Award, BarChart3, Globe,
  ArrowUpRight, ArrowDownRight, Hash, Percent, Timer
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MapWidget } from "./widgets/MapWidget";
import { CalendarWidget } from "./widgets/CalendarWidget";
import { CountdownWidget } from "./widgets/CountdownWidget";
import { StopwatchWidget } from "./widgets/StopwatchWidget";
import { InlineEditableText } from "./widgets/InlineEditableText";
import { QuickStatsWidget } from "./widgets/QuickStatsWidget";
import { ProgressRingWidget } from "./widgets/ProgressRingWidget";
import { ActivityFeedWidget } from "./widgets/ActivityFeedWidget";

interface WidgetChartProps {
  config: WidgetConfig;
  className?: string;
  isEditMode?: boolean;
  onUpdate?: (updates: Partial<WidgetConfig>) => void;
}

const valueFormatters: Record<string, (value: number) => string> = {
  currency: (value) => `$${Intl.NumberFormat("us").format(value)}`,
  number: (value) => Intl.NumberFormat("us").format(value),
  percentage: (value) => `${value}%`,
  compact: (value) => Intl.NumberFormat("us", { notation: "compact" }).format(value),
  duration: (value) => {
    const hours = Math.floor(value / 3600);
    const mins = Math.floor((value % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  },
};

const iconMap: Record<string, React.ElementType> = {
  users: Users,
  dollar: DollarSign,
  cart: ShoppingCart,
  star: Star,
  zap: Zap,
  award: Award,
  chart: BarChart3,
  globe: Globe,
  clock: Clock,
  calendar: Calendar,
  target: Target,
  activity: Activity,
};

export function WidgetChart({ config, className, isEditMode = false, onUpdate }: WidgetChartProps) {
  const navigate = useNavigate();
  const { chartType, data, indexField, categories, colors, valueFormat } = config;
  const formatter = valueFormatters[valueFormat] || valueFormatters.number;
  const COLOR_MAP: Record<string, string> = {
    rose: "#f43f5e",
    amber: "#f59e0b",
    blue: "#3b82f6",
    emerald: "#10b981",
    violet: "#8b5cf6",
    cyan: "#06b6d4",
    orange: "#f97316",
    pink: "#ec4899",
    indigo: "#6366f1",
    teal: "#14b8a6",
    red: "#ef4444",
    purple: "#a855f7",
    sky: "#0ea5e9",
    green: "#22c55e",
    lime: "#84cc16",
    yellow: "#eab308",
    slate: "#64748b",
    gray: "#6b7280",
    zinc: "#71717a",
    neutral: "#737373",
    stone: "#78716c",
    fuchsia: "#d946ef",
  };
  const resolveColor = (color?: string, fallback = "#8b5cf6") => {
    if (!color) return fallback;
    return COLOR_MAP[color] || color;
  };

  switch (chartType) {
    case "area":
      return (
        <EChart
          className={className}
          option={{
            xAxis: { type: "category", data: data.map((d) => d[indexField]) },
            yAxis: { type: "value" },
            legend: { data: categories, bottom: 0 },
            series: categories.map((cat, i) => ({
              name: cat,
              type: "line",
              smooth: true,
              areaStyle: { opacity: 0.28 },
              data: data.map((d) => d[cat]),
              itemStyle: { color: resolveColor(colors?.[i]) },
            })),
          }}
        />
      );
    case "bar":
      return (
        <EChart
          className={className}
          option={{
            xAxis: { type: "category", data: data.map((d) => d[indexField]) },
            yAxis: { type: "value" },
            legend: { data: categories, bottom: 0 },
            series: categories.map((cat, i) => ({
              name: cat,
              type: "bar",
              data: data.map((d) => d[cat]),
              itemStyle: { color: resolveColor(colors?.[i]), borderRadius: [6, 6, 0, 0] },
            })),
          }}
        />
      );
    case "line":
      return (
        <EChart
          className={className}
          option={{
            xAxis: { type: "category", data: data.map((d) => d[indexField]) },
            yAxis: { type: "value" },
            legend: { data: categories, bottom: 0 },
            series: categories.map((cat, i) => ({
              name: cat,
              type: "line",
              smooth: true,
              data: data.map((d) => d[cat]),
              itemStyle: { color: resolveColor(colors?.[i]) },
            })),
          }}
        />
      );
    case "donut":
      return (
        <EChart
          className={className}
          option={{
            legend: { orient: "horizontal", bottom: 0 },
            series: [
              {
                type: "pie",
                radius: ["40%", "72%"],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: "transparent", borderWidth: 2 },
                label: { show: false },
                emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
                data: data.map((d, i) => ({
                  name: d[indexField],
                  value: d[categories[0]],
                  itemStyle: colors?.[i] ? { color: resolveColor(colors[i]) } : undefined,
                })),
              },
            ],
          }}
        />
      );

    case "metric":
    case "kpi":
      const dataValue = data?.[0]?.[categories?.[0]];
      const displayValue = dataValue ?? config.value ?? 0;
      const primaryColor = resolveColor(colors?.[0], "#10b981");
      return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4 text-center", className)}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {config.title}
          </p>
          <div className="flex items-baseline gap-1">
            {config.prefix && <span className="text-2xl font-medium text-muted-foreground">{config.prefix}</span>}
            <span className="text-4xl font-bold tracking-tight" style={{ color: primaryColor }}>
              {typeof displayValue === 'number' ? formatter(displayValue) : displayValue}
            </span>
            {config.suffix && <span className="text-lg font-medium text-muted-foreground">{config.suffix}</span>}
          </div>
          {config.trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-sm font-medium",
              config.trend > 0 ? "text-emerald-500" : config.trend < 0 ? "text-rose-500" : "text-muted-foreground"
            )}>
              {config.trend > 0 ? <TrendingUp className="w-4 h-4" /> :
                config.trend < 0 ? <TrendingDown className="w-4 h-4" /> :
                  <Minus className="w-4 h-4" />}
              <span>{Math.abs(config.trend)}%</span>
            </div>
          )}
          {config.target && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Target className="w-3 h-3" />
              <span>Target: {formatter(config.target)}</span>
            </div>
          )}
        </div>
      );

    case "progress":
      const progressValue = typeof config.value === 'number' ? config.value : 0;
      const progressTarget = config.target || 100;
      const progressPercent = Math.min((progressValue / progressTarget) * 100, 100);
      return (
        <div className={cn("h-full flex flex-col justify-center p-4", className)}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">{config.title}</span>
            <span className="text-sm font-bold text-foreground">{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="mt-2" />
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{formatter(progressValue)}</span>
            <span>/ {formatter(progressTarget)}</span>
          </div>
        </div>
      );

    case "sparkline":
      const sparkData = (config.sparklineData || data.map(d => d[categories[0]] || 0)).map((v, i) => ({ index: i, value: v }));
      return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4", className)}>
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">{sparkData[sparkData.length - 1]?.value || 0}</span>
          </div>
          <EChart
            className="h-12 w-full"
            option={{
              grid: { left: 0, right: 0, top: 0, bottom: 0 },
              xAxis: { type: "category", show: false, data: sparkData.map((d) => d.index) },
              yAxis: { type: "value", show: false },
              series: [
                {
                  type: "line",
                  smooth: true,
                  showSymbol: false,
                  areaStyle: { opacity: 0.25 },
                  data: sparkData.map((d) => d.value),
                },
              ],
            }}
          />
        </div>
      );

    case "gauge":
      const gaugeValue = typeof config.value === 'number' ? config.value : 0;
      const gaugeMax = config.target || 100;
      const gaugePercent = Math.min((gaugeValue / gaugeMax) * 100, 100);
      return (
        <EChart
          className={className}
          option={{
            series: [
              {
                type: "gauge",
                min: 0,
                max: gaugeMax,
                progress: { show: true, width: 14 },
                axisLine: { lineStyle: { width: 14 } },
                detail: { formatter: `${gaugePercent.toFixed(0)}%`, fontSize: 18 },
                data: [{ value: gaugeValue, name: config.title }],
              },
            ],
          }}
        />
      );

    // TEXT WIDGET - Now with inline editing!
    case "text":
      return (
        <InlineEditableText
          value={config.textContent || ""}
          onChange={(textContent) => onUpdate?.({ textContent })}
          isEditMode={isEditMode}
          title={config.title}
          placeholder="Click to add your text content..."
          variant="text"
          className={className}
        />
      );

    // HEADER WIDGET - Inline editing
    case "header":
      return (
        <InlineEditableText
          value={config.textContent || config.title || ""}
          onChange={(textContent) => onUpdate?.({ textContent })}
          isEditMode={isEditMode}
          title="Header"
          placeholder="Click to add heading..."
          variant="header"
          headerLevel={config.headerLevel || 2}
          align={config.headerAlign}
          className={className}
        />
      );

    case "image":
      return (
        <div className={cn("h-full flex flex-col p-2", className)}>
          {config.imageUrl ? (
            <img
              src={config.imageUrl}
              alt={config.title}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <ImageIcon className="w-8 h-8 mb-2" />
              <span className="text-xs">No image set</span>
              {isEditMode && <span className="text-[10px] text-muted-foreground/70 mt-1">Open settings to add image</span>}
            </div>
          )}
        </div>
      );

    case "funnel":
      const stages = config.funnelStages || [
        { name: "Visitors", value: 10000 },
        { name: "Leads", value: 5000 },
        { name: "MQLs", value: 2000 },
        { name: "SQLs", value: 800 },
        { name: "Customers", value: 200 },
      ];
      const maxValue = stages[0]?.value || 1;
      return (
        <div className={cn("h-full flex flex-col p-4", className)}>
          <h4 className="text-sm font-semibold text-foreground mb-4">{config.title}</h4>
          <div className="flex-1 flex flex-col justify-center gap-2">
            {stages.map((stage, i) => {
              const width = (stage.value / maxValue) * 100;
              const conversionRate = i > 0 ? ((stage.value / stages[i - 1].value) * 100).toFixed(1) : null;
              return (
                <motion.div
                  key={stage.name}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="h-8 rounded-r-lg bg-gradient-to-r from-primary to-primary/60 flex items-center justify-end px-3 origin-left"
                    style={{ width: `${Math.max(width, 20)}%` }}
                  >
                    <span className="text-xs font-bold text-primary-foreground">{formatter(stage.value)}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-[100px]">
                    <span className="text-xs font-medium text-foreground">{stage.name}</span>
                    {conversionRate && (
                      <Badge variant="secondary" className="text-[10px]">{conversionRate}%</Badge>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      );

    case "comparison":
      const currentValue = typeof config.value === 'number' ? config.value : 0;
      const compareValue = config.comparisonValue || 0;
      const diff = currentValue - compareValue;
      const percentChange = compareValue > 0 ? ((diff / compareValue) * 100) : 0;
      return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4", className)}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{config.title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">{formatter(currentValue)}</span>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <span className="text-xs text-muted-foreground">{config.comparisonLabel || "Previous"}</span>
              <p className="text-sm font-medium text-foreground">{formatter(compareValue)}</p>
            </div>
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
              diff > 0 ? "bg-emerald-500/10 text-emerald-500" : diff < 0 ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground"
            )}>
              {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
              {percentChange.toFixed(1)}%
            </div>
          </div>
        </div>
      );

    case "leaderboard":
      const listItems = config.listItems || [
        { label: "John Doe", value: 12500, trend: 12 },
        { label: "Jane Smith", value: 10200, trend: -3 },
        { label: "Bob Johnson", value: 9800, trend: 8 },
        { label: "Alice Brown", value: 8500, trend: 0 },
        { label: "Charlie Wilson", value: 7200, trend: 5 },
      ];
      return (
        <div className={cn("h-full flex flex-col p-4", className)}>
          <h4 className="text-sm font-semibold text-foreground mb-4">{config.title}</h4>
          <div className="flex-1 overflow-auto space-y-2">
            {listItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  i === 0 ? "bg-amber-500 text-amber-950" :
                    i === 1 ? "bg-slate-400 text-slate-950" :
                      i === 2 ? "bg-amber-700 text-amber-100" : "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{formatter(typeof item.value === 'number' ? item.value : 0)}</span>
                  {item.trend !== undefined && (
                    <span className={cn(
                      "text-xs",
                      item.trend > 0 ? "text-emerald-500" : item.trend < 0 ? "text-rose-500" : "text-muted-foreground"
                    )}>
                      {item.trend > 0 ? "↑" : item.trend < 0 ? "↓" : "–"}{Math.abs(item.trend)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "stat":
      const StatIcon = config.icon ? iconMap[config.icon] || Activity : Activity;
      return (
        <div className={cn("h-full flex items-center justify-between p-4", className)}>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{config.title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              {config.prefix && <span className="text-lg text-muted-foreground">{config.prefix}</span>}
              <span className="text-3xl font-bold text-foreground">{typeof config.value === 'number' ? formatter(config.value) : config.value}</span>
              {config.suffix && <span className="text-sm text-muted-foreground">{config.suffix}</span>}
            </div>
            {config.trend !== undefined && (
              <div className={cn(
                "flex items-center gap-1 mt-1 text-xs font-medium",
                config.trend > 0 ? "text-emerald-500" : config.trend < 0 ? "text-rose-500" : "text-muted-foreground"
              )}>
                {config.trend > 0 ? <TrendingUp className="w-3 h-3" /> : config.trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                <span>{Math.abs(config.trend)}% vs last period</span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <StatIcon className="w-6 h-6 text-primary" />
          </div>
        </div>
      );

    case "button":
      const buttonVariant = config.buttonVariant === "primary" ? "default" : (config.buttonVariant || "default");
      return (
        <div className={cn("h-full flex items-center justify-center p-4", className)}>
          <Button
            variant={buttonVariant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"}
            className="gap-2 px-8 py-6 text-lg font-bold shadow-lg hover:shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            onClick={() => {
              if (config.buttonAction?.startsWith("/")) {
                navigate(config.buttonAction);
              } else if (config.buttonAction) {
                console.log("Triggering action:", config.buttonAction);
              }
            }}
          >
            {config.buttonLabel || "Click Me"}
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      );

    case "container":
      return (
        <div
          className={cn(
            "h-full w-full rounded-2xl transition-all duration-300 relative group overflow-hidden",
            config.showBorder !== false ? "border-2 border-dashed border-primary/20" : "border-none",
            config.showBackground ? "bg-primary/5 backdrop-blur-sm" : "bg-transparent",
            className
          )}
        >
          {config.textContent && (
            <div className="absolute top-4 left-4 text-xs font-bold uppercase tracking-widest text-primary/40 group-hover:text-primary/70 transition-colors">
              {config.textContent}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="text-[10px] font-bold text-primary/40 uppercase">Container / Drop Zone</div>
          </div>
        </div>
      );

    case "colorBlock":
      return (
        <div
          className={cn("h-full rounded-lg", className)}
          style={{
            backgroundColor: config.backgroundColor || "hsl(var(--primary))",
            borderRadius: config.borderRadius ? `${config.borderRadius}px` : undefined
          }}
        />
      );

    case "divider":
      return (
        <div className={cn("h-full flex items-center justify-center p-4", className)}>
          <div className="w-full h-px bg-border" />
        </div>
      );

    case "list":
      const items = config.listItems || [];
      return (
        <div className={cn("h-full flex flex-col p-4", className)}>
          <h4 className="text-sm font-semibold text-foreground mb-3">{config.title}</h4>
          <div className="flex-1 overflow-auto space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground">{item.label}</span>
                <span className="text-sm font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "timeline":
      const events = config.timelineEvents || [
        { date: "2024-01-15", title: "Project Started", description: "Initial kickoff meeting" },
        { date: "2024-02-01", title: "Phase 1 Complete", description: "First milestone reached" },
        { date: "2024-03-01", title: "Launch", description: "Product goes live" },
      ];
      return (
        <div className={cn("h-full flex flex-col p-4", className)}>
          <h4 className="text-sm font-semibold text-foreground mb-4">{config.title}</h4>
          <div className="flex-1 overflow-auto relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {events.map((event, i) => (
                <div key={i} className="flex gap-4 pl-6 relative">
                  <div className="absolute left-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "countdown":
      const targetDate = config.countdownTarget || new Date(Date.now() + 86400000).toISOString();
      return <CountdownWidget title={config.title} targetDate={targetDate} className={className} />;

    case "ticker":
      const tickerItems = config.listItems || [
        { label: "AAPL", value: 185.92, trend: 2.3 },
        { label: "GOOGL", value: 141.80, trend: -0.5 },
        { label: "MSFT", value: 378.91, trend: 1.2 },
      ];
      const speed = config.tickerSpeed === "slow" ? 20 : config.tickerSpeed === "fast" ? 8 : 12;
      return (
        <div className={cn("h-full flex items-center overflow-hidden", className)}>
          <motion.div
            className="flex gap-8 whitespace-nowrap"
            animate={{ x: [0, -1000] }}
            transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
          >
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-bold text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{formatter(typeof item.value === 'number' ? item.value : 0)}</span>
                {item.trend !== undefined && (
                  <span className={cn(
                    "text-xs font-medium",
                    item.trend > 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {item.trend > 0 ? "+" : ""}{item.trend}%
                  </span>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      );

    case "number":
      return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4", className)}>
          <motion.span
            className="text-5xl font-bold text-foreground"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {config.prefix}{typeof config.value === 'number' ? formatter(config.value) : config.value}{config.suffix}
          </motion.span>
          <p className="text-sm text-muted-foreground mt-2">{config.title}</p>
        </div>
      );

    case "map":
      return <MapWidget config={config} className={className} />;

    case "stopwatch":
      return <StopwatchWidget title={config.title} className={className} />;

    case "heatmap":
      const heatmapData = data.length > 0 ? data : [
        { day: "Mon", hour: "9am", value: 45 },
        { day: "Mon", hour: "12pm", value: 89 },
        { day: "Tue", hour: "9am", value: 67 },
        { day: "Tue", hour: "12pm", value: 92 },
      ];
      const heatmapDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const heatmapHours = ["9am", "12pm", "3pm", "6pm"];
      return (
        <div className={cn("h-full flex flex-col p-4", className)}>
          <h4 className="text-sm font-semibold text-foreground mb-3">{config.title}</h4>
          <div className="flex-1 grid grid-cols-5 gap-1">
            {heatmapDays.map(day =>
              heatmapHours.map(hour => {
                const cell = heatmapData.find(d => d.day === day && d.hour === hour);
                const intensity = cell ? (cell.value as number) / 100 : Math.random();
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="rounded aspect-square"
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${0.2 + intensity * 0.8})`
                    }}
                    title={`${day} ${hour}: ${cell?.value || 0}`}
                  />
                );
              })
            )}
          </div>
        </div>
      );

    case "radar":
      const radarData = data.length > 0 ? data : [
        { metric: "Speed", value: 85 },
        { metric: "Power", value: 72 },
        { metric: "Accuracy", value: 90 },
        { metric: "Endurance", value: 65 },
        { metric: "Agility", value: 78 },
      ];
      return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4", className)}>
          <h4 className="text-sm font-semibold text-foreground mb-4">{config.title}</h4>
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 border border-border rounded-full" />
            <div className="absolute inset-4 border border-border/60 rounded-full" />
            <div className="absolute inset-8 border border-border/30 rounded-full" />
            {radarData.map((item, i) => {
              const angle = (i / radarData.length) * 2 * Math.PI - Math.PI / 2;
              const radius = ((item.value as number) / 100) * 50;
              const x = 64 + Math.cos(angle) * radius;
              const y = 64 + Math.sin(angle) * radius;
              return (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-primary rounded-full -translate-x-1 -translate-y-1"
                  style={{ left: x, top: y }}
                  title={`${item.metric}: ${item.value}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {radarData.slice(0, 3).map((item, i) => (
              <span key={i} className="text-[10px] text-muted-foreground">{item.metric}</span>
            ))}
          </div>
        </div>
      );

    case "calendar":
      return <CalendarWidget title={config.title} className={className} />;

    case "quickStats":
      return <QuickStatsWidget items={data.length > 0 ? data as any : undefined} className={className} />;

    case "progressRing":
      return (
        <ProgressRingWidget
          value={typeof config.value === 'number' ? config.value : 50}
          target={config.target || 100}
          title={config.title}
          className={className}
        />
      );

    case "activityFeed":
      return <ActivityFeedWidget items={data.length > 0 ? data as any : undefined} className={className} />;

    case "table":
      return (
        <div className={cn("rounded-md border border-border h-full overflow-auto bg-card", className)}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">{indexField}</TableHead>
                {categories.map((c) => (
                  <TableHead key={c} className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i} className="hover:bg-primary/5 transition-colors border-border">
                  <TableCell className="font-semibold text-foreground">{row[indexField]}</TableCell>
                  {categories.map((c) => (
                    <TableCell key={c} className="text-foreground">
                      {c.toLowerCase().includes("action") || c.toLowerCase().includes("button") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] uppercase font-bold px-3 hover:bg-primary hover:text-primary-foreground transition-all"
                          onClick={() => {
                            const action = row[c + "_action"] || config.buttonAction;
                            if (action?.startsWith("/")) {
                              navigate(action);
                            } else {
                              console.log("Table row action:", action, row);
                            }
                          }}
                        >
                          {row[c] || "Action"}
                        </Button>
                      ) : (
                        typeof row[c] === "number" ? formatter(row[c]) : row[c]
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    default:
      return (
        <div className={cn("h-full flex items-center justify-center text-xs text-muted-foreground", className)}>
          Unsupported chart type: {chartType}
        </div>
      );
  }
}

export { valueFormatters };
