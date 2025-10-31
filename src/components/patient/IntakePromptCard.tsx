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
      <AlertCircle className="h-5 w-5 text-warning" />
      <div className="flex items-center justify-between w-full">
        <div>
          <AlertTitle className="text-lg font-semibold">Complete Your Medical Intake</AlertTitle>
          <AlertDescription className="mt-1">
            Help your healthcare team provide better care by completing your medical information. This takes about 5-10 minutes.
          </AlertDescription>
        </div>
        <Button onClick={onComplete} className="ml-4 shrink-0">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
