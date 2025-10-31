import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface IntakePromptCardProps {
  onComplete: () => void;
}

export function IntakePromptCard({ onComplete }: IntakePromptCardProps) {
  return (
    <Alert className="border-warning bg-warning/10">
      <div className="flex flex-col gap-4 w-full py-2">
        <div className="flex items-center justify-center gap-2 w-full text-center">
          <AlertCircle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <span className="text-lg font-semibold">Complete Your Medical Intake</span>
            <span className="text-sm text-muted-foreground ml-2">
              Help your healthcare team provide better care by completing your medical information. This takes about 5-10 minutes.
            </span>
          </div>
        </div>
        <Button onClick={onComplete} className="touch-target mx-auto">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
