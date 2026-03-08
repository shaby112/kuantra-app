import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownWidgetProps {
    title?: string;
    targetDate: string | Date;
    onComplete?: () => void;
    className?: string;
}

interface TimeUnit {
    value: number;
    label: string;
}

export function CountdownWidget({
    title = "Countdown",
    targetDate,
    onComplete,
    className,
}: CountdownWidgetProps) {
    const [timeLeft, setTimeLeft] = useState<TimeUnit[]>([]);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const target = new Date(targetDate).getTime();
            const now = new Date().getTime();
            const difference = target - now;

            if (difference <= 0) {
                if (!isComplete) {
                    setIsComplete(true);
                    onComplete?.();
                }
                setTimeLeft([
                    { value: 0, label: "Days" },
                    { value: 0, label: "Hours" },
                    { value: 0, label: "Min" },
                    { value: 0, label: "Sec" },
                ]);
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft([
                { value: days, label: "Days" },
                { value: hours, label: "Hours" },
                { value: minutes, label: "Min" },
                { value: seconds, label: "Sec" },
            ]);
        };

        // Calculate immediately
        calculateTimeLeft();

        // Update every second
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [targetDate, isComplete, onComplete]);

    return (
        <div className={cn("h-full flex flex-col items-center justify-center p-4", className)}>
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {title}
                </p>
            </div>

            <div className="flex items-center gap-3">
                {timeLeft.map((unit, index) => (
                    <div key={unit.label} className="flex flex-col items-center">
                        <div className="relative w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={unit.value}
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 20, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-2xl font-bold text-foreground"
                                >
                                    {String(unit.value).padStart(2, "0")}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 font-medium">
                            {unit.label}
                        </span>
                    </div>
                ))}
            </div>

            {isComplete && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-4 px-4 py-2 rounded-full bg-primary/20 text-primary text-xs font-bold"
                >
                    Time's Up! 🎉
                </motion.div>
            )}

            <p className="text-xs text-muted-foreground mt-4">
                {new Date(targetDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </p>
        </div>
    );
}
