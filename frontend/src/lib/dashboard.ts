import { apiFetch } from "@/lib/api";
import type { DashboardConfig, DashboardPlan, WidgetConfig, LayoutItem, DashboardOut } from "@/types/dashboard";

// Mock data generators for demo purposes
const generateMockData = (type: string, count: number = 7) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const data: Record<string, any>[] = [];

  for (let i = 0; i < count; i++) {
    const base: Record<string, any> = { month: months[i % 12] };

    if (type === "revenue") {
      base.revenue = Math.floor(Math.random() * 50000) + 30000;
      base.target = Math.floor(Math.random() * 40000) + 35000;
    } else if (type === "users") {
      base.active = Math.floor(Math.random() * 1000) + 500;
      base.new = Math.floor(Math.random() * 300) + 100;
    } else if (type === "traffic") {
      base.visits = Math.floor(Math.random() * 10000) + 5000;
      base.unique = Math.floor(Math.random() * 7000) + 3000;
    } else if (type === "conversion") {
      base.rate = Math.floor(Math.random() * 15) + 5;
    } else if (type === "sales") {
      base.category = ["Electronics", "Clothing", "Food", "Books", "Sports"][i % 5];
      base.amount = Math.floor(Math.random() * 20000) + 5000;
    } else {
      base.value = Math.floor(Math.random() * 1000) + 100;
    }

    data.push(base);
  }

  return data;
};

const chartColors = [
  "rose",
  "amber",
  "emerald",
  "blue",
  "violet",
  "cyan",
  "pink",
  "orange",
];

export const createWidgetFromPlan = (
  widget: { title: string; chartType: string; metric: string },
  index: number
): WidgetConfig => {
  const data = generateMockData(widget.metric.toLowerCase());
  const categories = Object.keys(data[0]).filter(k => k !== "month" && k !== "category");

  return {
    id: `widget-${Date.now()}-${index}`,
    title: widget.title,
    chartType: widget.chartType as any,
    data,
    indexField: data[0].month ? "month" : "category",
    categories,
    colors: chartColors.slice(0, categories.length),
    valueFormat: widget.metric.toLowerCase().includes("rate") ? "percentage" : "number",
    dateRange: "30d",
    aggregation: "sum",
  };
};

export const generateDefaultLayout = (widgets: WidgetConfig[]): LayoutItem[] => {
  return widgets.map((widget, index) => ({
    i: widget.id,
    x: (index % 2) * 6,
    y: Math.floor(index / 2) * 4,
    w: 6,
    h: 4,
    minW: 3,
    minH: 3,
  }));
};

// Demo dashboard plans
export const DEMO_PLANS: DashboardPlan[] = [
  {
    title: "Marketing Dashboard",
    metrics: [{ name: "traffic", aggregation: "sum", sql_column: "visits" }],
    dimensions: ["month"],
    time_range: "30d",
    visualizations: [
      { type: "area", metrics: ["traffic"] },
      { type: "line", metrics: ["conversion"] },
      { type: "bar", metrics: ["users"] },
      { type: "donut", metrics: ["sales"] },
    ],
    widgets: [
      { title: "Monthly Traffic", chartType: "area", metric: "traffic" },
      { title: "Conversion Rate", chartType: "line", metric: "conversion" },
      { title: "User Acquisition", chartType: "bar", metric: "users" },
      { title: "Revenue by Channel", chartType: "donut", metric: "sales" },
    ],
  },
  {
    title: "Sales Dashboard",
    metrics: [{ name: "revenue", aggregation: "sum", sql_column: "amount" }],
    dimensions: ["month"],
    time_range: "30d",
    visualizations: [
      { type: "area", metrics: ["revenue"] },
      { type: "bar", metrics: ["sales"] },
      { type: "line", metrics: ["revenue"] },
      { type: "donut", metrics: ["sales"] },
    ],
    widgets: [
      { title: "Revenue Trend", chartType: "area", metric: "revenue" },
      { title: "Sales by Category", chartType: "bar", metric: "sales" },
      { title: "Monthly Growth", chartType: "line", metric: "revenue" },
      { title: "Top Products", chartType: "donut", metric: "sales" },
    ],
  },
  {
    title: "User Analytics",
    metrics: [{ name: "users", aggregation: "count", sql_column: "user_id" }],
    dimensions: ["month"],
    time_range: "30d",
    visualizations: [
      { type: "area", metrics: ["users"] },
      { type: "line", metrics: ["users"] },
      { type: "bar", metrics: ["traffic"] },
      { type: "donut", metrics: ["users"] },
    ],
    widgets: [
      { title: "Active Users", chartType: "area", metric: "users" },
      { title: "User Growth", chartType: "line", metric: "users" },
      { title: "Engagement by Day", chartType: "bar", metric: "traffic" },
      { title: "User Segments", chartType: "donut", metric: "users" },
    ],
  },
];

export const getDashboardPlanFromMessage = (message: string): DashboardPlan | null => {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("marketing")) {
    return DEMO_PLANS[0];
  } else if (lowerMessage.includes("sales") || lowerMessage.includes("revenue")) {
    return DEMO_PLANS[1];
  } else if (lowerMessage.includes("user") || lowerMessage.includes("analytics")) {
    return DEMO_PLANS[2];
  }

  return null;
};

// API functions (real backend integration)
export async function saveDashboard(dashboard: DashboardConfig): Promise<DashboardOut> {
  const isNew = !dashboard.id || dashboard.id.startsWith("dashboard-");

  const payload = {
    title: dashboard.title,
    config: {
      widgets: dashboard.widgets.map(w => {
        const layoutItem = dashboard.layout.find(l => l.i === w.id);
        return {
          id: w.id,
          type: w.chartType,
          title: w.title,
          data: w.data,
          index: w.indexField,
          categories: w.categories,
          colors: w.colors,
          valueFormatter: w.valueFormat,
          gridPosition: {
            x: layoutItem?.x || 0,
            y: layoutItem?.y || 0,
            w: layoutItem?.w || 6,
            h: layoutItem?.h || 4
          }
        };
      })
    }
  };

  if (isNew) {
    return apiFetch<DashboardOut>("/api/v1/dashboards/", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: true
    });
  } else {
    return apiFetch<DashboardOut>(`/api/v1/dashboards/${dashboard.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      auth: true
    });
  }
}

export async function loadDashboard(id: string): Promise<DashboardConfig | null> {
  const data = await apiFetch<DashboardOut>(`/api/v1/dashboards/${id}`, { auth: true });

  return {
    id: data.id.toString(),
    title: data.title,
    widgets: data.config.widgets.map(w => ({
      id: w.id,
      title: w.title,
      chartType: w.type as any,
      data: w.data,
      indexField: w.index,
      categories: w.categories,
      colors: w.colors || ["violet"],
      valueFormat: (w.valueFormatter as any) || "number",
      dateRange: "30d",
      aggregation: "sum"
    })),
    layout: data.config.widgets.map(w => ({
      i: w.id,
      x: w.gridPosition.x,
      y: w.gridPosition.y,
      w: w.gridPosition.w,
      h: w.gridPosition.h
    })),
    isPublic: false,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function getDashboards(): Promise<DashboardConfig[]> {
  const list = await apiFetch<DashboardOut[]>("/api/v1/dashboards/", { auth: true });
  return list.map(data => ({
    id: data.id.toString(),
    title: data.title,
    widgets: data.config.widgets.map(w => ({
      id: w.id,
      title: w.title,
      chartType: w.type as any,
      data: w.data,
      indexField: w.index,
      categories: w.categories,
      colors: w.colors || ["violet"],
      valueFormat: (w.valueFormatter as any) || "number",
      dateRange: "30d",
      aggregation: "sum"
    })),
    layout: data.config.widgets.map(w => ({
      i: w.id,
      x: w.gridPosition.x,
      y: w.gridPosition.y,
      w: w.gridPosition.w,
      h: w.gridPosition.h
    })),
    isPublic: false,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }));
}

export async function deleteDashboard(id: string): Promise<void> {
  await apiFetch(`/api/v1/dashboards/${id}`, {
    method: "DELETE",
    auth: true
  });
}

export async function exportDashboardAsJSON(dashboard: DashboardConfig): Promise<void> {
  const dataStr = JSON.stringify(dashboard, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${dashboard.title.replace(/\s+/g, "-").toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportDashboardAsCSV(dashboard: DashboardConfig): Promise<void> {
  const allData = dashboard.widgets.flatMap(w =>
    w.data.map(row => ({ widget: w.title, ...row }))
  );

  if (allData.length === 0) return;

  const headers = Object.keys(allData[0]);
  const csvContent = [
    headers.join(","),
    ...allData.map(row => headers.map(h => row[h]).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${dashboard.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
