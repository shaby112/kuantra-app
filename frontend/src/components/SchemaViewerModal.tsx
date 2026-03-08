import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Table as TableIcon, AlertCircle, Database, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { getConnectionSchema } from "@/lib/connections";
import { DatabaseTable } from "./DatabaseTable"; // Placeholder for the actual data table if needed, or simply list tables
import { ColumnDef } from "@tanstack/react-table";

interface SchemaViewerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionId: string | null;
    connectionName: string;
}

export function SchemaViewerModal({
    open,
    onOpenChange,
    connectionId,
    connectionName,
}: SchemaViewerModalProps) {
    const { data: schema, isLoading, error, refetch } = useQuery({
        queryKey: ["connection-schema", connectionId],
        queryFn: () => (connectionId ? getConnectionSchema(connectionId) : Promise.resolve([])),
        enabled: !!connectionId && open,
    });

    // Transform schema into displayable format or just list tables
    // Schema is likely: [{ table: "users", columns: [...] }, ...]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <span className="font-mono">{connectionName}</span> Schema
                    </DialogTitle>
                    <DialogDescription>
                        View tables and columns in this database.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p>Fetching schema...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4 text-destructive p-6 text-center">
                                <AlertCircle className="w-12 h-12" />
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">Failed to load schema</h3>
                                    <p className="text-sm text-muted-foreground max-w-md">
                                        {(error as any).message || "Could not connect to the database."}
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => refetch()} className="gap-2">
                                    <RefreshCw className="w-4 h-4" /> Try Again
                                </Button>
                            </div>
                        </div>
                    ) : !schema || schema.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <TableIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p>No tables found in public schema.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-4">
                            <div className="grid gap-6 pb-6">
                                {schema.map((table: any) => (
                                    <motion.div
                                        key={table.table}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="border border-border/50 rounded-xl overflow-hidden bg-card/50"
                                    >
                                        <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2 font-medium">
                                                <TableIcon className="w-4 h-4 text-primary" />
                                                {table.table}
                                            </div>
                                            <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-full border border-border/50">
                                                {table.columns.length} columns
                                            </span>
                                        </div>
                                        <div className="divide-y divide-border/30">
                                            {table.columns.map((col: any) => (
                                                <div key={col.name} className="px-4 py-2 flex items-center justify-between text-sm hover:bg-muted/20 transition-colors">
                                                    <span className="font-mono text-foreground/80">{col.name}</span>
                                                    <span className="text-xs font-mono text-muted-foreground">{col.type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
