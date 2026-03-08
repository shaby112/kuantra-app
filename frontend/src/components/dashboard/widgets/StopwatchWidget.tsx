import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StopwatchWidgetProps {
    title?: string;
    className?: string;
}

export function StopwatchWidget({ title = "Stopwatch", className }: StopwatchWidgetProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [laps, setLaps] = useState<number[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        if (isRunning) {
            startTimeRef.current = Date.now() - elapsedTime;
            intervalRef.current = setInterval(() => {
                setElapsedTime(Date.now() - startTimeRef.current);
            }, 10); // Update every 10ms for smooth display
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, elapsedTime]);

    const handleStartPause = () => {
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setElapsedTime(0);
        setLaps([]);
    };

    const handleLap = () => {
        if (isRunning) {
            setLaps([...laps, elapsedTime]);
        }
    };

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(2, "0")}`;
        }
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(2, "0")}`;
    };

    return (
        <div className={cn("h-full flex flex-col p-4", className)}>
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            </div>

            {/* Main display */}
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl font-mono font-bold text-foreground tabular-nums">
                        {formatTime(elapsedTime)}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 mb-4">
                <Button
                    variant={isRunning ? "destructive" : "default"}
                    size="icon"
                    onClick={handleStartPause}
                    className="h-12 w-12 rounded-full"
                >
                    {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleReset}
                    className="h-10 w-10 rounded-full"
                    disabled={elapsedTime === 0}
                >
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLap}
                    disabled={!isRunning}
                    className="px-4"
                >
                    Lap
                </Button>
            </div>

            {/* Laps */}
            {laps.length > 0 && (
                <div className="border-t border-border pt-3 max-h-32 overflow-y-auto">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Laps</p>
                    <div className="space-y-1">
                        {laps.map((lap, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30"
                            >
                                <span className="text-muted-foreground">Lap {laps.length - index}</span>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                    {formatTime(lap)}
                                </span>
                            </div>
                        )).reverse()}
                    </div>
                </div>
            )}
        </div>
    );
}
