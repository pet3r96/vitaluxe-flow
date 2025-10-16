import { Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { PasswordValidationResult } from "@/lib/passwordStrength";

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidationResult;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({ 
  validation, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStrengthLabel = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'Strong';
      case 'medium':
        return 'Medium';
      default:
        return 'Weak';
    }
  };

  const getStrengthValue = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 100;
      case 'medium':
        return 60;
      default:
        return 30;
    }
  };

  const metCount = validation.requirements.filter(r => r.met).length;
  const totalCount = validation.requirements.length;

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Password Strength:</span>
          <span className={`font-semibold ${
            validation.strength === 'strong' ? 'text-green-600' :
            validation.strength === 'medium' ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {getStrengthLabel(validation.strength)}
          </span>
        </div>
        <Progress 
          value={getStrengthValue(validation.strength)} 
          className="h-2"
          indicatorClassName={getStrengthColor(validation.strength)}
        />
        <p className="text-xs text-muted-foreground">
          {metCount} of {totalCount} requirements met
        </p>
      </div>

      {/* Feedback Alert */}
      {validation.feedback && (
        <Alert variant={validation.strength === 'weak' ? 'destructive' : 'default'}>
          <AlertDescription className="text-sm">
            {validation.feedback}
          </AlertDescription>
        </Alert>
      )}

      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Requirements:</p>
          <div className="space-y-1">
            {validation.requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                {req.met ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={req.met ? 'text-foreground' : 'text-muted-foreground'}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
