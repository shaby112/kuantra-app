import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FileText, Type } from "lucide-react";

interface InlineEditableTextProps {
    value: string;
    onChange: (value: string) => void;
    isEditMode: boolean;
    title?: string;
    placeholder?: string;
    className?: string;
    variant?: "text" | "header";
    headerLevel?: 1 | 2 | 3;
    align?: "left" | "center" | "right";
}

export function InlineEditableText({
    value,
    onChange,
    isEditMode,
    title = "Text",
    placeholder = "Click to add text...",
    className,
    variant = "text",
    headerLevel = 2,
    align = "left",
}: InlineEditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const headerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing) {
            if (variant === "header" && headerRef.current) {
                headerRef.current.focus();
                headerRef.current.select();
            } else if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [isEditing, variant]);

    const handleBlur = () => {
        setIsEditing(false);
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setLocalValue(value);
            setIsEditing(false);
        }
        if (e.key === "Enter" && (variant === "header" || e.metaKey || e.ctrlKey)) {
            handleBlur();
        }
    };

    const alignClass = {
        left: "text-left",
        center: "text-center",
        right: "text-right",
    }[align];

    const headerSize = {
        1: "text-3xl font-bold",
        2: "text-2xl font-bold",
        3: "text-xl font-semibold",
    }[headerLevel];

    // Header variant
    if (variant === "header") {
        return (
            <div className={cn("h-full flex items-center p-4", alignClass, className)}>
                {isEditMode && isEditing ? (
                    <input
                        ref={headerRef}
                        type="text"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={cn(
                            "w-full bg-transparent border-none outline-none text-foreground",
                            headerSize,
                            alignClass,
                            "focus:ring-2 focus:ring-primary/20 rounded px-2 -mx-2"
                        )}
                    />
                ) : (
                    <div
                        onClick={() => isEditMode && setIsEditing(true)}
                        className={cn(
                            "w-full text-foreground",
                            headerSize,
                            alignClass,
                            isEditMode && "cursor-text hover:bg-primary/5 rounded px-2 -mx-2 transition-colors",
                            !localValue && "text-muted-foreground/50 italic"
                        )}
                    >
                        {localValue || placeholder}
                    </div>
                )}
            </div>
        );
    }

    // Text block variant
    return (
        <div className={cn("h-full flex flex-col p-4", className)}>
            <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            </div>

            {isEditMode && isEditing ? (
                <textarea
                    ref={inputRef}
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={cn(
                        "flex-1 w-full bg-muted/30 border border-border rounded-lg p-3",
                        "text-sm text-foreground leading-relaxed resize-none",
                        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                        "placeholder:text-muted-foreground/50"
                    )}
                />
            ) : (
                <div
                    onClick={() => isEditMode && setIsEditing(true)}
                    className={cn(
                        "flex-1 overflow-auto text-sm leading-relaxed",
                        isEditMode && "cursor-text hover:bg-muted/30 rounded-lg p-3 -m-3 transition-colors border border-transparent hover:border-border",
                        localValue ? "text-foreground" : "text-muted-foreground/50 italic"
                    )}
                >
                    {localValue || placeholder}
                </div>
            )}

            {isEditMode && !isEditing && (
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    Click to edit text
                </p>
            )}
        </div>
    );
}
