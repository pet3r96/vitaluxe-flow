import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, QrCode, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  sessionId: string;
  trigger?: React.ReactNode;
}

export function GuestLinkGenerator({ sessionId, trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [expiresIn, setExpiresIn] = useState("24");
  const [generatedLink, setGeneratedLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [showQR, setShowQR] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-guest-link', {
        body: {
          sessionId,
          guestName: guestName || undefined,
          expiresInHours: parseInt(expiresIn)
        }
      });

      if (error) throw error;

      const fullUrl = `${window.location.origin}/video/guest/${data.token}`;
      setGeneratedLink(fullUrl);
      setExpiresAt(data.expiresAt);

      toast({
        title: "Guest link generated",
        description: "Share this link with your guest to allow them to join",
      });
    } catch (error: any) {
      console.error('Failed to generate guest link:', error);
      toast({
        title: "Failed to generate link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({
      title: "Link copied",
      description: "Guest link copied to clipboard",
    });
  };

  const handleReset = () => {
    setGuestName("");
    setExpiresIn("24");
    setGeneratedLink("");
    setExpiresAt("");
    setShowQR(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        handleReset();
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Generate Guest Link
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Generate Guest Access Link
          </DialogTitle>
          <DialogDescription>
            Create a secure link for external participants to join this video session
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">Guest Name (Optional)</Label>
              <Input
                id="guest-name"
                placeholder="e.g., Dr. Smith"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires-in">Link Expiration</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger id="expires-in">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Generate Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Guest Link</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showQR && (
              <div className="flex justify-center p-4 border rounded-lg bg-white">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedLink)}`}
                  alt="Guest Link QR Code"
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="space-y-1 text-xs text-muted-foreground">
              {guestName && <p>Guest: {guestName}</p>}
              <p>Expires: {new Date(expiresAt).toLocaleString()}</p>
              <p className="text-amber-600 dark:text-amber-400">⚠ Guest will have view-only access</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
              >
                Generate Another
              </Button>
              <Button
                variant="default"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
