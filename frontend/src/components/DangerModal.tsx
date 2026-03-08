import { AlertTriangle, X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DangerModalProps {
  open: boolean;
  onClose: () => void;
  sql: string;
  onReject: () => void;
  onConfirm: () => void;
}

const mockChanges = [
  {
    row: "User #127",
    field: "status",
    oldValue: "active",
    newValue: "inactive",
  },
  {
    row: "User #234",
    field: "status",
    oldValue: "active",
    newValue: "inactive",
  },
  {
    row: "User #456",
    field: "status",
    oldValue: "active",
    newValue: "inactive",
  },
];

export function DangerModal({ open, onClose, sql, onReject, onConfirm }: DangerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-destructive/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            ⚠️ Review Changes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">
              This query will modify <strong>3 rows</strong> in your database. 
              Review the changes below before proceeding.
            </p>
          </div>

          {/* SQL Preview */}
          <div className="sql-preview">
            <div className="px-4 py-2 border-b border-border bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Query to Execute
              </span>
            </div>
            <div className="p-4">
              <pre className="font-mono text-sm text-foreground">
                <code>{sql}</code>
              </pre>
            </div>
          </div>

          {/* Diff View */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Affected Rows</h4>
            <div className="border border-border rounded-lg overflow-hidden">
              {mockChanges.map((change, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {change.row}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {change.field}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="diff-removed px-2 py-1 rounded text-xs font-mono">
                      {change.oldValue}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="diff-added px-2 py-1 rounded text-xs font-mono">
                      {change.newValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onReject}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reject (Rollback)
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Confirm (Commit)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
