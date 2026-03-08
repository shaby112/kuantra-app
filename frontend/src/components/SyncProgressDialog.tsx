import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, X, Clock, AlertTriangle, CloudDownload, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getSyncProgress, cancelSync, SyncProgressResponse } from "@/lib/connections";
import { formatDistance, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface SyncProgressDialogProps {
    connectionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SyncProgressDialog({ connectionId, open, onOpenChange }: SyncProgressDialogProps) {
    const { data: progress, error, isError } = useQuery({
        queryKey: ["syncProgress", connectionId],
        queryFn: () => getSyncProgress(connectionId as string),
        enabled: !!connectionId && open,
        refetchInterval: (data) => {
            if (data?.status === "running" || data?.status === "pending") return 1000;
            return false;
        },
    });

    const handleCancel = async () => {
        if (connectionId) {
            try {
                await cancelSync(connectionId);
            } catch (e) {
                console.error("Failed to cancel sync", e);
            }
        }
    };

    const isLoading = !progress && !isError;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CloudDownload className="w-5 h-5 text-primary" />
                        Data Synchronization
                    </DialogTitle>
                    <DialogDescription>
                        Syncing data from source to analytical storage.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Initializing sync info...</p>
                        </div>
                    ) : isError ? (
                        <div className="flex flex-col items-center justify-center py-4 gap-2 text-destructive">
                            <AlertTriangle className="w-8 h-8" />
                            <p className="font-medium">Failed to load progress</p>
                            <p className="text-xs text-muted-foreground">{(error as any)?.message}</p>
                        </div>
                    ) : progress ? (
                        <>
                            {/* Status Banner */}
                            <div className={`rounded-lg border p-3 flex items-start gap-3 ${progress.status === "failed" ? "bg-destructive/10 border-destructive/20" :
                                progress.status === "success" ? "bg-green-500/10 border-green-500/20" :
                                    "bg-primary/5 border-primary/20"
                                }`}>
                                {progress.status === "running" && <Loader2 className="w-5 h-5 animate-spin text-primary mt-0.5" />}
                                {progress.status === "success" && <Check className="w-5 h-5 text-green-500 mt-0.5" />}
                                {progress.status === "failed" && <X className="w-5 h-5 text-destructive mt-0.5" />}

                                <div className="space-y-1 flex-1">
                                    <h4 className={`text-sm font-semibold capitalize ${progress.status === "failed" ? "text-destructive" :
                                        progress.status === "success" ? "text-green-600" :
                                            "text-foreground"
                                        }`}>
                                        Sync {progress.status}
                                    </h4>
                                    {progress.error && (
                                        <p className="text-xs text-destructive/80 font-mono bg-destructive/5 p-1 rounded">
                                            {progress.error}
                                        </p>
                                    )}
                                    {progress.status === "running" && (
                                        <p className="text-xs text-muted-foreground">
                                            Processing tables...
                                        </p>
                                    )}
                                    {progress.status === "success" && (
                                        <p className="text-xs text-muted-foreground">
                                            Completed successfully.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                    <span className="text-xs text-muted-foreground uppercase font-semibold">Rows Synced</span>
                                    <p className="text-2xl font-bold font-mono mt-1">
                                        {progress.rows_synced.toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                    <span className="text-xs text-muted-foreground uppercase font-semibold">Tables</span>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <span className="text-2xl font-bold">
                                            {progress.tables_completed.length}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            / {progress.tables_completed.length + progress.tables_pending.length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Overall Progress</span>
                                    <span>{progress.progress}%</span>
                                </div>
                                <Progress value={progress.progress} className="h-2" />
                            </div>

                            {/* Meta Info */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Started {format(new Date(progress.started_at), 'HH:mm:ss')}</span>
                                </div>
                                {progress.completed_at && (
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Took {formatDistance(new Date(progress.completed_at), new Date(progress.started_at))}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                    {progress?.status === "running" ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleCancel}
                            className="w-full sm:w-auto"
                        >
                            Stop Sync
                        </Button>
                    ) : (
                        <div />
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
