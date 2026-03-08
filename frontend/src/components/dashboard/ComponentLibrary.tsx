import { useState } from "react";
import {
    BarChart, Table as TableIcon, Plus, Sparkles, LayoutTemplate,
    PanelRightClose, PanelRight, TrendingUp, Activity, Target,
    FileText, Image, Gauge, ChevronDown, Palette,
    Map, Filter, GitBranch, Square, ArrowRight, Clock,
    List, Calendar, Hash, Timer, Zap, MousePointer, Type,
    LayoutGrid, Layers, Heading, Minus, ChevronRight, ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { ChartType } from "@/types/dashboard";

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
        icon: BarChart,
        widgets: [
            { type: "area", label: "Area Chart", icon: Activity, description: "Smooth area visualization" },
            { type: "line", label: "Line Chart", icon: TrendingUp, description: "Trend line chart" },
            { type: "bar", label: "Bar Chart", icon: BarChart, description: "Vertical bars" },
            { type: "donut", label: "Donut Chart", icon: LayoutGrid, description: "Pie/donut chart" },
            { type: "funnel", label: "Funnel", icon: GitBranch, description: "Conversion funnel" },
            { type: "heatmap", label: "Heatmap", icon: LayoutGrid, description: "Heat intensity grid" },
            { type: "radar", label: "Radar", icon: Target, description: "Multi-metric radar" },
        ]
    },
    {
        id: "metrics",
        label: "Metrics",
        icon: Hash,
        widgets: [
            { type: "metric", label: "Metric Card", icon: TrendingUp, description: "Single KPI display" },
            { type: "kpi", label: "KPI", icon: Zap, description: "Key performance indicator" },
            { type: "number", label: "Big Number", icon: Hash, description: "Large number display" },
            { type: "stat", label: "Stat Card", icon: Activity, description: "Stat with icon" },
            { type: "comparison", label: "Comparison", icon: ArrowRight, description: "Compare values" },
            { type: "progress", label: "Progress", icon: Target, description: "Goal tracker" },
            { type: "gauge", label: "Gauge", icon: Gauge, description: "Percentage dial" },
            { type: "sparkline", label: "Sparkline", icon: Activity, description: "Mini trend chart" },
        ]
    },
    {
        id: "data",
        label: "Data",
        icon: TableIcon,
        widgets: [
            { type: "table", label: "Table", icon: TableIcon, description: "Data table view" },
            { type: "leaderboard", label: "Leaderboard", icon: List, description: "Ranked list" },
            { type: "list", label: "List", icon: List, description: "Simple list view" },
            { type: "ticker", label: "Ticker", icon: ArrowRight, description: "Scrolling ticker" },
            { type: "calendar", label: "Calendar", icon: Calendar, description: "Calendar heatmap" },
        ]
    },
    {
        id: "interactive",
        label: "Interactive",
        icon: MousePointer,
        widgets: [
            { type: "button", label: "Button", icon: MousePointer, description: "Action button" },
            { type: "countdown", label: "Countdown", icon: Timer, description: "Timer countdown" },
            { type: "timeline", label: "Timeline", icon: Clock, description: "Event timeline" },
        ]
    },
    {
        id: "layout",
        label: "Layout",
        icon: Layers,
        widgets: [
            { type: "container", label: "Container", icon: Square, description: "Group components" },
            { type: "header", label: "Header", icon: Heading, description: "Section header" },
            { type: "text", label: "Text Block", icon: FileText, description: "Rich text content" },
            { type: "divider", label: "Divider", icon: Minus, description: "Section divider" },
            { type: "image", label: "Image", icon: Image, description: "Image display" },
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
            animate={{ width: collapsed ? 64 : 320 }}
            className={cn(
                "h-full border-l border-border bg-background/80 backdrop-blur-xl flex flex-col transition-all duration-300 relative z-30",
                collapsed && "items-center"
            )}
        >
            {/* Collapse Toggle */}
            <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="absolute -left-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-border bg-background shadow-md z-40 hover:bg-accent"
            >
                {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>

            <div className="p-4 border-b border-border flex items-center justify-between overflow-hidden">
                {!collapsed && <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Library</h2>}
                <LayoutGrid className={cn("w-5 h-5 text-primary", collapsed && "mx-auto")} />
            </div>

            <ScrollArea className="flex-1">
                <div className={cn("p-2 space-y-2", collapsed && "px-1")}>
                    {CATEGORIES.map((category) => (
                        <div key={category.id} className="space-y-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "w-full justify-start gap-3 h-10 px-3",
                                    collapsed && "justify-center px-0",
                                    expandedCategory === category.id && !collapsed && "bg-primary/10 text-primary"
                                )}
                                onClick={() => {
                                    if (collapsed) onToggle();
                                    setExpandedCategory(expandedCategory === category.id ? null : category.id);
                                }}
                            >
                                <category.icon className="w-4 h-4 shrink-0" />
                                {!collapsed && (
                                    <>
                                        <span className="font-medium flex-1 text-left">{category.label}</span>
                                        <ChevronDown className={cn("w-3 h-3 transition-transform", expandedCategory === category.id && "rotate-180")} />
                                    </>
                                )}
                            </Button>

                            <AnimatePresence mode="wait">
                                {expandedCategory === category.id && !collapsed && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden px-1"
                                    >
                                        <div className="grid grid-cols-2 gap-2 py-2">
                                            {category.widgets.map((widget) => (
                                                <button
                                                    key={widget.type}
                                                    onClick={() => onAddWidget(widget.type)}
                                                    className="group flex flex-col items-center p-3 rounded-xl border border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-center relative overflow-hidden"
                                                >
                                                    <div className="w-full aspect-video rounded-lg bg-slate-100 dark:bg-slate-900 mb-2 flex items-center justify-center overflow-hidden relative border border-border/50">
                                                        {/* Enhanced Previews */}
                                                        <div className="absolute inset-x-0 bottom-0 top-1/2 opacity-20 pointer-events-none">
                                                            {widget.type === 'area' && (
                                                                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                                                                    <path d="M0,40 L0,20 Q25,5 50,20 T100,10 L100,40 Z" fill="hsl(var(--primary))" />
                                                                </svg>
                                                            )}
                                                            {widget.type === 'line' && (
                                                                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                                                                    <path d="M0,30 L20,10 L40,25 L60,5 L80,20 L100,5" stroke="hsl(var(--primary))" fill="none" strokeWidth="3" />
                                                                </svg>
                                                            )}
                                                            {widget.type === 'bar' && (
                                                                <div className="flex items-end justify-center gap-1 h-full px-2">
                                                                    <div className="w-2 h-[40%] bg-primary" />
                                                                    <div className="w-2 h-[80%] bg-primary/80" />
                                                                    <div className="w-2 h-[60%] bg-primary" />
                                                                    <div className="w-2 h-[90%] bg-primary/70" />
                                                                </div>
                                                            )}
                                                            {widget.type === 'donut' && (
                                                                <div className="w-8 h-8 rounded-full border-[6px] border-primary border-t-transparent animate-spin-slow m-auto mt-2" />
                                                            )}
                                                            {widget.type === 'kpi' && (
                                                                <div className="flex items-center justify-center h-full">
                                                                    <div className="w-10 h-10 rounded-lg border-2 border-primary/40 flex items-center justify-center">
                                                                        <Zap className="w-5 h-5 text-primary" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {widget.type === 'gauge' && (
                                                                <div className="relative w-12 h-6 overflow-hidden m-auto mt-4">
                                                                    <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary rotate-[135deg]" />
                                                                </div>
                                                            )}
                                                            {widget.type === 'progress' && (
                                                                <div className="flex flex-col gap-1 w-full px-4 justify-center h-full">
                                                                    <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden">
                                                                        <div className="h-full w-[70%] bg-primary" />
                                                                    </div>
                                                                    <div className="flex justify-between text-[8px] text-primary/60 font-bold">
                                                                        <span>70%</span>
                                                                        <span>100%</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {widget.type === 'comparison' && (
                                                                <div className="flex items-center justify-center gap-2 h-full">
                                                                    <div className="text-[14px] font-black text-primary">$500</div>
                                                                    <div className="text-[10px] text-emerald-500 font-bold flex items-center bg-emerald-500/10 px-1 rounded">+12%</div>
                                                                </div>
                                                            )}
                                                            {widget.type === 'button' && (
                                                                <div className="flex items-center justify-center h-full">
                                                                    <div className="w-16 h-6 rounded-md bg-primary shadow-sm shadow-primary/40 flex items-center justify-center gap-1">
                                                                        <div className="w-4 h-1 bg-white/40 rounded-full" />
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {widget.type === 'container' && (
                                                                <div className="w-full h-full p-2">
                                                                    <div className="w-full h-full rounded border border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
                                                                        <div className="grid grid-cols-2 gap-1 w-8">
                                                                            <div className="h-2 w-full bg-primary/20 rounded" />
                                                                            <div className="h-2 w-full bg-primary/20 rounded" />
                                                                            <div className="h-2 w-full bg-primary/20 rounded" />
                                                                            <div className="h-2 w-full bg-primary/20 rounded" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <widget.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all duration-300 relative z-10 group-hover:scale-110" />
                                                    </div>
                                                    <span className="text-[13px] font-bold group-hover:text-primary transition-colors">{widget.label}</span>
                                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{widget.description}</span>

                                                    {/* Hover Glow */}
                                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}

                    <div className="h-px bg-border/50 my-4" />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddWidget('ai')}
                        className={cn("w-full justify-start gap-3 h-10 px-3 text-primary hover:bg-primary/10", collapsed && "justify-center px-0")}
                    >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="font-medium">AI Widget</span>}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onShowColors}
                        className={cn("w-full justify-start gap-3 h-10 px-3 hover:bg-primary/10 hover:text-primary", collapsed && "justify-center px-0")}
                    >
                        <Palette className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="font-medium">Colors</span>}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onShowTemplates}
                        className={cn("w-full justify-start gap-3 h-10 px-3 hover:bg-primary/10 hover:text-primary", collapsed && "justify-center px-0")}
                    >
                        <LayoutTemplate className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="font-medium">Templates</span>}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onShowHistory}
                        className={cn("w-full justify-start gap-3 h-10 px-3 hover:bg-primary/10 hover:text-primary", collapsed && "justify-center px-0")}
                    >
                        <Clock className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="font-medium">My Dashboards</span>}
                    </Button>
                </div>
            </ScrollArea>
        </motion.div >
    );
}
