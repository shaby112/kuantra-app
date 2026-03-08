import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    DollarSign, Users, ShoppingCart, Eye, Zap
} from "lucide-react";
import { EChart } from "../EChart";

interface QuickStatsItem {
    id: string;
    title: string;
    value: number;
    previousValue: number;
    format: "currency" | "number" | "compact" | "percentage";
    icon?: keyof typeof iconMap;
    color?: string;
    sparkData?: number[];
}

interface QuickStatsWidgetProps {
    items?: QuickStatsItem[];
    layout?: "row" | "grid";
    className?: string;
}

const iconMap = {
    dollar: DollarSign,
    users: Users,
    cart: ShoppingCart,
    eye: Eye,
    zap: Zap,
};

const formatters = {
    currency: (v: number) => `$${Intl.NumberFormat("us", { notation: "compact" }).format(v)}`,
    number: (v: number) => Intl.NumberFormat("us").format(v),
    compact: (v: number) => Intl.NumberFormat("us", { notation: "compact" }).format(v),
    percentage: (v: number) => `${v.toFixed(1)}%`,
};

const defaultItems: QuickStatsItem[] = [
    {
        id: "revenue",
        title: "Revenue",
        value: 124500,
        previousValue: 98000,
        format: "currency",
        icon: "dollar",
        color: "emerald",
        sparkData: [45, 52, 38, 55, 62, 70, 85, 78],
    },
    {
        id: "users",
        title: "Active Users",
        value: 8420,
        previousValue: 7200,
        format: "compact",
        icon: "users",
        color: "blue",
        sparkData: [30, 35, 42, 38, 50, 55, 60, 72],
    },
    {
        id: "orders",
        title: "Orders",
        value: 1243,
        previousValue: 1100,
        format: "number",
        icon: "cart",
        color: "violet",
        sparkData: [20, 25, 30, 28, 35, 40, 45, 52],
    },
    {
        id: "conversion",
        title: "Conversion",
        value: 3.24,
        previousValue: 2.8,
        format: "percentage",
        icon: "zap",
        color: "amber",
        sparkData: [1.8, 2.1, 2.4, 2.2, 2.8, 3.0, 3.1, 3.24],
    },
];

export function QuickStatsWidget({
    items = defaultItems,
    layout = "row",
    className
}: QuickStatsWidgetProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <div
            className={cn(
                "h-full p-4",
                layout === "row" ? "flex gap-4" : "grid grid-cols-2 gap-4",
                className
            )}
        >
            {items.map((item) => {
                const Icon = item.icon ? iconMap[item.icon] : Zap;
                const formatter = formatters[item.format];
                const change = ((item.value - item.previousValue) / item.previousValue) * 100;
                const isPositive = change > 0;
                const sparkData = item.sparkData?.map((v, i) => ({ index: i, value: v })) || [];

                return (
                    <motion.div
                        key={item.id}
                        className={cn(
                            "flex-1 rounded-xl p-4 transition-all cursor-pointer",
                            "bg-gradient-to-br from-muted/50 to-muted/30",
                            "border border-border/50 hover:border-primary/30",
                            "hover:shadow-lg hover:shadow-primary/5"
                        )}
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                `bg-${item.color}-500/10`
                            )} style={{ backgroundColor: `var(--${item.color}-500, hsl(var(--primary))) / 0.1` }}>
                                <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                                isPositive
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-rose-500/10 text-rose-500"
                            )}>
                                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(change).toFixed(1)}%
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {item.title}
                            </p>
                            <motion.p
                                className="text-2xl font-bold text-foreground"
                                key={item.value}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                {formatter(item.value)}
                            </motion.p>
                        </div>

                        <AnimatePresence>
                            {hoveredId === item.id && sparkData.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 40 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 pt-3 border-t border-border/50"
                                >
                                    <EChart
                                        className="h-8 w-full"
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}
