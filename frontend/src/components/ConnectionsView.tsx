import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { Icon } from "@/components/Icon";
import { getConnections, deleteConnection, testConnection, ConnectionResponse, uploadFile, triggerSync, syncAllConnections, getAllSyncStatuses } from "@/lib/connections";
import { ConnectionModal } from "./ConnectionModal";
import { SchemaViewerModal } from "./SchemaViewerModal";
import { SyncProgressDialog } from "./SyncProgressDialog";
import { formatDistanceToNow } from "date-fns";
import { QueryExplorer } from "./QueryExplorer";
import { useToast } from "@/hooks/use-toast";
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
            const description = e?.status === 413 ? "File is too large. Maximum upload size is 200 MB." : e?.message || "Failed to upload file";
            toast({ title: "Upload Failed", description, variant: "destructive" });
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
            toast({ title: "Sync All Started", description: `Started sync for ${started} connections` });
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

    const activeCount = connections?.length || 0;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-obsidian-surface">
            <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full scrollbar-thin">
                {/* Page Header */}
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tighter text-white">Data Connections</h2>
                        <p className="text-obsidian-on-surface-variant mt-2 max-w-md">
                            Orchestrate your data pipeline through direct database syncs and file uploads.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls,.parquet,.tar.gz" onChange={handleFileSelect} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-4 py-2 bg-obsidian-surface-high border border-obsidian-outline-variant/20 text-obsidian-on-surface font-label text-xs uppercase tracking-widest hover:bg-obsidian-surface-highest transition-all disabled:opacity-50"
                        >
                            <Icon name={isUploading ? "hourglass_empty" : "upload_file"} size="sm" />
                            {isUploading ? "Uploading..." : "Upload Dataset"}
                        </button>
                        <button
                            onClick={() => { setConnectionToEdit(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-6 py-2 bg-obsidian-primary-container text-obsidian-surface font-label text-xs font-bold uppercase tracking-widest hover:bg-obsidian-primary transition-all rounded-lg"
                        >
                            <Icon name="add_link" size="sm" />
                            Connect
                        </button>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-0 mb-12 border border-obsidian-outline-variant/15 rounded-xl overflow-hidden">
                    <div className="bg-obsidian-surface-low p-6 border-r border-obsidian-outline-variant/15">
                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Active Sources</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{activeCount}</span>
                            <span className="text-obsidian-primary text-xs font-bold font-label">Connected</span>
                        </div>
                    </div>
                    <div className="bg-obsidian-surface-low p-6 border-r border-obsidian-outline-variant/15">
                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Data Types</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">
                                {new Set(connections?.map(c => c.connection_type || "postgres")).size || 0}
                            </span>
                            <span className="text-zinc-500 text-xs font-label">Unique Types</span>
                        </div>
                    </div>
                    <div className="bg-obsidian-surface-low p-6 border-r border-obsidian-outline-variant/15">
                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Sync Status</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">
                                {syncStatuses?.filter(s => s.status === "success").length || 0}
                            </span>
                            <span className="text-obsidian-primary text-xs font-label">Healthy</span>
                        </div>
                    </div>
                    <div className="bg-obsidian-surface-low p-6">
                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Global Sync</p>
                        <button
                            onClick={handleSyncAll}
                            disabled={syncingAll || !connections?.length}
                            className="flex items-center gap-2 text-obsidian-primary hover:text-obsidian-primary-dim transition-colors disabled:opacity-50"
                        >
                            <Icon name={syncingAll ? "hourglass_empty" : "sync"} size="sm" className={syncingAll ? "animate-spin" : ""} />
                            <span className="text-sm font-bold">{syncingAll ? "Syncing..." : "Sync All"}</span>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            className="w-full bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-obsidian-primary focus:border-obsidian-primary transition-all text-obsidian-on-surface placeholder:text-zinc-600"
                            placeholder="Search connections..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={() => refetch()} className="text-zinc-400 hover:text-obsidian-primary transition-colors p-2">
                        <Icon name="refresh" />
                    </button>
                </div>

                {/* Connection Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <Icon name="hourglass_empty" className="text-obsidian-primary animate-spin text-3xl" />
                            <p className="text-sm text-zinc-500 font-label uppercase tracking-widest">Loading connections...</p>
                        </div>
                    </div>
                ) : filteredConnections?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-obsidian-outline-variant/10 rounded-xl bg-obsidian-surface-low">
                        <Icon name="database" className="text-zinc-600 text-5xl mb-4" />
                        <p className="text-lg font-bold text-white">No connections found</p>
                        <p className="text-sm text-zinc-500 mt-1">Try a different search or add a new connection.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredConnections?.map((conn, idx) => {
                                const status = getStatusForConn(conn.id);
                                const isFirstAndBig = idx === 0 && filteredConnections.length > 1;
                                const isPrimary = isFirstAndBig;

                                return (
                                    <motion.div
                                        key={conn.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                                        className={isPrimary ? "col-span-12 lg:col-span-8" : "col-span-12 md:col-span-6 lg:col-span-4"}
                                    >
                                        <div className="bg-obsidian-surface-low border border-obsidian-outline-variant/10 rounded-xl p-6 relative overflow-hidden group hover:border-obsidian-outline-variant/30 transition-all">
                                            {isPrimary && (
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-obsidian-primary/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                                            )}

                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-obsidian-primary/10 border border-obsidian-primary/20 rounded-lg flex items-center justify-center">
                                                        <Icon
                                                            name={conn.connection_type === "file" ? "description" : "database"}
                                                            className="text-obsidian-primary"
                                                        />
                                                    </div>
                                                    <div>
                                                        <h3 className={`font-bold text-white ${isPrimary ? "text-xl" : "text-base"}`}>{conn.name}</h3>
                                                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500">
                                                            {conn.connection_type || "PostgreSQL"} {conn.connection_type !== "file" && conn.host ? `• ${conn.host}` : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    {/* Status badge */}
                                                    {status?.status === "running" && (
                                                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 font-label text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1 border border-blue-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                            Syncing
                                                        </span>
                                                    )}
                                                    {status?.status === "success" && (
                                                        <span className="px-3 py-1 bg-obsidian-primary/10 text-obsidian-primary font-label text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1 border border-obsidian-primary/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-obsidian-primary" />
                                                            Connected
                                                        </span>
                                                    )}
                                                    {status?.status === "failed" && (
                                                        <span className="px-3 py-1 bg-obsidian-error-container/20 text-obsidian-error font-label text-[10px] font-bold uppercase tracking-widest rounded-full border border-obsidian-error/20">
                                                            Action Required
                                                        </span>
                                                    )}
                                                    {!status && (
                                                        <span className="px-3 py-1 bg-zinc-500/10 text-zinc-400 font-label text-[10px] font-bold uppercase tracking-widest rounded-full border border-zinc-500/20">
                                                            Idle
                                                        </span>
                                                    )}

                                                    {/* Action buttons */}
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEdit(conn)} className="p-1.5 text-zinc-500 hover:text-obsidian-primary transition-colors">
                                                            <Icon name="edit" size="sm" />
                                                        </button>
                                                        <button onClick={() => setConnectionToDelete(conn)} className="p-1.5 text-zinc-500 hover:text-obsidian-error transition-colors">
                                                            <Icon name="delete" size="sm" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Connection details */}
                                            {isPrimary && (
                                                <div className="mt-8 grid grid-cols-3 gap-8 border-t border-obsidian-outline-variant/10 pt-6 relative z-10">
                                                    <div>
                                                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Database</p>
                                                        <p className="text-white font-medium">{conn.database_name || "N/A"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">User</p>
                                                        <p className="text-white font-medium font-label">{conn.username || "Local"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Last Sync</p>
                                                        <p className="text-white font-medium">
                                                            {status?.last_sync_at
                                                                ? formatDistanceToNow(new Date(status.last_sync_at.endsWith("Z") ? status.last_sync_at : status.last_sync_at + "Z"), { addSuffix: true })
                                                                : "Never"}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {!isPrimary && (
                                                <div className="mt-4 space-y-2">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-zinc-500">Database</span>
                                                        <span className="text-white font-label">{conn.database_name || "N/A"}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-zinc-500">Last Sync</span>
                                                        <span className="text-white">
                                                            {status?.last_sync_at
                                                                ? formatDistanceToNow(new Date(status.last_sync_at.endsWith("Z") ? status.last_sync_at : status.last_sync_at + "Z"), { addSuffix: true })
                                                                : "Never"}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="mt-6 flex gap-3 relative z-10">
                                                <button
                                                    onClick={() => handleViewSchema(conn)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-obsidian-surface-highest text-white font-label text-xs uppercase tracking-widest hover:bg-obsidian-primary/20 hover:text-obsidian-primary transition-all border border-obsidian-outline-variant/20"
                                                >
                                                    <Icon name="database" size="sm" />
                                                    Schema
                                                </button>
                                                <button
                                                    onClick={() => handleSync(conn)}
                                                    disabled={syncingId === conn.id}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-obsidian-surface-highest text-white font-label text-xs uppercase tracking-widest hover:bg-obsidian-secondary-purple/20 hover:text-obsidian-secondary transition-all border border-obsidian-outline-variant/20 disabled:opacity-50"
                                                >
                                                    <Icon name="sync" size="sm" className={syncingId === conn.id ? "animate-spin" : ""} />
                                                    Sync
                                                </button>
                                                <button
                                                    onClick={() => handleExplore(conn)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-obsidian-primary-container text-obsidian-surface font-label text-xs font-bold uppercase tracking-widest hover:bg-obsidian-primary transition-all rounded-lg"
                                                >
                                                    <Icon name="terminal" size="sm" />
                                                    Explore
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Modals */}
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
                <AlertDialogContent className="bg-obsidian-surface-mid border-obsidian-outline-variant/20">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-white">
                            <Icon name="warning" className="text-obsidian-error" /> Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-obsidian-on-surface-variant">
                            This will permanently delete the connection <span className="font-semibold text-white">"{connectionToDelete?.name}"</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-obsidian-surface-highest border-obsidian-outline-variant/20 text-white hover:bg-obsidian-surface-high">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-obsidian-error-container text-obsidian-error hover:bg-obsidian-error-container/80"
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
