import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, Check, Link2, QrCode, Globe, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  dashboardTitle: string;
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
}

export function ShareModal({
  open,
  onOpenChange,
  dashboardId,
  dashboardTitle,
  isPublic,
  onTogglePublic,
}: ShareModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shareUrl = `${window.location.origin}/dashboard/${dashboardId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share URL copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Share Dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="w-5 h-5 text-emerald-500" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <Label className="text-sm font-medium">
                  {isPublic ? "Public Dashboard" : "Private Dashboard"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isPublic
                    ? "Anyone with the link can view"
                    : "Only you can view this dashboard"}
                </p>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={onTogglePublic} />
          </div>

          {/* Share Link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Share Link</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center px-3 py-2 bg-background border border-border rounded-lg overflow-hidden">
                <span className="text-sm text-muted-foreground truncate">
                  {shareUrl}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                className={cn(
                  "shrink-0 transition-colors",
                  copied && "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                )}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* QR Code Toggle */}
          <div className="space-y-3">
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <QrCode className="w-4 h-4" />
              {showQR ? "Hide QR Code" : "Show QR Code for mobile"}
            </button>

            {showQR && (
              <div className="flex justify-center p-6 bg-white rounded-lg border border-border">
                <QRCodeSVG
                  value={shareUrl}
                  size={160}
                  level="H"
                  includeMargin
                  className="rounded"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
