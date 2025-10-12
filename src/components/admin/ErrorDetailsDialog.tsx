import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ErrorDetailsDialogProps {
  error: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ErrorDetailsDialog = ({ error, open, onOpenChange }: ErrorDetailsDialogProps) => {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const copyToClipboard = async () => {
    const errorText = JSON.stringify(
      {
        timestamp: error.created_at,
        type: error.action_type,
        entity: error.entity_type,
        user: error.user_email,
        details: error.details,
      },
      null,
      2
    );

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      toast.success("Error details copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getErrorBadgeVariant = (actionType: string) => {
    if (actionType.includes('edge_function')) return 'default';
    if (actionType.includes('api')) return 'secondary';
    return 'destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Error Details</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="space-y-4">
            {/* Error Type & Timestamp */}
            <div className="flex items-center justify-between">
              <Badge variant={getErrorBadgeVariant(error.action_type)}>
                {error.action_type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(error.created_at).toLocaleString()}
              </span>
            </div>

            {/* Entity Type */}
            {error.entity_type && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Component/Function</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  {error.entity_type}
                </p>
              </div>
            )}

            <Separator />

            {/* User Context */}
            <div>
              <h4 className="text-sm font-semibold mb-2">User Context</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono">{error.user_email || 'Anonymous'}</span>
                </div>
                {error.user_role && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <Badge variant="outline">{error.user_role}</Badge>
                  </div>
                )}
                {error.ip_address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP:</span>
                    <span className="font-mono">{error.ip_address}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Error Message */}
            {error.details?.error_message && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Error Message</h4>
                <div className="p-3 rounded-md bg-muted text-sm font-mono">
                  {error.details.error_message}
                </div>
              </div>
            )}

            {/* Error Details */}
            {error.details?.message && !error.details?.error_message && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Message</h4>
                <div className="p-3 rounded-md bg-muted text-sm font-mono">
                  {error.details.message}
                </div>
              </div>
            )}

            {/* Stack Trace */}
            {error.details?.error_stack && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Stack Trace</h4>
                <ScrollArea className="max-h-64">
                  <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap">
                    {error.details.error_stack}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {error.details?.stack && !error.details?.error_stack && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Stack Trace</h4>
                <ScrollArea className="max-h-64">
                  <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap">
                    {error.details.stack}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {/* Request Context */}
            {error.details?.url && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Request Context</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL:</span>
                    <span className="font-mono text-xs break-all">{error.details.url}</span>
                  </div>
                  {error.details.browser && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Browser:</span>
                      <span className="font-mono text-xs">{error.details.browser}</span>
                    </div>
                  )}
                  {error.details.source && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-mono text-xs break-all">{error.details.source}</span>
                    </div>
                  )}
                  {error.details.line && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Line:</span>
                      <span className="font-mono">{error.details.line}:{error.details.column || 0}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw Details */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Raw Details (JSON)</h4>
              <ScrollArea className="max-h-64">
                <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
