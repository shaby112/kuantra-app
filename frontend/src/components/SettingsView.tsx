import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, getStoredLLMApiKey, setStoredLLMApiKey } from "@/lib/api";

export function SettingsView() {
    const { toast } = useToast();
    const [googleApiKey, setGoogleApiKey] = useState(() => getStoredLLMApiKey() ?? "");
    const [authEmail, setAuthEmail] = useState("");
    const [authGateLocked, setAuthGateLocked] = useState(false);
    const [licenseView, setLicenseView] = useState<"none" | "empty" | "active">("none");
    const [activeLicenseKey, setActiveLicenseKey] = useState("");
    const [modelTier, setModelTier] = useState<"Basic" | "Pro">("Pro");
    const [llmProvider, setLlmProvider] = useState<string>("gemini");
    const [configuredModel, setConfiguredModel] = useState<string>("");
    const [downloadState, setDownloadState] = useState<string>("idle");
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloadingModel, setIsDownloadingModel] = useState(false);
    const [downloadStartedAt, setDownloadStartedAt] = useState<number>(0);
    const [progressPollFailures, setProgressPollFailures] = useState(0);
    const [downloadError, setDownloadError] = useState<string>("");
    const [initialLoading, setInitialLoading] = useState(true);

    const emailDomain = useMemo(() => authEmail.split("@")[1]?.toLowerCase() ?? "", [authEmail]);
    const isEnterpriseDomain = emailDomain === "usekuantra.com";

    const handleSaveGoogleApiKey = () => {
        setStoredLLMApiKey(googleApiKey);
        toast({ title: "Saved", description: googleApiKey.trim() ? "Google API key saved for this browser." : "Google API key removed from this browser." });
    };

    const handleClearGoogleApiKey = () => {
        setGoogleApiKey("");
        setStoredLLMApiKey(null);
        toast({ title: "Removed", description: "Google API key removed from this browser." });
    };

    const handleSendMagicLink = () => {
        setAuthGateLocked(false);
        setLicenseView("empty");
        setActiveLicenseKey("");
        toast({ title: "Magic link sent", description: `A secure sign-in link was sent to ${authEmail || "your email"}.` });
    };

    const handleGoogleContinue = () => {
        setAuthGateLocked(false);
        setLicenseView("empty");
        setActiveLicenseKey("");
        toast({ title: "Google auth started", description: "Continue authentication via Google." });
    };

    const handleEnterpriseLogin = () => {
        setAuthGateLocked(true);
        setLicenseView("active");
        const domainSeed = (emailDomain || "enterprise").replace(/[^a-z]/g, "").slice(0, 8) || "enterprise";
        setActiveLicenseKey(`kuan_live_${domainSeed}_A9X4F2Q7`);
        toast({ title: "Enterprise SSO success", description: "Active enterprise license detected." });
    };

    const handleGenerateLicense = () => {
        const domainSeed = (emailDomain || "trial").replace(/[^a-z]/g, "").slice(0, 8) || "trial";
        const newKey = `kuan_live_${domainSeed}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        setActiveLicenseKey(newKey);
        setLicenseView("active");
        toast({ title: "License key generated", description: "Your live license key is now active." });
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [tierPayload, progress, health] = await Promise.all([
                    apiFetch<any>("/health/llm").catch(() => null),
                    apiFetch<any>("/api/v1/llm/download/progress", { auth: true }).catch(() => null),
                    apiFetch<any>("/api/v1/llm/health", { auth: true }).catch(() => null),
                ]);
                if (cancelled) return;

                // Tier detection
                const provider = tierPayload?.provider || "gemini";
                const isLocal = provider === "local" || provider === "ollama";
                setLlmProvider(provider);
                setModelTier(isLocal ? "Basic" : "Pro");
                if (tierPayload?.model) setConfiguredModel(tierPayload.model);

                // Download state detection
                if (progress) {
                    const status = progress?.status || "idle";
                    const pct = Number(progress?.progress_percent || 0);
                    const running = Boolean(progress?.running);
                    const modelPresent = Boolean(health?.model_present);
                    if (modelPresent && !running && (status === "idle" || status === "completed")) {
                        setDownloadState("completed"); setDownloadProgress(100); setIsDownloadingModel(false); setDownloadError("");
                    } else {
                        setDownloadState(status); setDownloadProgress(pct); setIsDownloadingModel(running); setDownloadError(progress?.error || "");
                        if (running) setDownloadStartedAt(Date.now());
                    }
                }
            } catch { /* ignore */ }
            finally {
                if (!cancelled) setInitialLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (llmProvider !== "local" && llmProvider !== "ollama") return;
        // Stop polling entirely once model is confirmed present and no download is active
        if (downloadState === "completed" && !isDownloadingModel) return;
        if (!isDownloadingModel && downloadState !== "completed") {
            // Do one-time check: if model is already present, just set completed and stop
            (async () => {
                try {
                    const health = await apiFetch<any>("/api/v1/llm/health", { auth: true });
                    if (health?.model_present) { setDownloadState("completed"); setDownloadProgress(100); setDownloadError(""); setIsDownloadingModel(false); }
                } catch { /* ignore */ }
            })();
            return;
        }
        const id = window.setInterval(async () => {
            try {
                const progress = await apiFetch<any>("/api/v1/llm/download/progress", { auth: true });
                const status = progress?.status || "idle";
                const pct = Number(progress?.progress_percent || 0);
                const running = Boolean(progress?.running);
                setProgressPollFailures(0); setDownloadProgress(pct); setIsDownloadingModel(running); setDownloadError(progress?.error || "");
                if (!running && ["completed", "failed"].includes(status)) {
                    setIsDownloadingModel(false);
                    setDownloadState(status);
                } else if (!running && status === "idle") {
                    try {
                        const health = await apiFetch<any>("/api/v1/llm/health", { auth: true });
                        if (health?.model_present) { setDownloadState("completed"); setDownloadProgress(100); setDownloadError(""); setIsDownloadingModel(false); }
                        else { setDownloadState("idle"); setIsDownloadingModel(false); }
                    } catch { setIsDownloadingModel(false); setDownloadState("idle"); }
                } else {
                    setDownloadState(status);
                }
            } catch {
                setProgressPollFailures((prev) => {
                    const next = prev + 1;
                    if (next >= 4) { setIsDownloadingModel(false); setDownloadState("failed"); }
                    return next;
                });
            }
        }, 2000);
        return () => window.clearInterval(id);
    }, [llmProvider, isDownloadingModel, downloadState]);

    const handleDownloadStarterModel = async () => {
        try {
            setIsDownloadingModel(true); setDownloadStartedAt(Date.now()); setProgressPollFailures(0); setDownloadError(""); setDownloadState("starting");
            const res = await apiFetch<any>("/api/v1/llm/download", { method: "POST", auth: true, body: JSON.stringify({ model: configuredModel || undefined }) });
            if (res?.started === false && res?.reason === "pull_already_running") {
                setDownloadState(res?.state?.status || "running"); setDownloadProgress(Number(res?.state?.progress_percent || 0)); setIsDownloadingModel(Boolean(res?.state?.running ?? true));
                toast({ title: "Download already running", description: "Continuing existing model download job." });
                return;
            }
            setDownloadState("starting"); setDownloadProgress(0);
            toast({ title: "Model download started", description: "Kuantra AI model is downloading in the background." });
        } catch (e: any) {
            setIsDownloadingModel(false); setDownloadState("failed"); setDownloadError(e?.message || "Could not start model download.");
            toast({ title: "Download failed", description: e?.message || "Could not start model download." });
        }
    };

    if (initialLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-obsidian-surface">
                <div className="flex flex-col items-center gap-3">
                    <Icon name="hourglass_empty" className="text-obsidian-primary animate-spin text-3xl" />
                    <p className="text-sm text-zinc-500 font-label uppercase tracking-widest">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-y-auto bg-obsidian-surface scrollbar-thin">
            <div className="max-w-6xl mx-auto p-6 lg:p-10 w-full">
                {/* Page Header */}
                <div className="mb-10">
                    <h1 className="text-xl font-bold text-obsidian-primary tracking-tighter font-headline">Workspace Settings</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Primary Controls */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Privacy & Security */}
                        <section className="bg-obsidian-surface-low rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Icon name="security" className="text-obsidian-primary" />
                                <h2 className="font-headline font-bold text-lg text-white">Privacy & Security</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-obsidian-surface-mid rounded-lg group hover:bg-obsidian-surface-high transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-obsidian-on-surface font-medium">Anonymize Analytics</span>
                                        <span className="text-obsidian-on-surface-variant text-xs font-label uppercase tracking-widest mt-1">Mask all PII data in export logs</span>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-obsidian-surface-mid rounded-lg group hover:bg-obsidian-surface-high transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-obsidian-on-surface font-medium">Secure SQL Transactions</span>
                                        <span className="text-obsidian-on-surface-variant text-xs font-label uppercase tracking-widest mt-1">Force encrypted tunneling for database writes</span>
                                    </div>
                                    <Switch />
                                </div>
                            </div>
                        </section>

                        {/* AI API Key */}
                        <section className="bg-obsidian-surface-low rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Icon name="key" className="text-obsidian-primary" />
                                <h2 className="font-headline font-bold text-lg text-white">AI API Key</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-label uppercase tracking-widest text-zinc-500 mb-2">Google Cloud AI Key</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            placeholder="Enter API Key"
                                            value={googleApiKey}
                                            onChange={(e) => setGoogleApiKey(e.target.value)}
                                            className="flex-1 bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 rounded-lg px-4 py-2.5 text-obsidian-on-surface focus:outline-none focus:border-obsidian-primary-container transition-all font-label text-sm"
                                        />
                                        <button
                                            onClick={handleSaveGoogleApiKey}
                                            className="bg-obsidian-primary-container hover:bg-obsidian-primary-dim text-obsidian-surface px-6 py-2.5 rounded-lg font-headline font-bold text-sm transition-all flex items-center gap-2"
                                        >
                                            <Icon name="save" size="sm" />
                                            Save Key
                                        </button>
                                        <button
                                            onClick={handleClearGoogleApiKey}
                                            className="bg-obsidian-surface-highest border border-obsidian-outline-variant/20 text-obsidian-on-surface px-4 py-2.5 rounded-lg font-headline text-sm transition-all hover:bg-obsidian-surface-high"
                                        >
                                            <Icon name="delete" size="sm" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* AI Model Config */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-obsidian-surface-low rounded-lg p-6 border-l-4 border-obsidian-primary">
                                <div className="flex items-center gap-2 mb-4">
                                    <Icon name="layers" className="text-obsidian-primary" />
                                    <h2 className="font-headline font-bold text-lg text-white">AI Tier</h2>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-headline font-black text-obsidian-on-surface tracking-tighter">{modelTier}</span>
                                    <span className="text-zinc-500 text-xs font-label uppercase">Subscription</span>
                                </div>
                                <p className="text-zinc-400 text-sm mt-2">
                                    {modelTier === "Pro" ? "Using cloud API with your API key." : "Privacy-first local AI inference."}
                                </p>
                            </div>

                            <div className="bg-obsidian-surface-low rounded-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Icon name="memory" className="text-obsidian-primary" />
                                    <h2 className="font-headline font-bold text-lg text-white">Kuantra AI</h2>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center bg-obsidian-surface px-3 py-2 rounded border border-obsidian-outline-variant/10">
                                        <span className="text-sm font-label">Kuantra AI (Local)</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-label ${downloadState === "completed" ? "bg-obsidian-primary-container/20 text-obsidian-primary" : downloadState === "failed" ? "bg-obsidian-error-container/20 text-obsidian-error" : "bg-zinc-500/20 text-zinc-400"}`}>
                                            {downloadState.toUpperCase()}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="h-1.5 w-full bg-obsidian-surface-highest rounded-full overflow-hidden">
                                        <div className="h-full bg-obsidian-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, downloadProgress))}%` }} />
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-zinc-500">
                                        <span className="font-label">{downloadProgress.toFixed(0)}% complete</span>
                                        <span className="font-label">Quantization: 4-bit</span>
                                    </div>
                                    {downloadError && <p className="text-xs text-obsidian-error break-all">{downloadError}</p>}
                                    <button
                                        onClick={handleDownloadStarterModel}
                                        disabled={isDownloadingModel || downloadState === "completed"}
                                        className="mt-2 w-full py-2 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 text-obsidian-on-surface font-label text-[10px] uppercase tracking-widest hover:bg-obsidian-primary/10 hover:text-obsidian-primary transition-all disabled:opacity-50"
                                    >
                                        {isDownloadingModel ? "Downloading..." : downloadState === "completed" ? "Model Ready" : "Download AI Model"}
                                    </button>
                                    {llmProvider !== "local" && llmProvider !== "ollama" && (
                                        <p className="text-xs text-amber-500 mt-1">Model can be pre-downloaded for local inference mode.</p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Auth Section */}
                        <section className="bg-obsidian-surface-low rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Icon name="lock" className="text-obsidian-primary" />
                                <h2 className="font-headline font-bold text-lg text-white">Authentication & License</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-label uppercase tracking-widest text-zinc-500 mb-2">Work Email</label>
                                    <input
                                        type="email"
                                        value={authEmail}
                                        disabled={authGateLocked}
                                        onChange={(e) => { setAuthEmail(e.target.value); setLicenseView("none"); }}
                                        placeholder="you@company.com"
                                        className="w-full bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label text-obsidian-on-surface focus:outline-none focus:border-obsidian-primary transition-all placeholder:text-zinc-600 disabled:opacity-50"
                                    />
                                </div>

                                {!authEmail.includes("@") ? (
                                    <p className="text-xs text-zinc-400">Enter an email to continue.</p>
                                ) : isEnterpriseDomain ? (
                                    <>
                                        <div className="rounded-lg border border-obsidian-primary/30 bg-obsidian-primary/10 px-3 py-2">
                                            <p className="text-xs text-obsidian-primary">Enterprise domain recognized. SSO-only login enforced.</p>
                                        </div>
                                        <button onClick={handleEnterpriseLogin} className="w-full py-3 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 text-white font-label text-xs uppercase tracking-widest hover:bg-obsidian-primary/10 hover:text-obsidian-primary transition-all flex items-center justify-center gap-2">
                                            <Icon name="business" size="sm" /> Log in with Enterprise SSO
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex gap-3">
                                        <button onClick={handleSendMagicLink} className="flex-1 py-3 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 text-white font-label text-xs uppercase tracking-widest hover:bg-obsidian-primary/10 hover:text-obsidian-primary transition-all flex items-center justify-center gap-2">
                                            <Icon name="auto_fix_high" size="sm" /> Magic Link
                                        </button>
                                        <button onClick={handleGoogleContinue} className="flex-1 py-3 bg-obsidian-surface-highest border border-obsidian-outline-variant/20 text-white font-label text-xs uppercase tracking-widest hover:bg-obsidian-primary/10 hover:text-obsidian-primary transition-all flex items-center justify-center gap-2">
                                            Continue with Google
                                        </button>
                                    </div>
                                )}

                                {licenseView === "empty" && (
                                    <div className="rounded-lg border border-obsidian-outline-variant/10 bg-obsidian-surface-mid p-4">
                                        <p className="text-sm font-medium text-white">No active licenses</p>
                                        <p className="mt-1 text-xs text-zinc-500">Generate a license key to activate this workspace.</p>
                                        <button onClick={handleGenerateLicense} className="mt-3 w-full py-2.5 bg-obsidian-primary-container text-obsidian-surface font-label text-xs font-bold uppercase tracking-widest hover:bg-obsidian-primary transition-all rounded-lg">
                                            Generate License Key
                                        </button>
                                    </div>
                                )}

                                {licenseView === "active" && (
                                    <div className="rounded-lg border border-obsidian-primary/30 bg-obsidian-primary/10 p-4">
                                        <p className="text-sm font-medium text-obsidian-primary">Active License Key</p>
                                        <p className="mt-2 rounded bg-obsidian-surface/40 px-3 py-2 font-mono text-xs text-obsidian-primary-dim">
                                            {activeLicenseKey || "kuan_live_..."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Metadata */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Status Card */}
                        <div className="bg-obsidian-surface-mid rounded-lg p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-obsidian-primary-container/5 rounded-full -mr-12 -mt-12 blur-2xl" />
                            <h3 className="font-label text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">System Status</h3>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full border-2 border-obsidian-primary-container/20 flex items-center justify-center">
                                        <Icon name="sensors" className="text-obsidian-primary-container" />
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-obsidian-primary-container rounded-full border-2 border-obsidian-surface-mid" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-headline font-bold text-obsidian-on-surface">Idle</span>
                                    <span className="text-xs text-zinc-500 font-label">Ready for next compute</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-obsidian-surface-low rounded-lg divide-y divide-obsidian-outline-variant/10 overflow-hidden">
                            <a className="flex items-center justify-between p-4 hover:bg-obsidian-surface-mid transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <Icon name="person_edit" className="text-zinc-400 group-hover:text-obsidian-primary" size="sm" />
                                    <span className="text-sm font-medium text-white">Edit Profile</span>
                                </div>
                                <Icon name="chevron_right" className="text-zinc-600" size="sm" />
                            </a>
                            <a className="flex items-center justify-between p-4 hover:bg-obsidian-surface-mid transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <Icon name="notifications_active" className="text-zinc-400 group-hover:text-obsidian-primary" size="sm" />
                                    <span className="text-sm font-medium text-white">Notifications</span>
                                </div>
                                <Icon name="chevron_right" className="text-zinc-600" size="sm" />
                            </a>
                            <a className="flex items-center justify-between p-4 hover:bg-obsidian-surface-mid transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <Icon name="file_export" className="text-zinc-400 group-hover:text-obsidian-primary" size="sm" />
                                    <span className="text-sm font-medium text-white">Data Export</span>
                                </div>
                                <Icon name="chevron_right" className="text-zinc-600" size="sm" />
                            </a>
                            <a className="flex items-center justify-between p-4 hover:bg-obsidian-error/5 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <Icon name="delete_forever" className="text-obsidian-error" size="sm" />
                                    <span className="text-sm font-medium text-obsidian-error">Delete Account</span>
                                </div>
                                <Icon name="priority_high" className="text-obsidian-error/30" size="sm" />
                            </a>
                        </div>

                        {/* Info Card */}
                        <div className="p-6 bg-obsidian-surface-highest/20 rounded-lg border border-obsidian-outline-variant/10">
                            <div className="flex items-start gap-3">
                                <Icon name="lightbulb" className="text-zinc-500 shrink-0" size="sm" />
                                <div className="space-y-2">
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        Optimize your workspace by connecting your own <span className="text-obsidian-primary">GPU cores</span> for local model inference.
                                    </p>
                                    <a className="inline-block text-[10px] font-label text-obsidian-primary uppercase tracking-widest underline decoration-obsidian-primary/30 cursor-pointer">
                                        View Documentation
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
