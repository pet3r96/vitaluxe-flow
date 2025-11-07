import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, ExternalLink, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface VideoGuestLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestUrl: string;
  expiresAt: string;
}

export function VideoGuestLinkDialog({
  open,
  onOpenChange,
  guestUrl,
  expiresAt,
}: VideoGuestLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      toast({
        title: "Link Copied",
        description: "Guest link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const openInNewTab = () => {
    window.open(guestUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Guest Access Link Generated
          </DialogTitle>
          <DialogDescription>
            Share this one-time link with your patient to join the video session
            without logging in
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Expires:</strong>{" "}
              {format(new Date(expiresAt), "MMM d, yyyy 'at' h:mm a")}
              <br />
              <span className="text-muted-foreground text-sm">
                This link can be used once and expires in 24 hours
              </span>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Guest Link URL</label>
            <div className="flex gap-2">
              <Input
                value={guestUrl}
                readOnly
                className="font-mono text-sm"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={openInNewTab}
                className="flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Share via SMS</h4>
            <p className="text-sm text-muted-foreground">
              Copy and send this message to your patient:
            </p>
            <div className="bg-background p-3 rounded border text-sm">
              Your video appointment is ready!
              <br />
              <br />
              Join as guest: {guestUrl}
              <br />
              <br />
              Link expires in 24 hours and can be used once.
            </div>
          </div>

          <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertDescription className="text-sm">
              <strong>Security Note:</strong> This link provides one-time guest
              access. All access is logged for HIPAA compliance.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={copyToClipboard}>
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
