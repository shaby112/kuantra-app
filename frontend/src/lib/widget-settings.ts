import type { ChartType } from "@/types/dashboard";

/**
 * Defines which settings are relevant for each widget type
 */
export interface WidgetSettingCategories {
    showDataSource: boolean;
    showDateRange: boolean;
    showAggregation: boolean;
    showValueFormat: boolean;
    showChartType: boolean;
    showColorScheme: boolean;
    showTextContent: boolean;
    showImageUrl: boolean;
    showButtonConfig: boolean;
    showMapConfig: boolean;
    showTimeConfig: boolean;
    showTargetValue: boolean;
    showListItems: boolean;
    showStyleOptions: boolean;
    showSqlButton: boolean; // NEW: Whether to show SQL code button
    allowInlineEdit: boolean; // NEW: Whether widget supports inline editing
    showFontSettings: boolean; // NEW: Font customization
}

/**
 * Widget type categories for easier management
 */
const DATA_WIDGETS: ChartType[] = ["line", "bar", "area", "donut", "table", "sparkline", "heatmap", "treemap", "radar", "scatter", "waterfall", "sankey", "bubble", "funnel", "quickStats", "activityFeed"];
const METRIC_WIDGETS: ChartType[] = ["metric", "kpi", "gauge", "progress", "stat", "number", "comparison", "progressRing"];
const CONTENT_WIDGETS: ChartType[] = ["text", "image", "header", "divider"];
const INTERACTIVE_WIDGETS: ChartType[] = ["button", "filter", "dateSelector", "dropdown", "toggle", "slider", "tabs"];
const GEO_WIDGETS: ChartType[] = ["map", "choropleth"];
const TIME_WIDGETS: ChartType[] = ["calendar", "countdown", "timeline", "ticker", "stopwatch"];
const LIST_WIDGETS: ChartType[] = ["list", "leaderboard"];
const LAYOUT_WIDGETS: ChartType[] = ["container", "colorBlock", "divider"];

/**
 * Returns the relevant settings for a given widget type
 */
export function getWidgetSettings(chartType: ChartType): WidgetSettingCategories {
    const settings: WidgetSettingCategories = {
        showDataSource: false,
        showDateRange: false,
        showAggregation: false,
        showValueFormat: false,
        showChartType: false,
        showColorScheme: false,
        showTextContent: false,
        showImageUrl: false,
        showButtonConfig: false,
        showMapConfig: false,
        showTimeConfig: false,
        showTargetValue: false,
        showListItems: false,
        showStyleOptions: true,
        showSqlButton: false, // Default: no SQL button
        allowInlineEdit: false, // Default: no inline edit
        showFontSettings: false,
    };

    // Data visualization widgets - NEED SQL
    if (DATA_WIDGETS.includes(chartType)) {
        settings.showDataSource = true;
        settings.showDateRange = true;
        settings.showAggregation = true;
        settings.showValueFormat = true;
        settings.showChartType = ["line", "bar", "area", "donut"].includes(chartType);
        settings.showColorScheme = true;
        settings.showSqlButton = true; // Charts need SQL
    }

    // Metric widgets - NEED SQL for data
    if (METRIC_WIDGETS.includes(chartType)) {
        settings.showValueFormat = true;
        settings.showTargetValue = ["gauge", "progress", "comparison"].includes(chartType);
        settings.showColorScheme = true;
        settings.showSqlButton = true; // Metrics need SQL for data
    }

    // Content widgets - NO SQL needed
    if (CONTENT_WIDGETS.includes(chartType)) {
        settings.showTextContent = chartType === "text" || chartType === "header";
        settings.showImageUrl = chartType === "image";
        settings.allowInlineEdit = chartType === "text" || chartType === "header";
        settings.showFontSettings = chartType === "text" || chartType === "header";
        settings.showSqlButton = false; // Static content, no SQL
    }

    // Interactive widgets - NO SQL needed
    if (INTERACTIVE_WIDGETS.includes(chartType)) {
        settings.showButtonConfig = chartType === "button";
        settings.showSqlButton = false; // Static, no SQL
    }

    // Geographic widgets - NEED SQL for data
    if (GEO_WIDGETS.includes(chartType)) {
        settings.showMapConfig = true;
        settings.showDataSource = true;
        settings.showSqlButton = true; // Maps need location data
    }

    // Time widgets - NO SQL needed (self-contained)
    if (TIME_WIDGETS.includes(chartType)) {
        settings.showTimeConfig = true;
        settings.showSqlButton = false; // Time widgets are self-contained
    }

    // List widgets - NEED SQL for data
    if (LIST_WIDGETS.includes(chartType)) {
        settings.showListItems = true;
        settings.showDataSource = true;
        settings.showSqlButton = true; // Lists can be data-driven
    }

    // Layout widgets - NO SQL needed
    if (LAYOUT_WIDGETS.includes(chartType)) {
        settings.showSqlButton = false;
    }

    return settings;
}

/**
 * Check if a widget requires a data source
 */
export function widgetNeedsData(chartType: ChartType): boolean {
    return DATA_WIDGETS.includes(chartType) ||
        METRIC_WIDGETS.includes(chartType) ||
        GEO_WIDGETS.includes(chartType) ||
        LIST_WIDGETS.includes(chartType);
}

/**
 * Check if widget supports inline editing
 */
export function widgetSupportsInlineEdit(chartType: ChartType): boolean {
    return ["text", "header"].includes(chartType);
}

/**
 * Get a user-friendly description for each widget type
 */
export function getWidgetDescription(chartType: ChartType): string {
    const descriptions: Partial<Record<ChartType, string>> = {
        line: "Display trends over time with connected data points",
        bar: "Compare values across categories with vertical bars",
        area: "Show cumulative values with filled areas under the line",
        donut: "Visualize proportions in a circular chart",
        table: "Display data in rows and columns with sorting",
        metric: "Show a single key performance indicator",
        kpi: "Display an important metric with trend indicator",
        gauge: "Visualize progress toward a target with a dial",
        progress: "Show completion percentage with a progress bar",
        stat: "Display a statistic with icon and trend",
        number: "Show a large formatted number",
        comparison: "Compare current value to previous period",
        text: "Add formatted text content - click to edit inline",
        image: "Display an image or logo",
        header: "Add a section heading - click to edit inline",
        divider: "Visual separator between sections",
        button: "Clickable button for navigation or actions",
        filter: "Filter data across multiple widgets",
        dateSelector: "Select date ranges for filtering",
        dropdown: "Select from a list of options",
        toggle: "Binary on/off switch",
        slider: "Select a value from a range",
        tabs: "Switch between different views",
        map: "Interactive map with location markers",
        choropleth: "Color-coded regional map",
        funnel: "Visualize conversion stages",
        heatmap: "Show data density with color intensity",
        treemap: "Display hierarchical data as nested rectangles",
        radar: "Compare multiple variables on axes",
        scatter: "Plot relationship between two variables",
        waterfall: "Show cumulative effect of sequential values",
        sankey: "Visualize flow between categories",
        bubble: "Three-dimensional scatter plot",
        list: "Simple list of items with values",
        leaderboard: "Ranked list with positions",
        calendar: "Interactive calendar with date selection",
        countdown: "Live countdown to a target date",
        timeline: "Chronological list of events",
        ticker: "Scrolling ticker with live updates",
        stopwatch: "Precision stopwatch with lap tracking",
        container: "Group and organize other widgets",
        colorBlock: "Solid color block for visual design",
        sparkline: "Compact line chart without axes",
        quickStats: "Multi-metric display with sparklines",
        progressRing: "Animated circular progress goal",
        activityFeed: "Live feed of recent events and updates",
    };

    return descriptions[chartType] || "Widget";
}

/**
 * Get human-readable category for widget type
 */
export function getWidgetCategory(chartType: ChartType): string {
    if (DATA_WIDGETS.includes(chartType)) return "Data Visualization";
    if (METRIC_WIDGETS.includes(chartType)) return "Metrics & KPIs";
    if (CONTENT_WIDGETS.includes(chartType)) return "Content";
    if (INTERACTIVE_WIDGETS.includes(chartType)) return "Interactive";
    if (GEO_WIDGETS.includes(chartType)) return "Geographic";
    if (TIME_WIDGETS.includes(chartType)) return "Time & Events";
    if (LIST_WIDGETS.includes(chartType)) return "Lists";
    if (LAYOUT_WIDGETS.includes(chartType)) return "Layout";
    return "Other";
}
