import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Database, Search, Loader2, RefreshCw, Eye, Trash2, Edit2, AlertTriangle, Link2, Terminal, CloudDownload, Check, X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { getConnections, deleteConnection, testConnection, ConnectionResponse, uploadFile, triggerSync, syncAllConnections, getSyncStatus, getAllSyncStatuses, SyncStatusResponse } from "@/lib/connections";
import { ConnectionModal } from "./ConnectionModal";
import { SchemaViewerModal } from "./SchemaViewerModal";
import { SyncProgressDialog } from "./SyncProgressDialog";
import { formatDistanceToNow } from "date-fns";
import { QueryExplorer } from "./QueryExplorer";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";
import { FileUp, FileType } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function ConnectionsView() {
    const [modalOpen, setModalOpen] = useState(false);
    const [schemaModalOpen, setSchemaModalOpen] = useState(false);
    const [progressOpen, setProgressOpen] = useState(false);
    const [view, setView] = useState<"list" | "query">("list");
    const [selectedConnection, setSelectedConnection] = useState<ConnectionResponse | null>(null);
    const [progressConnectionId, setProgressConnectionId] = useState<string | null>(null);
    const [connectionToEdit, setConnectionToEdit] = useState<ConnectionResponse | null>(null);
    const [connectionToDelete, setConnectionToDelete] = useState<ConnectionResponse | null>(null);
    const [search, setSearch] = useState("");
    const [testingId, setTestingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: connections, isLoading, refetch } = useQuery({
        queryKey: ["connections"],
        queryFn: getConnections,
    });

    const { data: syncStatuses } = useQuery({
        queryKey: ["syncStatus"],
        queryFn: getAllSyncStatuses,
        refetchInterval: 5000,
    });

    const getStatusForConn = (id: string) => syncStatuses?.find(s => s.connection_id === id);

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteConnection(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["connections"] });
            toast({ title: "Deleted", description: "Connection removed successfully." });
            setConnectionToDelete(null);
        },
        onError: (e: any) => {
            toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" });
        }
    });

    const uploadMutation = useMutation({
        mutationFn: (file: File) => uploadFile(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["connections"] });
            toast({ title: "Success", description: "Dataset uploaded successfully!" });
            setIsUploading(false);
        },
        onError: (e: any) => {
            toast({ title: "Upload Failed", description: e.message || "Failed to upload file", variant: "destructive" });
            setIsUploading(false);
        }
    });

    const syncMutation = useMutation({
        mutationFn: (connectionId: string) => triggerSync(connectionId),
        onSuccess: (data) => {
            toast({
                title: "Sync Started",
                description: data.status === "already_running" ? "Sync already in progress" : "Data sync started successfully"
            });
            setSyncingId(null);
            // Refetch sync status after a delay
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ["syncStatus"] }), 2000);
        },
        onError: (e: any) => {
            toast({ title: "Sync Failed", description: e.message || "Failed to start sync", variant: "destructive" });
            setSyncingId(null);
        }
    });

    const syncAllMutation = useMutation({
        mutationFn: () => syncAllConnections(),
        onSuccess: (data) => {
            const started = data.filter(r => r.status === "started").length;
            toast({
                title: "Sync All Started",
                description: `Started sync for ${started} connections`
            });
            setSyncingAll(false);
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ["syncStatus"] }), 2000);
        },
        onError: (e: any) => {
            toast({ title: "Sync All Failed", description: e.message || "Failed to sync all", variant: "destructive" });
            setSyncingAll(false);
        }
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            uploadMutation.mutate(file);
        }
    };

    const handleTestConnection = async (conn: ConnectionResponse) => {
        setTestingId(conn.id);
        const result = await testConnection(conn.id);
        setTestingId(null);

        toast({
            title: result.success ? "Connection Successful" : "Connection Failed",
            description: result.message,
            variant: result.success ? "default" : "destructive",
        });
    };

    const handleViewSchema = (conn: ConnectionResponse) => {
        setSelectedConnection(conn);
        setSchemaModalOpen(true);
    };

    const handleExplore = (conn: ConnectionResponse) => {
        setSelectedConnection(conn);
        setView("query");
    };

    const handleEdit = (conn: ConnectionResponse) => {
        setConnectionToEdit(conn);
        setModalOpen(true);
    };

    const handleSync = async (conn: ConnectionResponse) => {
        setSyncingId(conn.id);
        syncMutation.mutate(conn.id);
        setProgressConnectionId(conn.id);
        setProgressOpen(true);
    };

    const handleViewProgress = (connId: string) => {
        setProgressConnectionId(connId);
        setProgressOpen(true);
    };

    const handleSyncAll = async () => {
        setSyncingAll(true);
        syncAllMutation.mutate();
    };

    if (view === "query" && selectedConnection) {
        return (
            <QueryExplorer
                connectionId={selectedConnection.id}
                connectionName={selectedConnection.name}
                onBack={() => setView("list")}
            />
        );
    }

    const filteredConnections = connections?.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.database_name?.toLowerCase().includes(search.toLowerCase())) ||
        (c.host?.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden bg-background/50">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
                    <p className="text-muted-foreground">Manage your database sources.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={handleSyncAll}
                        disabled={syncingAll || !connections?.length}
                        className="gap-2"
                    >
                        {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                        Sync All
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".csv,.xlsx,.xls,.parquet,.tar.gz"
                        onChange={handleFileSelect}
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="gap-2 border-dashed"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                        Upload Dataset
                    </Button>
                    <Button onClick={() => { setConnectionToEdit(null); setModalOpen(true); }} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Connection
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center px-4 py-2 bg-card border border-border rounded-lg max-w-sm focus-within:ring-1 ring-primary/20 transition-all">
                    <Search className="w-4 h-4 text-muted-foreground mr-2" />
                    <Input
                        placeholder="Search connections..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-none shadow-none focus-visible:ring-0 bg-transparent h-auto p-0"
                    />
                </div>
                <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh List">
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm">Loading connections...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pt-2 pb-6">
                    {filteredConnections?.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-xl bg-card/30">
                            <Database className="w-12 h-12 mb-4 opacity-10" />
                            <p className="text-lg font-medium">No results found</p>
                            <p className="text-sm">Try a different search or add a new connection.</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredConnections?.map((conn) => (
                                <motion.div
                                    key={conn.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    whileHover={{ y: -4 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-visible"
                                >
                                    <Card className="hover:border-primary/50 transition-all group flex flex-col h-full shadow-sm hover:shadow-md bg-card/50 backdrop-blur-sm relative overflow-hidden">
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(conn)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConnectionToDelete(conn)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2 pr-12">
                                                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                    {conn.connection_type === "file" ? <FileType className="w-4 h-4" /> : (conn.connection_uri ? <Link2 className="w-4 h-4" /> : <Database className="w-4 h-4" />)}
                                                </div>
                                                <span className="truncate">{conn.name}</span>
                                            </CardTitle>
                                            <CardDescription className="truncate">
                                                {conn.connection_type === "file" ? "Local File Store" : (conn.connection_uri ? "String Connection" : `${conn.host}:${conn.port}`)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1">
                                            <div className="text-sm text-muted-foreground space-y-2">
                                                <div className="flex justify-between py-1 border-b border-border/30">
                                                    <span>Type</span>
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                                                        {conn.connection_type || "postgres"}
                                                    </Badge>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-border/30">
                                                    <span>Database</span>
                                                    <span className="font-medium text-foreground truncate ml-4">{conn.database_name || "N/A"}</span>
                                                </div>
                                                <div className="flex justify-between py-1">
                                                    <span>User</span>
                                                    <span className="font-medium text-foreground truncate ml-4">{conn.username || "Local"}</span>
                                                </div>

                                                {/* Sync Status Badge */}
                                                <div className="flex justify-between py-1 border-t border-border/30 mt-2 pt-2">
                                                    <span className="flex items-center gap-1.5">
                                                        <RefreshCw className="w-3 h-3 text-muted-foreground" />
                                                        Last Synced
                                                    </span>
                                                    {(() => {
                                                        const status = getStatusForConn(conn.id);
                                                        return (
                                                            <div
                                                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                                                onClick={() => handleViewProgress(conn.id)}
                                                            >
                                                                {status?.status === "running" && (
                                                                    <Badge variant="outline" className="border-blue-500 text-blue-500 gap-1 h-5 px-1.5 bg-blue-500/10">
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                        Syncing
                                                                    </Badge>
                                                                )}
                                                                {status?.status === "failed" && (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <Badge variant="destructive" className="h-5 px-1.5 gap-1">
                                                                                    <AlertTriangle className="w-3 h-3" />
                                                                                    Failed
                                                                                </Badge>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{status.error || "Sync failed"}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                                {status?.status === "success" && (
                                                                    <Badge variant="outline" className="border-green-500 text-green-500 gap-1 h-5 px-1.5 bg-green-500/10">
                                                                        <Check className="w-3 h-3" />
                                                                        Synced
                                                                    </Badge>
                                                                )}
                                                                <span className="text-xs text-muted-foreground">
                                                                    {status?.last_sync_at
                                                                        ? formatDistanceToNow(new Date(status.last_sync_at.endsWith("Z") ? status.last_sync_at : status.last_sync_at + "Z"), { addSuffix: true })
                                                                        : "Never"}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="pt-2 gap-2 bg-muted/20 border-t border-border/10">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 gap-2 border-transparent hover:border-border h-9"
                                                onClick={() => handleSync(conn)}
                                                disabled={syncingId === conn.id}
                                            >
                                                {syncingId === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                Sync
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 gap-1 h-9 px-2"
                                                onClick={() => handleViewSchema(conn)}
                                            >
                                                <Eye className="w-3 h-3" />
                                                Schema
                                            </Button>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="flex-1 gap-1 h-9 px-2 bg-primary/90 hover:bg-primary shadow-sm"
                                                onClick={() => handleExplore(conn)}
                                            >
                                                <Terminal className="w-3 h-3" />
                                                Explore
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            )}

            <ConnectionModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setConnectionToEdit(null); }}
                editingConnection={connectionToEdit}
            />

            <SchemaViewerModal
                open={schemaModalOpen}
                onOpenChange={setSchemaModalOpen}
                connectionId={selectedConnection?.id || null}
                connectionName={selectedConnection?.name || ""}
            />

            <SyncProgressDialog
                open={progressOpen}
                onOpenChange={setProgressOpen}
                connectionId={progressConnectionId}
            />

            <AlertDialog open={!!connectionToDelete} onOpenChange={(o) => !o && setConnectionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" /> Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the connection <span className="font-semibold text-foreground">"{connectionToDelete?.name}"</span>.
                            You will not be able to query this data source until you re-add it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => connectionToDelete && deleteMutation.mutate(connectionToDelete.id)}
                        >
                            Delete Source
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
