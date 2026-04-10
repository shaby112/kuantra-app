import { Icon } from "@/components/Icon";
import { useGlobalState } from "@/context/GlobalStateContext";
import type { DashboardConfig } from "@/types/dashboard";

const STARTER_DASHBOARD: DashboardConfig = {
  id: "dashboard-starter",
  title: "Starter Dashboard",
  widgets: [
    {
      id: "starter-arr",
      title: "ARR",
      chartType: "metric",
      data: [],
      indexField: "name",
      categories: ["value"],
      colors: ["emerald"],
      valueFormat: "currency",
      dateRange: "30d",
      aggregation: "sum",
      value: 14200000,
      trend: 12.4,
      prefix: "$",
    },
    {
      id: "starter-churn",
      title: "Net Churn",
      chartType: "metric",
      data: [],
      indexField: "name",
      categories: ["value"],
      colors: ["rose"],
      valueFormat: "percentage",
      dateRange: "30d",
      aggregation: "sum",
      value: 1.42,
      trend: -0.13,
      suffix: "%",
    },
    {
      id: "starter-latency",
      title: "P99 Latency",
      chartType: "metric",
      data: [],
      indexField: "name",
      categories: ["value"],
      colors: ["blue"],
      valueFormat: "number",
      dateRange: "30d",
      aggregation: "sum",
      value: 124,
      trend: -6.1,
      suffix: "ms",
    },
    {
      id: "starter-revenue",
      title: "Revenue Dynamics",
      chartType: "area",
      data: [
        { month: "Oct", revenue: 42000 },
        { month: "Nov", revenue: 46100 },
        { month: "Dec", revenue: 49800 },
        { month: "Jan", revenue: 53900 },
        { month: "Feb", revenue: 57700 },
        { month: "Mar", revenue: 62300 },
      ],
      indexField: "month",
      categories: ["revenue"],
      colors: ["emerald"],
      valueFormat: "currency",
      dateRange: "30d",
      aggregation: "sum",
    },
    {
      id: "starter-region",
      title: "Revenue by Region",
      chartType: "bar",
      data: [
        { region: "North America", value: 28500 },
        { region: "Europe", value: 18200 },
        { region: "APAC", value: 11400 },
        { region: "LATAM", value: 4200 },
      ],
      indexField: "region",
      categories: ["value"],
      colors: ["violet"],
      valueFormat: "currency",
      dateRange: "30d",
      aggregation: "sum",
    },
  ],
  layout: [
    { i: "starter-arr", x: 0, y: 0, w: 4, h: 2 },
    { i: "starter-churn", x: 4, y: 0, w: 4, h: 2 },
    { i: "starter-latency", x: 8, y: 0, w: 4, h: 2 },
    { i: "starter-revenue", x: 0, y: 2, w: 8, h: 4 },
    { i: "starter-region", x: 8, y: 2, w: 4, h: 4 },
  ],
  isPublic: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function DashboardSplitView() {
  const { setDashboard } = useGlobalState();

  const handleLoadStarter = () => {
    setDashboard({ ...STARTER_DASHBOARD, id: `dashboard-${Date.now()}` });
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[560px] p-8">
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-obsidian-surface-low border border-obsidian-outline-variant/15">
          <Icon name="dashboard_customize" size="lg" className="text-obsidian-primary" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-obsidian-on-surface">Build Your Dashboard</h2>
          <p className="text-sm text-obsidian-on-surface-variant leading-relaxed">
            Use the <strong>AI chat</strong> on the left to generate a dashboard from your data,
            or pick widgets from the <strong>library</strong> on the right.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            onClick={handleLoadStarter}
            className="flex items-center gap-2 h-11 px-6 rounded-lg bg-obsidian-primary-container text-obsidian-surface font-bold text-sm hover:bg-obsidian-primary transition-colors"
          >
            <Icon name="auto_awesome" size="sm" />
            Load Starter Dashboard
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-obsidian-outline-variant/15 bg-obsidian-surface-lowest/70 p-4 text-xs text-obsidian-on-surface-variant max-w-sm">
          <strong className="text-obsidian-on-surface">Tip:</strong> Drag widgets by their handle to reposition. Resize from the bottom-right corner.
          Click the SQL button on any widget to view or edit its query.
        </div>
      </div>
    </div>
  );
}
