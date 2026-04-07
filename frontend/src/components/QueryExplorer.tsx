
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Play, Loader2, Table as TableIcon, AlertCircle, Save, Database,
    ChevronLeft, Terminal, History, Search, LayoutGrid, ChevronRight,
    Shield, ShieldAlert, ShieldCheck, Clock, FileJson, Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
    executeQuery, getTableData, getConnectionSchema, getQueryHistory,
    ExecuteResponse, QueryHistoryResponse, TableSchema
} from "@/lib/connections";
import { DatabaseTable } from "./DatabaseTable";
import { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface QueryExplorerProps {
    connectionId: string;
    connectionName: string;
    onBack: () => void;
}

type ExplorerTab = "browser" | "console" | "history";

export function QueryExplorer({ connectionId, connectionName, onBack }: QueryExplorerProps) {
    const [activeTab, setActiveTab] = useState<ExplorerTab>("browser");
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [searchTable, setSearchTable] = useState("");
    const [sql, setSql] = useState("SELECT 1;");
    const [bypassSafety, setBypassSafety] = useState(false);
    const [queryResults, setQueryResults] = useState<ExecuteResponse | null>(null);

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Data Fetching
    const { data: schema, isLoading: isSchemaLoading } = useQuery({
        queryKey: ["schema", connectionId],
        queryFn: () => getConnectionSchema(connectionId),
    });

    const { data: tableData, isLoading: isTableLoading } = useQuery({
        queryKey: ["tableData", connectionId, selectedTable],
        queryFn: () => getTableData(connectionId, selectedTable!),
        enabled: !!selectedTable && activeTab === "browser",
    });

    const { data: history, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
        queryKey: ["history", connectionId],
        queryFn: () => getQueryHistory(connectionId),
        enabled: activeTab === "history",
    });

    const executeMutation = useMutation({
        mutationFn: (sql: string) => executeQuery(connectionId, { sql, bypass_safety: bypassSafety }),
        onSuccess: (data) => {
            setQueryResults(data);
            queryClient.invalidateQueries({ queryKey: ["history", connectionId] });
            toast({
                title: "Query Executed",
                description: `Successfully returned ${data.row_count} rows.`,
            });
        },
        onError: (error: any) => {
            toast({
                title: "Execution Error",
                description: error.message || "Failed to run query.",
                variant: "destructive",
            });
        },
    });

    const normalizeSqlForExecution = (rawSql: string): string => {
        let q = rawSql.trim();

        // Common user typo: LIMIT before WHERE.
        q = q.replace(/^(\s*select[\s\S]*?\sfrom\s+[\w.\"`]+)\s+limit\s+(\d+)\s+where\s+([\s\S]*?);?$/i, "$1 WHERE $3 LIMIT $2;");

        // Common typo in DuckDB/Postgres string literals: = "VC" -> = 'VC'
        // Only rewrite when preceded by a comparison operator to avoid
        // mangling double-quoted identifiers (e.g. "My Table").
        q = q.replace(/((?:=|!=|<>|<=?|>=?)\s*)"([^"]*)"/g, "$1'$2'");

        return q;
    };

    const handleRunQuery = () => {
        if (!sql.trim()) return;
        const normalized = normalizeSqlForExecution(sql);
        if (normalized !== sql) {
            setSql(normalized);
        }
        executeMutation.mutate(normalized);
    };

    const filteredSchema = useMemo(() => {
        if (!schema) return [];
        return schema.filter(t => t.table.toLowerCase().includes(searchTable.toLowerCase()));
    }, [schema, searchTable]);

    useEffect(() => {
        if (!schema || schema.length === 0) return;
        if (selectedTable) return;

        const firstTable = schema[0]?.table;
        if (!firstTable) return;

        setSelectedTable(firstTable);
        setSql(`SELECT * FROM "${firstTable}" LIMIT 10;`);
    }, [schema, selectedTable]);

    // Helpers to create TanStack columns
    const generateColumns = (data: any[]): ColumnDef<any>[] => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]).map(key => ({
            accessorKey: key,
            header: key,
            cell: (info) => {
                const value = info.getValue();
                if (typeof value === "object" && value !== null) return JSON.stringify(value);
                return String(value ?? "");
            }
        }));
    };

    return (
        <div className="h-full flex flex-col bg-background/50 overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/30 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-muted/50">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold tracking-tight">{connectionName}</h1>
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                Postgres
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Connected and Live
                        </p>
                    </div>
                </div>

                <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
                    {[
                        { id: "browser", icon: LayoutGrid, label: "Data Browser" },
                        { id: "console", icon: Terminal, label: "SQL Console" },
                        { id: "history", icon: History, label: "History" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as ExplorerTab)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeTab === tab.id
                                    ? "bg-background text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-border/30">
                        <Label htmlFor="safety-mode" className="text-xs font-medium text-muted-foreground cursor-pointer">
                            {bypassSafety ? "Bypass Mode" : "Protected"}
                        </Label>
                        <Switch
                            id="safety-mode"
                            checked={bypassSafety}
                            onCheckedChange={setBypassSafety}
                            className="data-[state=checked]:bg-amber-500 scale-75"
                        />
                        {bypassSafety ? <ShieldAlert className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Only for Browser and Console? Browser mostly */}
                <aside className={cn(
                    "w-72 border-r border-border/50 bg-card/20 flex flex-col transition-all duration-300",
                    activeTab === "history" && "w-0 opacity-0 pointer-events-none border-none"
                )}>
                    <div className="p-4 border-b border-border/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search tables..."
                                className="pl-8 h-9 text-xs"
                                value={searchTable}
                                onChange={(e) => setSearchTable(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {isSchemaLoading ? (
                            <div className="py-8 flex justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredSchema.map((t) => (
                                    <button
                                        key={t.table}
                                        onClick={() => {
                                            setSelectedTable(t.table);
                                            if (activeTab === "console") {
                                                setSql(`SELECT * FROM "${t.table}" LIMIT 10;`);
                                            } else {
                                                setActiveTab("browser");
                                            }
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                            selectedTable === t.table
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                    >
                                        <TableIcon className="w-4 h-4 opacity-70" />
                                        <span className="truncate flex-1 text-left">{t.table}</span>
                                        {selectedTable === t.table && <ChevronRight className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {activeTab === "browser" && (
                            <motion.div
                                key="browser"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col p-6"
                            >
                                {selectedTable ? (
                                    <div className="flex flex-col h-full space-y-4">
                                        <div className="flex justify-between items-center bg-card/40 p-4 rounded-xl border border-border/50 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                    <LayoutGrid className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold tracking-tight">{selectedTable}</h3>
                                                    <p className="text-xs text-muted-foreground">Viewing all records with auto-limit</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab("console")}>
                                                <Terminal className="w-4 h-4" />
                                                Query this Table
                                            </Button>
                                        </div>

                                        <Card className="flex-1 overflow-hidden flex flex-col border-border/50 shadow-inner bg-card/30">
                                            <CardContent className="p-0 flex-1 relative overflow-auto">
                                                {isTableLoading ? (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                                                    </div>
                                                ) : tableData ? (
                                                    <div className="p-4">
                                                        <DatabaseTable
                                                            data={tableData.results}
                                                            columns={generateColumns(tableData.results)}
                                                        />
                                                    </div>
                                                ) : null}
                                            </CardContent>
                                        </Card>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                                        <div className="p-6 rounded-full bg-muted/20 border border-dashed border-border/50">
                                            <LayoutGrid className="w-12 h-12 opacity-20" />
                                        </div>
                                        <p className="text-lg font-medium text-foreground/50">Select a table to start browsing data</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === "console" && (
                            <motion.div
                                key="console"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col p-6 space-y-4"
                            >
                                <div className="grid grid-rows-[300px_1fr] gap-4 h-full">
                                    <Card className="flex flex-col border-border/50 bg-card/20 shadow-lg overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/40 backdrop-blur-sm">
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <Terminal className="w-4 h-4 text-primary" />
                                                SQL Editor
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={handleRunQuery}
                                                    disabled={executeMutation.isPending}
                                                    className="gap-2 px-4 shadow-primary/20 shadow-lg"
                                                >
                                                    {executeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                    Execute
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-black/10">
                                            <Textarea
                                                value={sql}
                                                onChange={(e) => setSql(e.target.value)}
                                                className="w-full h-full border-none focus-visible:ring-0 font-mono text-sm p-4 bg-transparent resize-none leading-relaxed"
                                                spellCheck={false}
                                            />
                                        </div>
                                    </Card>

                                    <Card className="flex flex-col border-border/50 bg-card/20 shadow-inner overflow-hidden">
                                        <div className="px-4 py-2 border-b border-border/50 bg-muted/10 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                <LayoutGrid className="w-3.5 h-3.5" />
                                                Query Results
                                            </div>
                                            {queryResults && (
                                                <div className="flex items-center gap-4 text-xs">
                                                    <span className="text-muted-foreground">Execution: <span className="text-foreground font-mono">{(executeMutation.data as any)?.execution_time_ms ?? 0}ms</span></span>
                                                    <span className="text-muted-foreground">Rows: <span className="text-foreground font-mono">{queryResults.row_count}</span></span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-auto p-4 relative">
                                            {executeMutation.isPending ? (
                                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px] z-10">
                                                    <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                                                </div>
                                            ) : queryResults ? (
                                                <DatabaseTable
                                                    data={queryResults.results}
                                                    columns={generateColumns(queryResults.results)}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 italic text-sm">
                                                    No results to display. Run a query!
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === "history" && (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full flex flex-col p-6 space-y-4 max-w-6xl mx-auto w-full"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                                            <Clock className="w-6 h-6 text-primary" />
                                            Query History
                                        </h2>
                                        <p className="text-sm text-muted-foreground">Analyze and re-run your past database operations</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => refetchHistory()} className="gap-2">
                                        <History className="w-4 h-4" />
                                        Refresh Log
                                    </Button>
                                </div>

                                <Separator className="bg-border/40" />

                                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                    {isHistoryLoading ? (
                                        <div className="h-40 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary/20" />
                                        </div>
                                    ) : history?.length === 0 ? (
                                        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 border border-dashed border-border rounded-2xl bg-muted/10">
                                            <Clock className="w-8 h-8 opacity-20" />
                                            <p>No queries recorded yet.</p>
                                        </div>
                                    ) : (
                                        history?.map((entry) => (
                                            <Card key={entry.id} className="group hover:border-primary/40 transition-all bg-card/40 shadow-sm overflow-hidden">
                                                <div className="flex items-center justify-between p-3 border-b border-border/30 bg-muted/10">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant={entry.status === "success" ? "outline" : "destructive"} className={cn(
                                                            "text-[10px] uppercase font-bold",
                                                            entry.status === "success" && "bg-green-500/5 text-green-500 border-green-500/20"
                                                        )}>
                                                            {entry.status}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(entry.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                            onClick={() => {
                                                                setSql(entry.sql_query);
                                                                setActiveTab("console");
                                                            }}
                                                        >
                                                            <FileJson className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="h-7 px-3 text-[10px] font-bold uppercase"
                                                            onClick={() => {
                                                                setSql(entry.sql_query);
                                                                setActiveTab("console");
                                                                // Auto trigger after a slight delay? 
                                                            }}
                                                        >
                                                            Re-run
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-muted/5 flex items-start gap-4">
                                                    <div className="flex-1">
                                                        <code className="text-sm font-mono block whitespace-pre-wrap text-foreground/80 line-clamp-3">
                                                            {entry.sql_query}
                                                        </code>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <div className="text-xs text-muted-foreground">Rows: <span className="text-foreground font-bold">{entry.row_count}</span></div>
                                                        <div className="text-xs text-muted-foreground">Time: <span className="text-foreground font-bold">{entry.execution_time_ms}ms</span></div>
                                                    </div>
                                                </div>
                                                {entry.error_message && (
                                                    <div className="px-4 py-2 bg-destructive/5 text-destructive text-[11px] font-mono border-t border-destructive/10">
                                                        Error: {entry.error_message}
                                                    </div>
                                                )}
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
