import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Target, TrendingUp, Check } from "lucide-react";

interface ProgressRingWidgetProps {
    value: number;
    target: number;
    title?: string;
    subtitle?: string;
    color?: "primary" | "emerald" | "blue" | "violet" | "amber";
    size?: "sm" | "md" | "lg";
    showAnimation?: boolean;
    className?: string;
}

const sizeConfig = {
    sm: { ring: 80, stroke: 6, font: "text-xl" },
    md: { ring: 120, stroke: 8, font: "text-3xl" },
    lg: { ring: 160, stroke: 10, font: "text-4xl" },
};

const colorConfig = {
    primary: "stroke-primary",
    emerald: "stroke-emerald-500",
    blue: "stroke-blue-500",
    violet: "stroke-violet-500",
    amber: "stroke-amber-500",
};

export function ProgressRingWidget({
    value,
    target,
    title = "Goal Progress",
    subtitle,
    color = "primary",
    size = "md",
    showAnimation = true,
    className,
}: ProgressRingWidgetProps) {
    const [animatedPercent, setAnimatedPercent] = useState(0);
    const percent = Math.min((value / target) * 100, 100);
    const isComplete = percent >= 100;

    const { ring, stroke, font } = sizeConfig[size];
    const radius = (ring - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (animatedPercent / 100) * circumference;

    useEffect(() => {
        if (showAnimation) {
            const timer = setTimeout(() => setAnimatedPercent(percent), 100);
            return () => clearTimeout(timer);
        } else {
            setAnimatedPercent(percent);
        }
    }, [percent, showAnimation]);

    return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4", className)}>
            <div className="relative" style={{ width: ring, height: ring }}>
                {/* Background ring */}
                <svg width={ring} height={ring} className="absolute transform -rotate-90">
                    <circle
                        cx={ring / 2}
                        cy={ring / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        className="stroke-muted"
                    />
                </svg>

                {/* Progress ring */}
                <svg width={ring} height={ring} className="absolute transform -rotate-90">
                    <motion.circle
                        cx={ring / 2}
                        cy={ring / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        className={colorConfig[color]}
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isComplete ? (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 1, type: "spring" }}
                            className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"
                        >
                            <Check className="w-6 h-6 text-white" />
                        </motion.div>
                    ) : (
                        <motion.span
                            className={cn("font-bold text-foreground", font)}
                            key={Math.round(animatedPercent)}
                        >
                            {Math.round(animatedPercent)}%
                        </motion.span>
                    )}
                </div>
            </div>

            <div className="mt-4 text-center">
                <h4 className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    {title}
                </h4>
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                )}
                <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-sm font-bold text-foreground">
                        {Intl.NumberFormat("us", { notation: "compact" }).format(value)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        / {Intl.NumberFormat("us", { notation: "compact" }).format(target)}
                    </span>
                </div>
                {percent > 0 && percent < 100 && (
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                        <TrendingUp className="w-3 h-3" />
                        <span>{Intl.NumberFormat("us", { notation: "compact" }).format(target - value)} to go</span>
                    </div>
                )}
            </div>
        </div>
    );
}
