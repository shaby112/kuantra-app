import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarWidgetProps {
    title?: string;
    onDateSelect?: (date: Date) => void;
    highlightedDates?: Date[];
    className?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export function CalendarWidget({
    title = "Calendar",
    onDateSelect,
    highlightedDates = [],
    className,
}: CalendarWidgetProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Generate calendar grid
    const calendarDays: (number | null)[] = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        calendarDays.push(-(daysInPrevMonth - i));
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(i);
    }

    // Next month days to fill grid
    const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
        calendarDays.push(-(i + 100)); // Negative for next month
    }

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleDateClick = (day: number) => {
        if (day > 0) {
            const date = new Date(year, month, day);
            setSelectedDate(date);
            onDateSelect?.(date);
        }
    };

    const isToday = (day: number) => {
        const today = new Date();
        return (
            day > 0 &&
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        );
    };

    const isSelected = (day: number) => {
        if (!selectedDate || day <= 0) return false;
        return (
            day === selectedDate.getDate() &&
            month === selectedDate.getMonth() &&
            year === selectedDate.getFullYear()
        );
    };

    const isHighlighted = (day: number) => {
        if (day <= 0) return false;
        return highlightedDates.some(
            (d) =>
                d.getDate() === day &&
                d.getMonth() === month &&
                d.getFullYear() === year
        );
    };

    return (
        <div className={cn("h-full flex flex-col p-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handlePrevMonth}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
                        {MONTHS[month]} {year}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleNextMonth}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                    <div
                        key={day}
                        className="text-center text-[10px] font-bold text-muted-foreground uppercase"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 flex-1">
                {calendarDays.map((day, index) => {
                    const isCurrentMonth = day > 0;
                    const displayDay = Math.abs(day) > 100 ? Math.abs(day) - 100 : Math.abs(day);

                    return (
                        <button
                            key={index}
                            onClick={() => handleDateClick(day)}
                            disabled={!isCurrentMonth}
                            className={cn(
                                "aspect-square rounded-md text-xs font-medium transition-all relative",
                                "hover:bg-primary/10 active:scale-95",
                                !isCurrentMonth && "text-muted-foreground/30 cursor-not-allowed",
                                isCurrentMonth && "text-foreground",
                                isToday(day) && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                                isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                                isHighlighted(day) && !isSelected(day) && "bg-accent/50"
                            )}
                        >
                            {displayDay}
                            {isHighlighted(day) && !isSelected(day) && (
                                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected date display */}
            {selectedDate && (
                <div className="mt-3 pt-3 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">Selected</p>
                    <p className="text-sm font-medium text-foreground">
                        {selectedDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
            )}
        </div>
    );
}
