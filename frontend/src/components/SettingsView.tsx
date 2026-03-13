import { useMemo, useState } from "react";
import { Shield, Lock, Key, Bell, User, Database, Trash2, Building2, Mail, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getStoredLLMApiKey, setStoredLLMApiKey } from "@/lib/api";

export function SettingsView() {
    const { toast } = useToast();
    const [googleApiKey, setGoogleApiKey] = useState(() => getStoredLLMApiKey() ?? "");
    const [authEmail, setAuthEmail] = useState("");
    const [authGateLocked, setAuthGateLocked] = useState(false);
    const [licenseView, setLicenseView] = useState<"none" | "empty" | "active">("none");
    const [activeLicenseKey, setActiveLicenseKey] = useState("");

    const enterpriseDomains = ["acme.com", "globex.com", "kuantra.ai", "enterprise.io"];
    const emailDomain = useMemo(() => authEmail.split("@")[1]?.toLowerCase() ?? "", [authEmail]);
    const isEnterpriseDomain = enterpriseDomains.includes(emailDomain);
    const prismButtonClass = "w-full h-12 mt-4 bg-white/5 text-white border border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-white/20";

    const handleSaveGoogleApiKey = () => {
        setStoredLLMApiKey(googleApiKey);
        toast({
            title: "Saved",
            description: googleApiKey.trim()
                ? "Google API key saved for this browser."
                : "Google API key removed from this browser.",
        });
    };

    const handleClearGoogleApiKey = () => {
        setGoogleApiKey("");
        setStoredLLMApiKey(null);
        toast({
            title: "Removed",
            description: "Google API key removed from this browser.",
        });
    };

    const handleSendMagicLink = () => {
        setAuthGateLocked(false);
        setLicenseView("empty");
        setActiveLicenseKey("");
        toast({
            title: "Magic link sent",
            description: `A secure sign-in link was sent to ${authEmail || "your email"}.`,
        });
    };

    const handleGoogleContinue = () => {
        setAuthGateLocked(false);
        setLicenseView("empty");
        setActiveLicenseKey("");
        toast({
            title: "Google auth started",
            description: "Continue authentication via Google.",
        });
    };

    const handleEnterpriseLogin = () => {
        setAuthGateLocked(true);
        setLicenseView("active");
        const domainSeed = (emailDomain || "enterprise").replace(/[^a-z]/g, "").slice(0, 8) || "enterprise";
        setActiveLicenseKey(`kuan_live_${domainSeed}_A9X4F2Q7`);
        toast({
            title: "Enterprise SSO success",
            description: "Active enterprise license detected.",
        });
    };

    const handleGenerateLicense = () => {
        const domainSeed = (emailDomain || "trial").replace(/[^a-z]/g, "").slice(0, 8) || "trial";
        const newKey = `kuan_live_${domainSeed}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        setActiveLicenseKey(newKey);
        setLicenseView("active");
        toast({
            title: "License key generated",
            description: "Your live license key is now active.",
        });
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto bg-background/50">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your workspace preferences and security.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Security Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                Privacy & Security
                            </CardTitle>
                            <CardDescription>Control how your data is handled and secure your account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Anonymize Analytics</Label>
                                    <p className="text-sm text-muted-foreground">Hide sensitive values in AI-generated reports and previews.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Secure SQL Transactions</Label>
                                    <p className="text-sm text-muted-foreground">Always run write queries in dry-run mode first.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Two-Factor Authentication</Label>
                                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                                </div>
                                <Button variant="outline" size="sm">Enable 2FA</Button>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Session Timeout</Label>
                                    <p className="text-sm text-muted-foreground">Automatically log out after inactivity.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input type="number" className="w-20 h-8" defaultValue={30} />
                                    <span className="text-xs text-muted-foreground">min</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                AI API Key
                            </CardTitle>
                            <CardDescription>
                                Set your Google API key for AI analysis. The key is stored locally in your browser.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="google-api-key">Google API Key</Label>
                                <Input
                                    id="google-api-key"
                                    type="password"
                                    placeholder="AIza..."
                                    value={googleApiKey}
                                    onChange={(e) => setGoogleApiKey(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This key is sent as `X-Google-Api-Key` with requests from this browser.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button className="flex-1 gap-2" onClick={handleSaveGoogleApiKey}>
                                    <Lock className="w-4 h-4" />
                                    Save Key
                                </Button>
                                <Button className="flex-1 gap-2" variant="outline" onClick={handleClearGoogleApiKey}>
                                    <Trash2 className="w-4 h-4" />
                                    Clear Key
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                                <User className="w-4 h-4" /> Edit Profile
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                                <Bell className="w-4 h-4" /> Notifications
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                                <Database className="w-4 h-4" /> Data Export
                            </Button>
                            <Separator className="my-2" />
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10 text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" /> Delete Account
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border border-white/10 bg-[#0A0A0A] shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Unified Authentication & License</CardTitle>
                            <CardDescription>
                                Enter work email to route to the right auth flow.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="auth-gate-email" className="text-zinc-200">The Unified Gate</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                    <Input
                                        id="auth-gate-email"
                                        type="email"
                                        value={authEmail}
                                        disabled={authGateLocked}
                                        onChange={(e) => {
                                            setAuthEmail(e.target.value);
                                            setLicenseView("none");
                                        }}
                                        placeholder="you@company.com"
                                        className="h-12 border-white/10 bg-black/50 pl-9 font-mono text-sm text-white placeholder:text-zinc-600"
                                    />
                                </div>
                            </div>

                            {!authEmail.includes("@") ? (
                                <p className="text-xs text-zinc-400">Enter an email to continue.</p>
                            ) : isEnterpriseDomain ? (
                                <>
                                    <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                                        Enterprise domain recognized. SSO-only login enforced.
                                    </p>
                                    <Button className={prismButtonClass} onClick={handleEnterpriseLogin}>
                                        <Building2 className="mr-2 h-4 w-4" />
                                        Log in with Enterprise SSO
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button className={prismButtonClass} onClick={handleSendMagicLink}>
                                        <Wand2 className="mr-2 h-4 w-4 text-emerald-300" />
                                        Send Magic Link
                                    </Button>
                                    <Button className={prismButtonClass} variant="outline" onClick={handleGoogleContinue}>
                                        Continue with Google
                                    </Button>
                                </>
                            )}

                            {licenseView === "empty" && (
                                <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <p className="text-sm font-medium text-zinc-200">No active licenses</p>
                                    <p className="mt-1 text-xs text-zinc-500">Generate a license key to activate this workspace.</p>
                                    <Button className={prismButtonClass} onClick={handleGenerateLicense}>
                                        Generate License Key
                                    </Button>
                                </div>
                            )}

                            {licenseView === "active" && (
                                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                                    <p className="text-sm font-medium text-emerald-300">Active License Key</p>
                                    <p className="mt-2 rounded bg-black/40 px-3 py-2 font-mono text-xs text-emerald-200">
                                        {activeLicenseKey || "kuan_live_..."}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
