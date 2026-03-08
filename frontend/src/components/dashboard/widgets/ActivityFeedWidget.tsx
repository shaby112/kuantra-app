import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    UserPlus, ShoppingCart, CreditCard, Bell,
    MessageSquare, Star, AlertCircle, CheckCircle,
    Package, Zap, Heart
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActivityItem {
    id: string;
    type: "user" | "purchase" | "payment" | "notification" | "message" | "review" | "warning" | "success" | "order" | "promo" | "like";
    title: string;
    description?: string;
    timestamp: string;
    avatar?: string;
    metadata?: Record<string, string | number>;
}

interface ActivityFeedWidgetProps {
    items?: ActivityItem[];
    maxItems?: number;
    showAnimation?: boolean;
    className?: string;
}

const iconMap = {
    user: { icon: UserPlus, color: "bg-blue-500/10 text-blue-500" },
    purchase: { icon: ShoppingCart, color: "bg-emerald-500/10 text-emerald-500" },
    payment: { icon: CreditCard, color: "bg-violet-500/10 text-violet-500" },
    notification: { icon: Bell, color: "bg-amber-500/10 text-amber-500" },
    message: { icon: MessageSquare, color: "bg-cyan-500/10 text-cyan-500" },
    review: { icon: Star, color: "bg-yellow-500/10 text-yellow-500" },
    warning: { icon: AlertCircle, color: "bg-rose-500/10 text-rose-500" },
    success: { icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-500" },
    order: { icon: Package, color: "bg-indigo-500/10 text-indigo-500" },
    promo: { icon: Zap, color: "bg-orange-500/10 text-orange-500" },
    like: { icon: Heart, color: "bg-pink-500/10 text-pink-500" },
};

const defaultItems: ActivityItem[] = [
    {
        id: "1",
        type: "user",
        title: "New user signed up",
        description: "John Doe joined the platform",
        timestamp: "2 min ago",
    },
    {
        id: "2",
        type: "purchase",
        title: "New purchase",
        description: "Enterprise plan - $299/mo",
        timestamp: "5 min ago",
        metadata: { amount: 299 },
    },
    {
        id: "3",
        type: "success",
        title: "Deployment successful",
        description: "v2.4.1 deployed to production",
        timestamp: "12 min ago",
    },
    {
        id: "4",
        type: "review",
        title: "New 5-star review",
        description: '"Amazing product! Highly recommend."',
        timestamp: "1 hour ago",
    },
    {
        id: "5",
        type: "warning",
        title: "High CPU usage detected",
        description: "Server cpu-01 at 85%",
        timestamp: "2 hours ago",
    },
];

function formatRelativeTime(timestamp: string): string {
    // In a real app, you'd parse and format properly
    return timestamp;
}

export function ActivityFeedWidget({
    items = defaultItems,
    maxItems = 5,
    showAnimation = true,
    className,
}: ActivityFeedWidgetProps) {
    const displayItems = items.slice(0, maxItems);

    return (
        <div className={cn("h-full flex flex-col p-4", className)}>
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-foreground">Recent Activity</h4>
                <Badge variant="secondary" className="text-[10px]">
                    {items.length} events
                </Badge>
            </div>

            <div className="flex-1 overflow-auto space-y-3">
                {displayItems.map((item, index) => {
                    const { icon: Icon, color } = iconMap[item.type];

                    return (
                        <motion.div
                            key={item.id}
                            initial={showAnimation ? { opacity: 0, x: -20 } : undefined}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                                "flex items-start gap-3 p-3 rounded-lg",
                                "bg-muted/30 hover:bg-muted/50 transition-colors",
                                "border border-transparent hover:border-border/50"
                            )}
                        >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color)}>
                                <Icon className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {item.title}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {formatRelativeTime(item.timestamp)}
                                    </span>
                                </div>
                                {item.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {item.description}
                                    </p>
                                )}
                                {item.metadata?.amount && (
                                    <Badge variant="outline" className="mt-1.5 text-[10px]">
                                        ${item.metadata.amount}
                                    </Badge>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {items.length > maxItems && (
                <button className="mt-3 text-xs text-primary font-medium hover:underline text-center">
                    View all {items.length} activities →
                </button>
            )}
        </div>
    );
}
