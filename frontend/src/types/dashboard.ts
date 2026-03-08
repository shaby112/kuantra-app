// ============= Chart Types =============
export type ChartType =
  // Core Charts
  | "line" | "bar" | "area" | "donut" | "table" | "metric" | "progress" | "sparkline" | "gauge" | "text" | "image" | "kpi"
  // Advanced Visualizations
  | "funnel" | "heatmap" | "treemap" | "radar" | "scatter" | "waterfall" | "sankey" | "bubble"
  // Geographic
  | "map" | "choropleth"
  // UI Components
  | "button" | "colorBlock" | "divider" | "header" | "list" | "stat" | "timeline" | "countdown" | "stopwatch"
  // Interactive
  | "filter" | "dateSelector" | "dropdown" | "toggle" | "slider" | "tabs"
  // Data Display
  | "number" | "comparison" | "leaderboard" | "calendar" | "ticker" | "container"
  // Innovative Widgets
  | "quickStats" | "progressRing" | "activityFeed";

export type ValueFormat = "currency" | "number" | "percentage" | "compact" | "duration";

export type DateRange = "7d" | "14d" | "30d" | "90d" | "365d" | "custom" | "ytd" | "mtd";

export type AggregationMethod = "sum" | "average" | "count" | "min" | "max" | "median" | "none";

export type ColorScheme =
  | "default" | "ocean" | "forest" | "sunset" | "midnight" | "lavender" | "coral"
  | "neon" | "earth" | "monochrome" | "pastel" | "vibrant" | "corporate" | "tropical"
  | "ruby" | "sapphire" | "emerald" | "amethyst" | "gold" | "slate" | "crimson" | "arctic";

export type DashboardTheme = "light" | "dark" | "system";

export interface WidgetConfig {
  id: string;
  title: string;
  chartType: ChartType;
  data: Record<string, any>[];
  indexField: string;
  categories: string[];
  colors: string[];
  valueFormat: ValueFormat;
  dateRange: DateRange;
  aggregation: AggregationMethod;
  sql_query?: string;
  connectionId?: string;
  errorMessage?: string;
  // Additional fields for widget types
  value?: number | string;
  target?: number;
  prefix?: string;
  suffix?: string;
  trend?: number;
  imageUrl?: string;
  textContent?: string;
  sparklineData?: number[];
  // New fields for advanced widgets
  buttonLabel?: string;
  buttonAction?: string;
  buttonVariant?: "primary" | "secondary" | "outline" | "destructive";
  backgroundColor?: string;
  borderRadius?: number;
  funnelStages?: { name: string; value: number; color?: string }[];
  mapData?: { region: string; value: number; lat?: number; lng?: number }[];
  listItems?: { label: string; value: string | number; icon?: string; trend?: number }[];
  timelineEvents?: { date: string; title: string; description?: string }[];
  countdownTarget?: string;
  comparisonValue?: number;
  comparisonLabel?: string;
  headerLevel?: 1 | 2 | 3;
  headerAlign?: "left" | "center" | "right";
  tickerSpeed?: "slow" | "normal" | "fast";
  filterOptions?: { label: string; value: string }[];
  selectedFilter?: string;
  icon?: string;
  showBorder?: boolean;
  showBackground?: boolean;
  animate?: boolean;
  isContainer?: boolean;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardConfig {
  id: string;
  title: string;
  widgets: WidgetConfig[];
  layout: LayoutItem[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  colorScheme?: ColorScheme;
  theme?: DashboardTheme;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

export interface DashboardPlanWidget {
  title: string;
  chartType: string;
  metric: string;
}

export interface DashboardPlan {
  title: string;
  description?: string;
  widgets?: DashboardPlanWidget[];
  metrics: { name: string; aggregation: string; sql_column: string }[];
  dimensions: string[];
  time_range: string;
  visualizations: {
    type: ChartType;
    metrics: string[];
    breakdown?: string;
    grid_position?: { x: number; y: number; w: number; h: number };
  }[];
}

export interface PlanningResponse {
  status: "clarifying" | "ready";
  question?: string;
  plan?: DashboardPlan;
}

export interface DashboardOut {
  id: string;
  title: string;
  config: {
    widgets: {
      id: string;
      type: string;
      title: string;
      data: Record<string, any>[];
      index: string;
      categories: string[];
      colors?: string[];
      valueFormatter?: string;
      gridPosition: { x: number; y: number; w: number; h: number };
    }[];
  };
  created_at: string;
  updated_at: string;
  widget_status?: Array<{ widget_id: string; status: "ok" | "error"; error?: string; sql?: string }>;
}

export interface SavedDashboard {
  id: string;
  title: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  widgetCount: number;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  config: DashboardConfig;
}
