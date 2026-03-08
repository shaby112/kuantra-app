import { Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SQLPreviewCardProps {
  sql: string;
  isDangerous?: boolean;
  onExecute?: () => void;
  onReview?: () => void;
}

export function SQLPreviewCard({ sql, isDangerous, onExecute, onReview }: SQLPreviewCardProps) {
  return (
    <div className={cn(
      "sql-preview animate-fade-in",
      isDangerous && "border-destructive/50"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b border-border",
        isDangerous ? "bg-destructive/10" : "bg-muted/50"
      )}>
        <div className="flex items-center gap-2">
          {isDangerous && (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          )}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isDangerous ? "Destructive Query" : "SQL Query"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDangerous ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={onReview}
              className="h-7 text-xs"
            >
              Review Changes
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onExecute}
              className="h-7 text-xs gap-1.5"
            >
              <Play className="w-3 h-3" />
              Execute
            </Button>
          )}
        </div>
      </div>

      {/* Code */}
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-sm text-foreground">
          <code>{sql}</code>
        </pre>
      </div>
    </div>
  );
}
