import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, LayoutDashboard, TrendingUp, Users, ShoppingCart, Activity, BarChart3, Globe, Zap, Heart, Clock } from "lucide-react";
import type { DashboardConfig, DashboardTemplate, ColorScheme } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateStoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (config: DashboardConfig) => void;
}

const TEMPLATES: DashboardTemplate[] = [
  {
    id: "marketing",
    name: "Marketing Dashboard",
    description: "Track campaigns, traffic sources, and conversion metrics",
    category: "Marketing",
    thumbnail: "📊",
    config: {
      id: "template-marketing",
      title: "Marketing Dashboard",
      colorScheme: "coral",
      widgets: [
        { id: "w1", title: "Website Traffic", chartType: "area", data: [{ month: "Jan", visits: 4500 }, { month: "Feb", visits: 5200 }, { month: "Mar", visits: 4800 }, { month: "Apr", visits: 6200 }], indexField: "month", categories: ["visits"], colors: ["rose"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w2", title: "Conversion Rate", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 3.2, trend: 12.5, suffix: "%" },
        { id: "w3", title: "Campaign Performance", chartType: "bar", data: [{ campaign: "Email", conversions: 1200 }, { campaign: "Social", conversions: 800 }, { campaign: "PPC", conversions: 1500 }], indexField: "campaign", categories: ["conversions"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w4", title: "Traffic Sources", chartType: "donut", data: [{ source: "Organic", value: 45 }, { source: "Direct", value: 25 }, { source: "Referral", value: 30 }], indexField: "source", categories: ["value"], colors: ["rose", "amber", "emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "User Funnel", chartType: "funnel", data: [], indexField: "name", categories: ["value"], colors: ["rose"], valueFormat: "number", dateRange: "30d", aggregation: "sum", funnelStages: [{ name: "Visitors", value: 10000 }, { name: "Leads", value: 5000 }, { name: "MQLs", value: 2500 }, { name: "Customers", value: 800 }] },
        { id: "w6", title: "Activity", chartType: "activityFeed", data: [], indexField: "name", categories: ["value"], colors: ["rose"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 8, h: 4 },
        { i: "w2", x: 8, y: 0, w: 4, h: 2 },
        { i: "w3", x: 0, y: 4, w: 6, h: 4 },
        { i: "w4", x: 6, y: 4, w: 6, h: 4 },
        { i: "w5", x: 8, y: 2, w: 4, h: 4 },
        { i: "w6", x: 0, y: 8, w: 4, h: 4 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "sales",
    name: "Sales Dashboard",
    description: "Monitor revenue, deals, and sales team performance",
    category: "Sales",
    thumbnail: "💰",
    config: {
      id: "template-sales",
      title: "Sales Dashboard",
      colorScheme: "ocean",
      widgets: [
        { id: "w1", title: "Total Revenue", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 125000, trend: 8.3, prefix: "$" },
        { id: "w2", title: "Deals Closed", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 47, trend: 15.2 },
        { id: "w3", title: "Revenue Trend", chartType: "area", data: [{ month: "Jan", revenue: 95000 }, { month: "Feb", revenue: 105000 }, { month: "Mar", revenue: 125000 }], indexField: "month", categories: ["revenue"], colors: ["emerald"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w4", title: "Sales by Region", chartType: "bar", data: [{ region: "North", sales: 45000 }, { region: "South", sales: 35000 }, { region: "East", sales: 28000 }, { region: "West", sales: 17000 }], indexField: "region", categories: ["sales"], colors: ["blue"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "Top Salespeople", chartType: "leaderboard", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", listItems: [{ label: "Alex Johnson", value: 45000, trend: 12 }, { label: "Sarah Smith", value: 38000, trend: 8 }, { label: "Mike Brown", value: 32000, trend: -2 }] },
        { id: "w6", title: "Sales Target", chartType: "progressRing", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 78, target: 100 },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 },
        { i: "w2", x: 3, y: 0, w: 3, h: 2 },
        { i: "w3", x: 6, y: 0, w: 6, h: 4 },
        { i: "w4", x: 0, y: 2, w: 6, h: 4 },
        { i: "w5", x: 0, y: 6, w: 6, h: 4 },
        { i: "w6", x: 6, y: 4, w: 3, h: 3 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "analytics",
    name: "User Analytics",
    description: "Track user behavior, engagement, and retention metrics",
    category: "Analytics",
    thumbnail: "👥",
    config: {
      id: "template-analytics",
      title: "User Analytics",
      colorScheme: "midnight",
      widgets: [
        { id: "w1", title: "Active Users", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 12450, trend: 5.7 },
        { id: "w2", title: "Session Duration", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["purple"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 4.2, suffix: " min", trend: 3.1 },
        { id: "w3", title: "User Growth", chartType: "line", data: [{ week: "W1", users: 10200 }, { week: "W2", users: 10800 }, { week: "W3", users: 11500 }, { week: "W4", users: 12450 }], indexField: "week", categories: ["users"], colors: ["indigo"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w4", title: "Retention Rate", chartType: "progress", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 78, target: 100 },
        { id: "w5", title: "Engagement Heatmap", chartType: "heatmap", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Quick Stats", chartType: "quickStats", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 },
        { i: "w2", x: 3, y: 0, w: 3, h: 2 },
        { i: "w3", x: 6, y: 0, w: 6, h: 4 },
        { i: "w4", x: 0, y: 2, w: 6, h: 2 },
        { i: "w5", x: 0, y: 4, w: 6, h: 4 },
        { i: "w6", x: 6, y: 4, w: 6, h: 4 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "ecommerce",
    name: "E-Commerce Dashboard",
    description: "Track orders, inventory, and customer metrics",
    category: "E-Commerce",
    thumbnail: "🛒",
    config: {
      id: "template-ecommerce",
      title: "E-Commerce Dashboard",
      colorScheme: "sunset",
      widgets: [
        { id: "w1", title: "Total Orders", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["orange"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 1847, trend: 22.4 },
        { id: "w2", title: "Average Order Value", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["amber"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 85.50, prefix: "$", trend: 4.2 },
        { id: "w3", title: "Orders by Category", chartType: "donut", data: [{ category: "Electronics", value: 35 }, { category: "Clothing", value: 28 }, { category: "Home", value: 22 }, { category: "Other", value: 15 }], indexField: "category", categories: ["value"], colors: ["orange", "amber", "yellow", "red"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w4", title: "Daily Orders", chartType: "bar", data: [{ day: "Mon", orders: 245 }, { day: "Tue", orders: 312 }, { day: "Wed", orders: 287 }, { day: "Thu", orders: 356 }, { day: "Fri", orders: 412 }], indexField: "day", categories: ["orders"], colors: ["orange"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "Checkout Funnel", chartType: "funnel", data: [], indexField: "name", categories: ["value"], colors: ["orange"], valueFormat: "number", dateRange: "30d", aggregation: "sum", funnelStages: [{ name: "Add to Cart", value: 5000 }, { name: "Checkout", value: 2500 }, { name: "Payment", value: 2000 }, { name: "Complete", value: 1847 }] },
        { id: "w6", title: "Stock Ticker", chartType: "ticker", data: [], indexField: "name", categories: ["value"], colors: ["orange"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", listItems: [{ label: "AMZN", value: 178.25, trend: 2.1 }, { label: "SHOP", value: 89.50, trend: -0.8 }] },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 },
        { i: "w2", x: 3, y: 0, w: 3, h: 2 },
        { i: "w3", x: 6, y: 0, w: 6, h: 4 },
        { i: "w4", x: 0, y: 2, w: 6, h: 4 },
        { i: "w5", x: 0, y: 6, w: 6, h: 4 },
        { i: "w6", x: 6, y: 4, w: 6, h: 2 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "operations",
    name: "Operations Dashboard",
    description: "Monitor system health, performance, and uptime",
    category: "Operations",
    thumbnail: "⚙️",
    config: {
      id: "template-operations",
      title: "Operations Dashboard",
      colorScheme: "neon",
      widgets: [
        { id: "w1", title: "System Uptime", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["lime"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 99.9, target: 100 },
        { id: "w2", title: "Response Time", chartType: "sparkline", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", sparklineData: [120, 135, 115, 142, 128, 118, 125] },
        { id: "w3", title: "Error Rate", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["rose"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 0.12, suffix: "%", trend: -8.5 },
        { id: "w4", title: "API Calls", chartType: "area", data: [{ hour: "00:00", calls: 1200 }, { hour: "06:00", calls: 2400 }, { hour: "12:00", calls: 4800 }, { hour: "18:00", calls: 3600 }], indexField: "hour", categories: ["calls"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "Server Locations", chartType: "map", data: [], indexField: "name", categories: ["value"], colors: ["lime"], valueFormat: "number", dateRange: "30d", aggregation: "sum", mapData: [{ region: "US-East", value: 5000, lat: 40.7128, lng: -74.0060 }, { region: "EU-West", value: 3200, lat: 51.5074, lng: -0.1278 }] },
        { id: "w6", title: "Deployment Timeline", chartType: "timeline", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", timelineEvents: [{ date: "Jan 15", title: "v2.1 Released" }, { date: "Feb 1", title: "Hotfix 2.1.1" }] },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 3 },
        { i: "w2", x: 3, y: 0, w: 3, h: 2 },
        { i: "w3", x: 6, y: 0, w: 3, h: 2 },
        { i: "w4", x: 0, y: 3, w: 12, h: 4 },
        { i: "w5", x: 9, y: 0, w: 3, h: 3 },
        { i: "w6", x: 0, y: 7, w: 6, h: 3 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "finance",
    name: "Financial Dashboard",
    description: "Track expenses, revenue, and financial KPIs",
    category: "Finance",
    thumbnail: "📈",
    config: {
      id: "template-finance",
      title: "Financial Dashboard",
      colorScheme: "forest",
      widgets: [
        { id: "w1", title: "Net Revenue", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 284500, prefix: "$", trend: 12.8 },
        { id: "w2", title: "Expenses", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["rose"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 156200, prefix: "$", trend: 3.2 },
        { id: "w3", title: "Profit Margin", chartType: "progressRing", data: [], indexField: "name", categories: ["value"], colors: ["green"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 45, target: 100 },
        { id: "w4", title: "Monthly P&L", chartType: "bar", data: [{ month: "Jan", revenue: 85000, expenses: 52000 }, { month: "Feb", revenue: 92000, expenses: 48000 }, { month: "Mar", revenue: 107500, expenses: 56200 }], indexField: "month", categories: ["revenue", "expenses"], colors: ["emerald", "rose"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "Budget Status", chartType: "comparison", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 284500, comparisonValue: 250000, comparisonLabel: "Budget" },
        { id: "w6", title: "Quarterly Goal", chartType: "countdown", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum", countdownTarget: new Date(Date.now() + 86400000 * 30).toISOString() },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 4, h: 2 },
        { i: "w2", x: 4, y: 0, w: 4, h: 2 },
        { i: "w3", x: 8, y: 0, w: 4, h: 3 },
        { i: "w4", x: 0, y: 2, w: 8, h: 4 },
        { i: "w5", x: 0, y: 6, w: 4, h: 3 },
        { i: "w6", x: 4, y: 6, w: 4, h: 2 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "project-management",
    name: "Project Management",
    description: "Track project progress, milestones, and team performance",
    category: "Productivity",
    thumbnail: "📋",
    config: {
      id: "template-project",
      title: "Project Management",
      colorScheme: "lavender",
      widgets: [
        { id: "w1", title: "Project Header", chartType: "header", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum", textContent: "Q1 2024 Projects" },
        { id: "w2", title: "Overall Progress", chartType: "progressRing", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 68, target: 100 },
        { id: "w3", title: "Tasks Completed", chartType: "stat", data: [], indexField: "name", categories: ["value"], colors: ["purple"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 127, trend: 15, icon: "target" },
        { id: "w4", title: "Team Activity", chartType: "activityFeed", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "Milestones", chartType: "timeline", data: [], indexField: "name", categories: ["value"], colors: ["fuchsia"], valueFormat: "number", dateRange: "30d", aggregation: "sum", timelineEvents: [{ date: "Jan 15", title: "Kickoff", description: "Project started" }, { date: "Feb 28", title: "Phase 1", description: "Design complete" }, { date: "Mar 30", title: "Launch", description: "Go live" }] },
        { id: "w6", title: "Sprint Burndown", chartType: "area", data: [{ day: "Mon", remaining: 45 }, { day: "Tue", remaining: 38 }, { day: "Wed", remaining: 30 }, { day: "Thu", remaining: 22 }, { day: "Fri", remaining: 15 }], indexField: "day", categories: ["remaining"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w7", title: "Stopwatch", chartType: "stopwatch", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 12, h: 1 },
        { i: "w2", x: 0, y: 1, w: 3, h: 3 },
        { i: "w3", x: 3, y: 1, w: 3, h: 2 },
        { i: "w4", x: 6, y: 1, w: 6, h: 4 },
        { i: "w5", x: 0, y: 4, w: 6, h: 4 },
        { i: "w6", x: 6, y: 5, w: 6, h: 3 },
        { i: "w7", x: 3, y: 3, w: 3, h: 2 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "real-time",
    name: "Real-Time Monitor",
    description: "Live monitoring with real-time data updates",
    category: "Operations",
    thumbnail: "⚡",
    config: {
      id: "template-realtime",
      title: "Real-Time Monitor",
      colorScheme: "neon",
      widgets: [
        { id: "w1", title: "Live Users", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["lime"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 1247, animate: true },
        { id: "w2", title: "Requests/sec", chartType: "sparkline", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", sparklineData: [45, 52, 48, 61, 55, 68, 72, 65, 78, 85] },
        { id: "w3", title: "Status", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["lime"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 98, target: 100 },
        { id: "w4", title: "Live Feed", chartType: "ticker", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", listItems: [{ label: "CPU", value: 42, trend: -2 }, { label: "Memory", value: 68, trend: 5 }, { label: "Disk", value: 55, trend: 0 }], tickerSpeed: "fast" },
        { id: "w5", title: "Quick Stats", chartType: "quickStats", data: [], indexField: "name", categories: ["value"], colors: ["lime"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Traffic Map", chartType: "map", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", mapData: [{ region: "NYC", value: 2500, lat: 40.7128, lng: -74.006 }, { region: "LA", value: 1800, lat: 34.0522, lng: -118.2437 }, { region: "Chicago", value: 1200, lat: 41.8781, lng: -87.6298 }] },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 },
        { i: "w2", x: 3, y: 0, w: 3, h: 2 },
        { i: "w3", x: 6, y: 0, w: 3, h: 3 },
        { i: "w4", x: 0, y: 2, w: 6, h: 1 },
        { i: "w5", x: 0, y: 3, w: 6, h: 4 },
        { i: "w6", x: 6, y: 3, w: 6, h: 4 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "executive",
    name: "Executive Summary",
    description: "High-level KPIs and metrics for leadership",
    category: "Executive",
    thumbnail: "👔",
    config: {
      id: "template-executive",
      title: "Executive Summary",
      colorScheme: "corporate",
      widgets: [
        { id: "w1", title: "Company Overview", chartType: "header", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum", textContent: "2024 Performance Dashboard", headerLevel: 1, headerAlign: "center" },
        { id: "w2", title: "Revenue", chartType: "comparison", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 4250000, comparisonValue: 3800000, comparisonLabel: "Last Year", prefix: "$" },
        { id: "w3", title: "Customers", chartType: "stat", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 12847, trend: 18.5, icon: "users" },
        { id: "w4", title: "NPS Score", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["amber"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 72, target: 100 },
        { id: "w5", title: "Revenue Growth", chartType: "area", data: [{ quarter: "Q1", revenue: 850000 }, { quarter: "Q2", revenue: 980000 }, { quarter: "Q3", revenue: 1120000 }, { quarter: "Q4", revenue: 1300000 }], indexField: "quarter", categories: ["revenue"], colors: ["blue"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Department Performance", chartType: "radar", data: [{ metric: "Sales", value: 85 }, { metric: "Marketing", value: 78 }, { metric: "Product", value: 92 }, { metric: "Support", value: 88 }, { metric: "Engineering", value: 95 }], indexField: "metric", categories: ["value"], colors: ["indigo"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w7", title: "Key Metrics", chartType: "list", data: [], indexField: "name", categories: ["value"], colors: ["slate"], valueFormat: "number", dateRange: "30d", aggregation: "sum", listItems: [{ label: "ARR", value: "$5.1M" }, { label: "MRR Growth", value: "12.5%" }, { label: "Churn Rate", value: "2.3%" }, { label: "LTV", value: "$4,800" }] },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 12, h: 1 },
        { i: "w2", x: 0, y: 1, w: 4, h: 3 },
        { i: "w3", x: 4, y: 1, w: 4, h: 2 },
        { i: "w4", x: 8, y: 1, w: 4, h: 3 },
        { i: "w5", x: 0, y: 4, w: 8, h: 4 },
        { i: "w6", x: 8, y: 4, w: 4, h: 4 },
        { i: "w7", x: 4, y: 3, w: 4, h: 3 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "social-media",
    name: "Social Media Analytics",
    description: "Track social engagement, followers, and content performance",
    category: "Marketing",
    thumbnail: "📱",
    config: {
      id: "template-social",
      title: "Social Media Analytics",
      colorScheme: "tropical",
      widgets: [
        { id: "w1", title: "Total Followers", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["teal"], valueFormat: "compact", dateRange: "30d", aggregation: "sum", value: 125400, prefix: "" },
        { id: "w2", title: "Engagement Rate", chartType: "progressRing", data: [], indexField: "name", categories: ["value"], colors: ["pink"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 4.8, target: 10 },
        { id: "w3", title: "Post Performance", chartType: "bar", data: [{ platform: "Instagram", engagement: 5200 }, { platform: "Twitter", engagement: 3100 }, { platform: "LinkedIn", engagement: 2800 }, { platform: "TikTok", engagement: 8500 }], indexField: "platform", categories: ["engagement"], colors: ["teal"], valueFormat: "compact", dateRange: "30d", aggregation: "sum" },
        { id: "w4", title: "Follower Growth", chartType: "area", data: [{ week: "W1", followers: 120000 }, { week: "W2", followers: 121500 }, { week: "W3", followers: 123200 }, { week: "W4", followers: 125400 }], indexField: "week", categories: ["followers"], colors: ["pink"], valueFormat: "compact", dateRange: "30d", aggregation: "sum" },
        { id: "w5", title: "Top Posts", chartType: "leaderboard", data: [], indexField: "name", categories: ["value"], colors: ["orange"], valueFormat: "compact", dateRange: "30d", aggregation: "sum", listItems: [{ label: "Product Launch Video", value: 45200, trend: 25 }, { label: "Behind the Scenes", value: 32100, trend: 15 }, { label: "Customer Story", value: 28400, trend: 8 }] },
        { id: "w6", title: "Content Calendar", chartType: "calendar", data: [], indexField: "name", categories: ["value"], colors: ["lime"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 },
        { i: "w2", x: 3, y: 0, w: 3, h: 3 },
        { i: "w3", x: 6, y: 0, w: 6, h: 4 },
        { i: "w4", x: 0, y: 2, w: 6, h: 4 },
        { i: "w5", x: 0, y: 6, w: 6, h: 4 },
        { i: "w6", x: 6, y: 4, w: 6, h: 4 },
      ],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "saas-metrics",
    name: "SaaS Metrics",
    description: "Track MRR, churn, LTV, CAC, and subscription health",
    category: "SaaS",
    thumbnail: "🚀",
    config: {
      id: "template-saas",
      title: "SaaS Metrics Dashboard",
      colorScheme: "sapphire",
      widgets: [
        { id: "w1", title: "Monthly Recurring Revenue", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 284500, prefix: "$" },
        { id: "w2", title: "Active Subscriptions", chartType: "stat", data: [], indexField: "name", categories: ["value"], colors: ["indigo"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 3847, trend: 6.2, icon: "users" },
        { id: "w3", title: "Monthly Churn Rate", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["rose"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 2.1, suffix: "%", trend: -0.3 },
        { id: "w4", title: "Customer LTV", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 4800, prefix: "$", trend: 8.5 },
        { id: "w5", title: "MRR Growth", chartType: "area", data: [{ month: "Oct", mrr: 215000 }, { month: "Nov", mrr: 238000 }, { month: "Dec", mrr: 255000 }, { month: "Jan", mrr: 268000 }, { month: "Feb", mrr: 276000 }, { month: "Mar", mrr: 284500 }], indexField: "month", categories: ["mrr"], colors: ["blue"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Revenue by Plan", chartType: "donut", data: [{ plan: "Starter", value: 42000 }, { plan: "Professional", value: 128000 }, { plan: "Enterprise", value: 114500 }], indexField: "plan", categories: ["value"], colors: ["blue", "indigo", "violet"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w7", title: "CAC vs LTV", chartType: "bar", data: [{ segment: "SMB", cac: 120, ltv: 2400 }, { segment: "Mid-Market", cac: 850, ltv: 12000 }, { segment: "Enterprise", cac: 3500, ltv: 48000 }], indexField: "segment", categories: ["cac", "ltv"], colors: ["rose", "emerald"], valueFormat: "currency", dateRange: "30d", aggregation: "sum" },
        { id: "w8", title: "Trial to Paid Conversion", chartType: "funnel", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum", funnelStages: [{ name: "Signups", value: 2400 }, { name: "Activated", value: 1680 }, { name: "Trial End", value: 960 }, { name: "Converted", value: 576 }] },
        { id: "w9", title: "Net Revenue Retention", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 112, target: 150 },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 }, { i: "w2", x: 3, y: 0, w: 3, h: 2 }, { i: "w3", x: 6, y: 0, w: 3, h: 2 }, { i: "w4", x: 9, y: 0, w: 3, h: 2 },
        { i: "w5", x: 0, y: 2, w: 8, h: 4 }, { i: "w6", x: 8, y: 2, w: 4, h: 4 },
        { i: "w7", x: 0, y: 6, w: 6, h: 4 }, { i: "w8", x: 6, y: 6, w: 3, h: 4 }, { i: "w9", x: 9, y: 6, w: 3, h: 3 },
      ],
      isPublic: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "customer-support",
    name: "Customer Support",
    description: "Track tickets, response times, CSAT, and agent performance",
    category: "Support",
    thumbnail: "🎧",
    config: {
      id: "template-support",
      title: "Customer Support Dashboard",
      colorScheme: "emerald",
      widgets: [
        { id: "w1", title: "Open Tickets", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["amber"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 147, trend: -12.3 },
        { id: "w2", title: "Avg Response Time", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 2.4, suffix: " hrs", trend: -15.0 },
        { id: "w3", title: "CSAT Score", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 92, target: 100 },
        { id: "w4", title: "First Contact Resolution", chartType: "progressRing", data: [], indexField: "name", categories: ["value"], colors: ["teal"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 78, target: 100 },
        { id: "w5", title: "Tickets by Category", chartType: "donut", data: [{ category: "Bug Report", value: 45 }, { category: "Feature Request", value: 22 }, { category: "Billing", value: 18 }, { category: "How-to", value: 15 }], indexField: "category", categories: ["value"], colors: ["emerald", "blue", "amber", "violet"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Daily Ticket Volume", chartType: "bar", data: [{ day: "Mon", opened: 42, resolved: 38 }, { day: "Tue", opened: 35, resolved: 40 }, { day: "Wed", opened: 48, resolved: 45 }, { day: "Thu", opened: 30, resolved: 35 }, { day: "Fri", opened: 28, resolved: 32 }], indexField: "day", categories: ["opened", "resolved"], colors: ["amber", "emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w7", title: "Agent Leaderboard", chartType: "leaderboard", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum", listItems: [{ label: "Maria G.", value: 156, trend: 18 }, { label: "James T.", value: 142, trend: 12 }, { label: "Aisha P.", value: 128, trend: 5 }, { label: "Carlos R.", value: 115, trend: -2 }] },
        { id: "w8", title: "Resolution Time Trend", chartType: "line", data: [{ week: "W1", hours: 4.2 }, { week: "W2", hours: 3.8 }, { week: "W3", hours: 3.1 }, { week: "W4", hours: 2.4 }], indexField: "week", categories: ["hours"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 }, { i: "w2", x: 3, y: 0, w: 3, h: 2 }, { i: "w3", x: 6, y: 0, w: 3, h: 3 }, { i: "w4", x: 9, y: 0, w: 3, h: 3 },
        { i: "w5", x: 0, y: 2, w: 6, h: 4 }, { i: "w6", x: 6, y: 3, w: 6, h: 4 },
        { i: "w7", x: 0, y: 6, w: 6, h: 4 }, { i: "w8", x: 6, y: 7, w: 6, h: 3 },
      ],
      isPublic: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "hr-people",
    name: "HR & People Analytics",
    description: "Track headcount, hiring pipeline, diversity, and employee satisfaction",
    category: "HR",
    thumbnail: "👥",
    config: {
      id: "template-hr",
      title: "HR & People Analytics",
      colorScheme: "lavender",
      widgets: [
        { id: "w1", title: "Total Headcount", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 342, trend: 4.8 },
        { id: "w2", title: "Open Positions", chartType: "stat", data: [], indexField: "name", categories: ["value"], colors: ["amber"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 28, trend: 12, icon: "briefcase" },
        { id: "w3", title: "Avg Tenure (years)", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 3.2, trend: 5.0 },
        { id: "w4", title: "eNPS Score", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 42, target: 100 },
        { id: "w5", title: "Headcount by Department", chartType: "bar", data: [{ dept: "Engineering", count: 98 }, { dept: "Sales", count: 65 }, { dept: "Marketing", count: 42 }, { dept: "Operations", count: 55 }, { dept: "HR", count: 22 }, { dept: "Finance", count: 30 }, { dept: "Product", count: 30 }], indexField: "dept", categories: ["count"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Hiring Pipeline", chartType: "funnel", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum", funnelStages: [{ name: "Applied", value: 1200 }, { name: "Screened", value: 480 }, { name: "Interview", value: 192 }, { name: "Offer", value: 48 }, { name: "Hired", value: 36 }] },
        { id: "w7", title: "Attrition Rate Trend", chartType: "area", data: [{ quarter: "Q1 '23", rate: 4.2 }, { quarter: "Q2 '23", rate: 3.8 }, { quarter: "Q3 '23", rate: 3.5 }, { quarter: "Q4 '23", rate: 3.1 }, { quarter: "Q1 '24", rate: 2.8 }], indexField: "quarter", categories: ["rate"], colors: ["rose"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w8", title: "Gender Distribution", chartType: "donut", data: [{ gender: "Female", value: 48 }, { gender: "Male", value: 46 }, { gender: "Non-Binary", value: 6 }], indexField: "gender", categories: ["value"], colors: ["violet", "blue", "emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w9", title: "Time to Hire", chartType: "comparison", data: [], indexField: "name", categories: ["value"], colors: ["violet"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 32, comparisonValue: 45, comparisonLabel: "Industry Avg", suffix: " days" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 }, { i: "w2", x: 3, y: 0, w: 3, h: 2 }, { i: "w3", x: 6, y: 0, w: 3, h: 2 }, { i: "w4", x: 9, y: 0, w: 3, h: 3 },
        { i: "w5", x: 0, y: 2, w: 6, h: 4 }, { i: "w6", x: 6, y: 2, w: 3, h: 4 },
        { i: "w7", x: 0, y: 6, w: 6, h: 4 }, { i: "w8", x: 6, y: 6, w: 4, h: 4 }, { i: "w9", x: 10, y: 6, w: 2, h: 3 },
      ],
      isPublic: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "logistics",
    name: "Logistics & Supply Chain",
    description: "Track shipments, delivery times, inventory levels, and fleet performance",
    category: "Logistics",
    thumbnail: "🚛",
    config: {
      id: "template-logistics",
      title: "Logistics & Supply Chain",
      colorScheme: "ocean",
      widgets: [
        { id: "w1", title: "Active Shipments", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 1247, trend: 8.4 },
        { id: "w2", title: "On-Time Delivery", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 94.7, target: 100 },
        { id: "w3", title: "Avg Delivery Time", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 3.2, suffix: " days", trend: -8.5 },
        { id: "w4", title: "Shipment Cost", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["amber"], valueFormat: "currency", dateRange: "30d", aggregation: "sum", value: 156200, prefix: "$", trend: 2.1 },
        { id: "w5", title: "Volume by Region", chartType: "bar", data: [{ region: "North America", shipments: 520 }, { region: "Europe", shipments: 380 }, { region: "Asia Pacific", shipments: 210 }, { region: "Latin America", shipments: 137 }], indexField: "region", categories: ["shipments"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Delivery Status", chartType: "donut", data: [{ status: "Delivered", value: 62 }, { status: "In Transit", value: 25 }, { status: "Processing", value: 8 }, { status: "Delayed", value: 5 }], indexField: "status", categories: ["value"], colors: ["emerald", "blue", "amber", "rose"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w7", title: "Monthly Volume Trend", chartType: "area", data: [{ month: "Oct", volume: 980 }, { month: "Nov", volume: 1050 }, { month: "Dec", volume: 1320 }, { month: "Jan", volume: 1100 }, { month: "Feb", volume: 1180 }, { month: "Mar", volume: 1247 }], indexField: "month", categories: ["volume"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w8", title: "Warehouse Inventory", chartType: "progress", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 72, target: 100 },
        { id: "w9", title: "Fleet Locations", chartType: "map", data: [], indexField: "name", categories: ["value"], colors: ["cyan"], valueFormat: "number", dateRange: "30d", aggregation: "sum", mapData: [{ region: "Chicago Hub", value: 85, lat: 41.8781, lng: -87.6298 }, { region: "LA Port", value: 120, lat: 33.7405, lng: -118.2716 }, { region: "NYC Warehouse", value: 65, lat: 40.7128, lng: -74.006 }] },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 }, { i: "w2", x: 3, y: 0, w: 3, h: 3 }, { i: "w3", x: 6, y: 0, w: 3, h: 2 }, { i: "w4", x: 9, y: 0, w: 3, h: 2 },
        { i: "w5", x: 0, y: 2, w: 6, h: 4 }, { i: "w6", x: 6, y: 2, w: 6, h: 4 },
        { i: "w7", x: 0, y: 6, w: 8, h: 4 }, { i: "w8", x: 8, y: 6, w: 4, h: 2 }, { i: "w9", x: 8, y: 8, w: 4, h: 4 },
      ],
      isPublic: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "healthcare",
    name: "Healthcare Analytics",
    description: "Track patient volume, wait times, bed occupancy, and outcomes",
    category: "Healthcare",
    thumbnail: "🏥",
    config: {
      id: "template-healthcare",
      title: "Healthcare Analytics",
      colorScheme: "emerald",
      widgets: [
        { id: "w1", title: "Patient Volume Today", chartType: "number", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 342, trend: 5.2 },
        { id: "w2", title: "Avg Wait Time", chartType: "metric", data: [], indexField: "name", categories: ["value"], colors: ["amber"], valueFormat: "number", dateRange: "30d", aggregation: "sum", value: 18, suffix: " min", trend: -12.0 },
        { id: "w3", title: "Bed Occupancy", chartType: "gauge", data: [], indexField: "name", categories: ["value"], colors: ["blue"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 87, target: 100 },
        { id: "w4", title: "Patient Satisfaction", chartType: "progressRing", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 91, target: 100 },
        { id: "w5", title: "Admissions by Department", chartType: "bar", data: [{ dept: "Emergency", patients: 128 }, { dept: "Cardiology", patients: 52 }, { dept: "Orthopedics", patients: 38 }, { dept: "Pediatrics", patients: 45 }, { dept: "Oncology", patients: 32 }, { dept: "Neurology", patients: 28 }], indexField: "dept", categories: ["patients"], colors: ["emerald"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w6", title: "Monthly Patient Trend", chartType: "area", data: [{ month: "Oct", patients: 8200 }, { month: "Nov", patients: 8800 }, { month: "Dec", patients: 9500 }, { month: "Jan", patients: 9100 }, { month: "Feb", patients: 8700 }, { month: "Mar", patients: 9200 }], indexField: "month", categories: ["patients"], colors: ["blue"], valueFormat: "number", dateRange: "30d", aggregation: "sum" },
        { id: "w7", title: "Diagnosis Distribution", chartType: "donut", data: [{ type: "Respiratory", value: 28 }, { type: "Cardiovascular", value: 22 }, { type: "Musculoskeletal", value: 18 }, { type: "Neurological", value: 12 }, { type: "Other", value: 20 }], indexField: "type", categories: ["value"], colors: ["emerald", "blue", "amber", "violet", "slate"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum" },
        { id: "w8", title: "Readmission Rate", chartType: "comparison", data: [], indexField: "name", categories: ["value"], colors: ["emerald"], valueFormat: "percentage", dateRange: "30d", aggregation: "sum", value: 8.2, comparisonValue: 12.5, comparisonLabel: "National Avg", suffix: "%" },
      ],
      layout: [
        { i: "w1", x: 0, y: 0, w: 3, h: 2 }, { i: "w2", x: 3, y: 0, w: 3, h: 2 }, { i: "w3", x: 6, y: 0, w: 3, h: 3 }, { i: "w4", x: 9, y: 0, w: 3, h: 3 },
        { i: "w5", x: 0, y: 2, w: 6, h: 4 }, { i: "w6", x: 6, y: 3, w: 6, h: 3 },
        { i: "w7", x: 0, y: 6, w: 6, h: 4 }, { i: "w8", x: 6, y: 6, w: 4, h: 3 },
      ],
      isPublic: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Marketing: <TrendingUp className="w-4 h-4" />,
  Sales: <BarChart3 className="w-4 h-4" />,
  Analytics: <Users className="w-4 h-4" />,
  "E-Commerce": <ShoppingCart className="w-4 h-4" />,
  Operations: <Activity className="w-4 h-4" />,
  Finance: <TrendingUp className="w-4 h-4" />,
  Productivity: <Clock className="w-4 h-4" />,
  Executive: <Zap className="w-4 h-4" />,
  SaaS: <Zap className="w-4 h-4" />,
  Support: <Heart className="w-4 h-4" />,
  HR: <Users className="w-4 h-4" />,
  Logistics: <Globe className="w-4 h-4" />,
  Healthcare: <Heart className="w-4 h-4" />,
};

export function TemplateStore({ open, onOpenChange, onSelectTemplate }: TemplateStoreProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(TEMPLATES.map(t => t.category))];

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            Template Store
            <Badge variant="secondary" className="ml-2">{TEMPLATES.length} templates</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="w-full sm:w-auto">
            <div className="flex gap-2 pb-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="gap-1 whitespace-nowrap"
                >
                  {CATEGORY_ICONS[cat]}
                  {cat}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className={cn(
                  "group relative p-4 rounded-xl border border-border bg-card",
                  "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
                  "transition-all duration-200 cursor-pointer"
                )}
                onClick={() => onSelectTemplate(template.config)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{template.thumbnail}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {template.category}
                  </Badge>
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{template.config.widgets.length} widgets</span>
                  <span>•</span>
                  <span className="capitalize">{template.config.colorScheme || "default"} theme</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
