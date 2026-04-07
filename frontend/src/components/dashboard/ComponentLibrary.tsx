import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ComponentLibraryProps {
    onAddWidget: (type: string) => void;
    onShowTemplates: () => void;
    onShowHistory: () => void;
    onShowColors: () => void;
    collapsed: boolean;
    onToggle: () => void;
}

const CATEGORIES = [
    {
        id: "charts",
        label: "Charts",
        icon: "bar_chart",
        widgets: [
            { type: "area", label: "Area Chart", icon: "area_chart", description: "Smooth area visualization" },
            { type: "line", label: "Line Chart", icon: "show_chart", description: "Trend line chart" },
            { type: "bar", label: "Bar Chart", icon: "bar_chart", description: "Vertical bars" },
            { type: "donut", label: "Donut Chart", icon: "donut_large", description: "Pie/donut chart" },
            { type: "funnel", label: "Funnel", icon: "filter_alt", description: "Conversion funnel" },
            { type: "heatmap", label: "Heatmap", icon: "grid_on", description: "Heat intensity grid" },
            { type: "radar", label: "Radar", icon: "radar", description: "Multi-metric radar" },
        ]
    },
    {
        id: "metrics",
        label: "Metrics",
        icon: "tag",
        widgets: [
            { type: "metric", label: "Metric Card", icon: "trending_up", description: "Single KPI display" },
            { type: "kpi", label: "KPI", icon: "bolt", description: "Key performance indicator" },
            { type: "number", label: "Big Number", icon: "numbers", description: "Large number display" },
            { type: "stat", label: "Stat Card", icon: "monitoring", description: "Stat with icon" },
            { type: "comparison", label: "Comparison", icon: "compare_arrows", description: "Compare values" },
            { type: "progress", label: "Progress", icon: "target", description: "Goal tracker" },
            { type: "gauge", label: "Gauge", icon: "speed", description: "Percentage dial" },
            { type: "sparkline", label: "Sparkline", icon: "show_chart", description: "Mini trend chart" },
        ]
    },
    {
        id: "data",
        label: "Data",
        icon: "table_chart",
        widgets: [
            { type: "table", label: "Table", icon: "table_chart", description: "Data table view" },
            { type: "leaderboard", label: "Leaderboard", icon: "leaderboard", description: "Ranked list" },
            { type: "list", label: "List", icon: "list", description: "Simple list view" },
            { type: "ticker", label: "Ticker", icon: "arrow_forward", description: "Scrolling ticker" },
            { type: "calendar", label: "Calendar", icon: "calendar_today", description: "Calendar heatmap" },
        ]
    },
    {
        id: "interactive",
        label: "Interactive",
        icon: "touch_app",
        widgets: [
            { type: "button", label: "Button", icon: "smart_button", description: "Action button" },
            { type: "countdown", label: "Countdown", icon: "timer", description: "Timer countdown" },
            { type: "timeline", label: "Timeline", icon: "timeline", description: "Event timeline" },
        ]
    },
    {
        id: "layout",
        label: "Layout",
        icon: "layers",
        widgets: [
            { type: "container", label: "Container", icon: "crop_square", description: "Group components" },
            { type: "header", label: "Header", icon: "title", description: "Section header" },
            { type: "text", label: "Text Block", icon: "article", description: "Rich text content" },
            { type: "divider", label: "Divider", icon: "horizontal_rule", description: "Section divider" },
            { type: "image", label: "Image", icon: "image", description: "Image display" },
        ]
    }
];

export function ComponentLibrary({
    onAddWidget,
    onShowTemplates,
    onShowHistory,
    onShowColors,
    collapsed,
    onToggle
}: ComponentLibraryProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>("charts");

    return (
        <motion.div
            initial={false}
            animate={{ width: collapsed ? 56 : 280 }}
            className={cn(
                "h-full bg-obsidian-surface-lowest flex flex-col transition-all duration-300 relative z-30",
                collapsed && "items-center"
            )}
        >
            {/* Collapse Toggle */}
            <button
                onClick={onToggle}
                className="absolute -left-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-obsidian-surface-mid flex items-center justify-center z-40 hover:bg-obsidian-surface-high transition-colors"
            >
                <Icon name={collapsed ? "chevron_left" : "chevron_right"} size="sm" className="text-obsidian-on-surface-variant" />
            </button>

            <div className="px-4 py-3 flex items-center justify-between overflow-hidden border-b border-obsidian-outline-variant/10">
                {!collapsed && (
                    <span className="font-label text-[10px] uppercase tracking-[0.15em] font-bold text-obsidian-on-surface-variant">Widget Library</span>
                )}
                <Icon name="dashboard_customize" size="sm" className={cn("text-obsidian-primary", collapsed && "mx-auto")} />
            </div>

            <ScrollArea className="flex-1">
                <div className={cn("p-2 space-y-1", collapsed && "px-1")}>
                    {CATEGORIES.map((category) => (
                        <div key={category.id}>
                            <button
                                className={cn(
                                    "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-left transition-colors",
                                    collapsed && "justify-center px-0",
                                    expandedCategory === category.id && !collapsed
                                        ? "bg-obsidian-primary/10 text-obsidian-primary"
                                        : "text-obsidian-on-surface-variant hover:bg-obsidian-surface-mid"
                                )}
                                onClick={() => {
                                    if (collapsed) onToggle();
                                    setExpandedCategory(expandedCategory === category.id ? null : category.id);
                                }}
                            >
                                <Icon name={category.icon} size="sm" className="shrink-0" />
                                {!collapsed && (
                                    <>
                                        <span className="font-label text-xs font-medium flex-1">{category.label}</span>
                                        <Icon
                                            name="expand_more"
                                            size="sm"
                                            className={cn("transition-transform", expandedCategory === category.id && "rotate-180")}
                                        />
                                    </>
                                )}
                            </button>

                            <AnimatePresence mode="wait">
                                {expandedCategory === category.id && !collapsed && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden px-1"
                                    >
                                        <div className="grid grid-cols-2 gap-1.5 py-2">
                                            {category.widgets.map((widget) => (
                                                <button
                                                    key={widget.type}
                                                    onClick={() => onAddWidget(widget.type)}
                                                    className="group flex flex-col items-center p-2.5 rounded-lg bg-obsidian-surface-low hover:bg-obsidian-surface-mid border border-obsidian-outline-variant/10 hover:border-obsidian-primary/30 transition-all text-center"
                                                >
                                                    <div className="w-full aspect-video rounded bg-obsidian-surface mb-1.5 flex items-center justify-center overflow-hidden">
                                                        <Icon
                                                            name={widget.icon}
                                                            size="md"
                                                            className="text-obsidian-outline group-hover:text-obsidian-primary transition-colors"
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-bold text-obsidian-on-surface group-hover:text-obsidian-primary transition-colors leading-tight">{widget.label}</span>
                                                    <span className="text-[9px] text-obsidian-on-surface-variant/60 line-clamp-1">{widget.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}

                    <div className="h-px bg-obsidian-outline-variant/10 my-3" />

                    <button
                        onClick={() => onAddWidget('ai')}
                        className={cn(
                            "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-obsidian-primary hover:bg-obsidian-primary/10 transition-colors",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <Icon name="auto_awesome" size="sm" className="shrink-0" />
                        {!collapsed && <span className="font-label text-xs font-medium">AI Widget</span>}
                    </button>

                    <button
                        onClick={onShowColors}
                        className={cn(
                            "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-obsidian-on-surface-variant hover:bg-obsidian-surface-mid hover:text-obsidian-primary transition-colors",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <Icon name="palette" size="sm" className="shrink-0" />
                        {!collapsed && <span className="font-label text-xs font-medium">Colors</span>}
                    </button>

                    <button
                        onClick={onShowTemplates}
                        className={cn(
                            "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-obsidian-on-surface-variant hover:bg-obsidian-surface-mid hover:text-obsidian-primary transition-colors",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <Icon name="grid_view" size="sm" className="shrink-0" />
                        {!collapsed && <span className="font-label text-xs font-medium">Templates</span>}
                    </button>

                    <button
                        onClick={onShowHistory}
                        className={cn(
                            "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-obsidian-on-surface-variant hover:bg-obsidian-surface-mid hover:text-obsidian-primary transition-colors",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <Icon name="history" size="sm" className="shrink-0" />
                        {!collapsed && <span className="font-label text-xs font-medium">My Dashboards</span>}
                    </button>
                </div>
            </ScrollArea>
        </motion.div>
    );
}
