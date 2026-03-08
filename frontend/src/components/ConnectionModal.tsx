import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Database, Server, User, Key, CheckCircle2, Shield, Link2, Settings2, Laptop } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createConnection, updateConnection, testConnectionParams, ConnectionResponse, ConnectionCreate } from "@/lib/connections";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const connectionSchema = z.object({
    name: z.string().min(1, "Name is required"),
    host: z.string().optional().nullable(),
    port: z.coerce.number().int().optional().nullable(),
    database_name: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    connection_uri: z.string().optional().nullable(),
    connection_type: z.enum(["postgres", "mysql", "mongodb", "file"]).default("postgres"),
}).refine((data) => {
    if (data.connection_uri) return true;
    return !!(data.host && data.database_name && data.username);
}, {
    message: "Host, Database, and Username are required unless using URI",
    path: ["host"],
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

interface ConnectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingConnection?: ConnectionResponse | null;
}

export function ConnectionModal({ open, onOpenChange, editingConnection }: ConnectionModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [step, setStep] = useState<"form" | "success">("form");
    const [mode, setMode] = useState<"params" | "uri">(editingConnection?.connection_uri ? "uri" : "params");
    const [isTesting, setIsTesting] = useState(false);

    const isEdit = !!editingConnection;

    const {
        register,
        handleSubmit,
        reset,
        getValues,
        setValue,
        watch,
        formState: { errors },
    } = useForm<ConnectionFormValues>({
        resolver: zodResolver(connectionSchema),
        defaultValues: {
            port: 5432,
            connection_type: "postgres",
        },
    });

    // Helper to update port when type changes
    const onTypeChange = (type: string) => {
        setValue("connection_type", type as any);
        if (type === "mysql") setValue("port", 3306);
        else if (type === "mongodb") setValue("port", 27017);
        else setValue("port", 5432);
    };

    useEffect(() => {
        if (open) {
            if (editingConnection) {
                reset({
                    name: editingConnection.name,
                    host: editingConnection.host,
                    port: editingConnection.port,
                    database_name: editingConnection.database_name,
                    username: editingConnection.username,
                    connection_uri: editingConnection.connection_uri,
                    password: "", // Don't pre-fill password for security
                });
                setMode(editingConnection.connection_uri ? "uri" : "params");
            } else {
                reset({
                    name: "",
                    host: "localhost",
                    port: 5432,
                    database_name: "",
                    username: "",
                    password: "",
                    connection_uri: "",
                });
                setMode("params");
            }
            setStep("form");
        }
    }, [open, editingConnection, reset]);

    const mutation = useMutation({
        mutationFn: (data: any) => {
            if (isEdit && editingConnection) {
                return updateConnection(editingConnection.id, data);
            }
            return createConnection(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["connections"] });
            setStep("success");
            setTimeout(() => {
                onOpenChange(false);
                setStep("form");
            }, 1500);
            toast({
                title: isEdit ? "Connection Updated" : "Connection Added",
                description: "Your database connection has been saved.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save connection.",
                variant: "destructive",
            });
        },
    });

    const handleTest = async () => {
        const values = getValues();
        setIsTesting(true);
        try {
            const result = await testConnectionParams({
                host: mode === "params" ? values.host : null,
                port: mode === "params" ? values.port : null,
                database_name: mode === "params" ? values.database_name : null,
                username: mode === "params" ? values.username : null,
                password: values.password || (isEdit ? null : ""), // Use current password input or null if editing
                connection_uri: mode === "uri" ? values.connection_uri : null,
            });
            if (result.success) {
                toast({
                    title: "Test Successful",
                    description: result.message,
                });
            } else {
                toast({
                    title: "Test Failed",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (e: any) {
            toast({
                title: "Test Error",
                description: e.message || "Could not complete test.",
                variant: "destructive",
            });
        } finally {
            setIsTesting(false);
        }
    };

    const onSubmit = (data: ConnectionFormValues) => {
        // Prepare payload based on mode
        const payload: any = { ...data };
        if (mode === "params") {
            payload.connection_uri = null;
        } else {
            payload.host = null;
            payload.port = null;
            payload.database_name = null;
            payload.database_name = null;
            payload.username = null;
        }
        // Ensure connection_type is set
        if (!payload.connection_type) payload.connection_type = "postgres";
        mutation.mutate(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl">
                <AnimatePresence mode="wait">
                    {step === "form" ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    {isEdit ? "Edit Connection" : "New Connection"}
                                </DialogTitle>
                                <DialogDescription>
                                    Connect to your database via parameters or connection string.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4 pb-2">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Friendly Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g. Analytics Prod DB"
                                            {...register("name")}
                                            className={cn(errors.name && "border-destructive")}
                                        />
                                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Connection Type</Label>
                                        <div className="flex gap-2 p-1 bg-muted rounded-lg">
                                            {["postgres", "mysql", "mongodb"].map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => onTypeChange(type)}
                                                    className={cn(
                                                        "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                                                        watch("connection_type") === type
                                                            ? "bg-primary text-primary-foreground shadow-sm"
                                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                                    )}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 mb-4">
                                            <TabsTrigger value="params" className="gap-2">
                                                <Laptop className="w-4 h-4" /> Parameters
                                            </TabsTrigger>
                                            <TabsTrigger value="uri" className="gap-2">
                                                <Link2 className="w-4 h-4" /> URI String
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="params" className="space-y-4 pt-2">
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="col-span-3 space-y-2">
                                                    <Label htmlFor="host">Host</Label>
                                                    <div className="relative">
                                                        <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            id="host"
                                                            className="pl-9"
                                                            placeholder={
                                                                watch("connection_type") === "mysql" ? "mysql.example.com" :
                                                                    watch("connection_type") === "mongodb" ? "cluster0.mongo.net" :
                                                                        "aws-pooler.supabase.com"
                                                            }
                                                            {...register("host")}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="port">Port</Label>
                                                    <Input id="port" type="number" {...register("port")} />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="database_name">Database Name</Label>
                                                <Input
                                                    id="database_name"
                                                    placeholder={
                                                        watch("connection_type") === "mysql" ? "ecommerce_db" :
                                                            watch("connection_type") === "mongodb" ? "analytics" :
                                                                "postgres"
                                                    }
                                                    {...register("database_name")}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="username">Username</Label>
                                                    <Input
                                                        id="username"
                                                        placeholder={
                                                            watch("connection_type") === "mongodb" ? "app_user" :
                                                                "postgres.admin"
                                                        }
                                                        {...register("username")}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="password">Password</Label>
                                                    <Input id="password" type="password" placeholder={isEdit ? "••••••••" : "Password"} {...register("password")} />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="uri" className="space-y-4 pt-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="connection_uri">Connection URI (DSN)</Label>
                                                <div className="relative">
                                                    <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="connection_uri"
                                                        className="pl-9"
                                                        placeholder={
                                                            watch("connection_type") === "mysql" ? "mysql://user:pass@host:3306/db" :
                                                                watch("connection_type") === "mongodb" ? "mongodb+srv://user:pass@cluster.net/db" :
                                                                    "postgresql://user:pass@host:5432/dbname"
                                                        }
                                                        {...register("connection_uri")}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Supports standard connection strings.
                                                </p>
                                            </div>
                                            {isEdit && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="password_uri">Override Password (Optional)</Label>
                                                    <Input id="password_uri" type="password" placeholder="Leave empty to keep existing" {...register("password")} />
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/10">
                                    <Shield className="w-4 h-4 text-primary" />
                                    PgBouncer detected? We automatically optimize connections for high-performance pooling.
                                </div>

                                <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                                    <div className="flex gap-2 w-full justify-between">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="gap-2"
                                            onClick={handleTest}
                                            disabled={isTesting}
                                        >
                                            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                                            Test Connection
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                                Cancel
                                            </Button>
                                            <Button type="submit" disabled={mutation.isPending} className="gap-2 min-w-[120px]">
                                                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {isEdit ? "Save Changes" : "Add Connection"}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogFooter>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                        >
                            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Successfully {isEdit ? "Updated" : "Connected"}</h3>
                                <p className="text-muted-foreground">Your {mode === "params" ? "parameters" : "URI"} were validated and saved.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
