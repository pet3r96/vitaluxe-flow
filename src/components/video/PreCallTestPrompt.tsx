import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface PreCallTestPromptProps {
  onDismiss?: () => void;
  sessionId: string;
}

export function PreCallTestPrompt({ onDismiss, sessionId }: PreCallTestPromptProps) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`precall-test-dismissed-${sessionId}`) === "true";
  });

  const handleDismiss = () => {
    localStorage.setItem(`precall-test-dismissed-${sessionId}`, "true");
    setDismissed(true);
    onDismiss?.();
  };

  const handleTestNow = () => {
    // Store return URL so we can come back after test
    sessionStorage.setItem("video-test-return-url", window.location.pathname);
  };

  if (dismissed) return null;

  return (
    <Card className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-4 shadow-lg border-2 border-primary/50">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Test Your Setup First?</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Check your camera, microphone, and network quality before joining.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/video/test" onClick={handleTestNow} className="flex-1">
              <Button size="sm" className="w-full gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Test Now
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="gap-2"
            >
              Skip
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
