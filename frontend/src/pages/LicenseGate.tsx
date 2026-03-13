import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

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
      // TODO: wire to backend license verification endpoint when merged.
      localStorage.setItem("license_key", keyValue.trim());
      localStorage.setItem("access_token", keyValue.trim());
      toast({ title: "License verified", description: "Access granted." });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-6">
      <Card className="w-full max-w-lg border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <CardHeader>
          <CardTitle className="text-white">License Key Verification</CardTitle>
          <CardDescription>Enter your kuan_live_... key to unlock InsightOps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="license" className="text-zinc-200">License key</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="license"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="kuan_live_..."
              className="pl-9 h-12 bg-black/50 border-white/10 text-white font-mono placeholder:text-zinc-600"
            />
          </div>
          <Button
            onClick={verifyLicense}
            disabled={loading}
            className="w-full h-12 mt-4 bg-white/5 text-white border border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-white/20"
          >
            {loading ? "Verifying..." : "Verify License Key"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
