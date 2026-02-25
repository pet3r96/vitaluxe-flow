import { useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWelcomeTour } from "@/hooks/useWelcomeTour";
import {
  StepWelcome, StepAddProvider, StepAddPatient, StepPortalPages, StepComplete
} from "./WelcomeTourContent";

const TOTAL_STEPS = 5;

export function WelcomeTourDialog() {
  const { showTour, dismissTour } = useWelcomeTour();
  const [step, setStep] = useState(0);

  if (!showTour) return null;

  const handleClose = () => {
    setStep(0);
    dismissTour();
  };

  const stepContent = [
    <StepWelcome key={0} />,
    <StepAddProvider key={1} onClose={handleClose} />,
    <StepAddPatient key={2} onClose={handleClose} />,
    <StepPortalPages key={3} />,
    <StepComplete key={4} />,
  ];

  return (
    <Dialog open={showTour} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Welcome Tour</DialogTitle>
          <DialogDescription className="sr-only">Step {step + 1} of {TOTAL_STEPS}</DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        {stepContent[step]}

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={handleClose}>
                Get Started
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
