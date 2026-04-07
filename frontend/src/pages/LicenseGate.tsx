import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";

export default function LicenseGate() {
  const [keyValue, setKeyValue] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const verifyLicense = async () => {
    if (!keyValue.startsWith("kuan_live_")) {
      toast({ title: "Invalid key", description: "License key must start with kuan_live_", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem("license_key", keyValue.trim());
      localStorage.setItem("access_token", keyValue.trim());
      toast({ title: "License verified", description: "Access granted." });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && keyValue.trim()) verifyLicense();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-obsidian-surface">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-obsidian-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-obsidian-secondary-purple/5 rounded-full blur-[120px]" />

      <main className="w-full max-w-[480px] z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showText={false} className="mb-4" />
          <div className="flex items-center gap-2">
            <span className="font-label uppercase tracking-[0.2em] text-[10px] text-obsidian-primary font-bold">Secure Environment</span>
            <div className="w-1 h-1 rounded-full bg-obsidian-primary animate-pulse" />
          </div>
        </div>

        {/* Activation Card */}
        <div className="bg-obsidian-surface-mid rounded-lg border border-obsidian-outline-variant/15 p-10 relative shadow-2xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-headline text-2xl font-bold tracking-tight text-obsidian-on-surface mb-2">
              Activate Kuantra
            </h1>
            <p className="text-sm text-obsidian-on-surface-variant/80 leading-relaxed">
              Enter your enterprise license key to begin.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* License Key Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-label uppercase tracking-widest text-[10px] text-obsidian-on-surface-variant font-medium">
                  Enterprise License Key
                </label>
                <Icon name="verified_user" size="sm" className="text-obsidian-outline-variant" />
              </div>
              <input
                type="text"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="kuan_live_..."
                className="w-full bg-obsidian-surface-lowest border border-obsidian-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label tracking-wider focus:outline-none focus:border-obsidian-primary transition-all duration-150 text-obsidian-on-surface placeholder:text-obsidian-outline/40"
              />
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <button
                onClick={verifyLicense}
                disabled={loading || !keyValue.trim()}
                className="w-full bg-obsidian-primary-container text-obsidian-surface font-headline font-bold py-3.5 rounded-lg hover:bg-obsidian-primary transition-all duration-150 active:scale-[0.98] text-sm tracking-tight flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Activate Workspace"}
                <Icon name="bolt" size="sm" />
              </button>
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="mt-8 pt-8 border-t border-obsidian-outline-variant/10 flex flex-col items-center gap-4">
            <a
              href="https://kuantra.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-label uppercase tracking-[0.15em] text-[10px] text-obsidian-on-surface-variant hover:text-obsidian-primary transition-colors flex items-center gap-2"
            >
              Get a key
              <Icon name="open_in_new" size="sm" />
            </a>
          </div>
        </div>

        {/* Footer Metadata */}
        <div className="mt-10 flex justify-between items-center px-2">
          <div className="flex flex-col">
            <span className="font-label text-[9px] uppercase tracking-widest text-obsidian-outline-variant">System Status</span>
            <span className="font-label text-[10px] text-obsidian-on-surface-variant font-medium">Nodes Operational</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-label text-[9px] uppercase tracking-widest text-obsidian-outline-variant">Version</span>
            <span className="font-label text-[10px] text-obsidian-on-surface-variant font-medium tracking-tight">V2.4.0-STABLE</span>
          </div>
        </div>
      </main>
    </div>
  );
}
