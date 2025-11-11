import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  timestamp: string;
  details?: any;
}

interface VideoDiagnosticsProps {
  results: DiagnosticResult[];
}

export const VideoDiagnostics = ({ results }: VideoDiagnosticsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copySnapshot = async () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      diagnostics: results,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      online: navigator.onLine,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Debug snapshot copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="font-semibold">Connection Diagnostics</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          {results.map((result, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div
                className={`mt-1 h-3 w-3 rounded-full ${
                  result.status === 'success'
                    ? 'bg-green-500'
                    : result.status === 'error'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{result.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{result.message}</div>
                <div className="text-xs text-muted-foreground/70 mt-1">{result.timestamp}</div>
              </div>
            </div>
          ))}
          <Button onClick={copySnapshot} variant="outline" className="w-full mt-4" size="sm">
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Debug Snapshot'}
          </Button>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
