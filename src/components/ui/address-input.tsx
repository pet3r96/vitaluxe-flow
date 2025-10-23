import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface AddressInputProps {
  value: AddressValue;
  onChange: (address: AddressValue & { formatted?: string; status?: string; verified_at?: string; source?: string; confidence?: number }) => void;
  label?: string;
  required?: boolean;
  autoValidate?: boolean;
}

export const AddressInput = ({
  value,
  onChange,
  label = "Address",
  required = false,
  autoValidate = true
}: AddressInputProps) => {
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);

  const handleZipChange = async (zip: string) => {
    onChange({ ...value, zip });

    if (autoValidate && zip.length === 5) {
      await validateAddress(zip);
    }
  };

  const validateAddress = async (zipOverride?: string) => {
    const zipToValidate = zipOverride || value.zip;
    
    if (!zipToValidate || zipToValidate.length !== 5) {
      return;
    }

    setValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: {
          street: value.street,
          city: value.city,
          state: value.state,
          zip: zipToValidate,
        }
      });

      if (error) throw error;

      setValidation(data);

      if (data.is_valid && data.status === 'verified') {
        onChange({
          ...value,
          city: data.suggested_city,
          state: data.suggested_state,
          zip: zipToValidate,
          formatted: data.formatted_address,
          status: data.status,
          verified_at: new Date().toISOString(),
          source: data.verification_source,
          confidence: data.confidence
        });
        
        const isEasyPost = data.verification_source === 'easypost';
        const confidenceText = data.confidence ? ` (${Math.round(data.confidence * 100)}% confidence)` : '';
        toast.success(`✅ Address verified and formatted${isEasyPost ? ' via EasyPost' : ''}${confidenceText}`);
        setShowSuggestion(false);
      } else if (!data.is_valid) {
        setShowSuggestion(true);
        const isEasyPost = data.verification_source === 'easypost';
        if (isEasyPost) {
          toast.error("❌ Address not deliverable according to EasyPost");
        }
      }
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Address validation error', error);
      });
      toast.error("Failed to validate address");
    } finally {
      setValidating(false);
    }
  };

  const acceptSuggestion = () => {
    if (validation?.suggested_city && validation?.suggested_state) {
      onChange({
        ...value,
        city: validation.suggested_city,
        state: validation.suggested_state,
      });
      setShowSuggestion(false);
      validateAddress();
    }
  };

  const proceedManually = async () => {
    setValidating(true);
    try {
      const { data } = await supabase.functions.invoke('validate-address', {
        body: {
          ...value,
          manual_override: true
        }
      });

      setValidation(data);
      onChange({
        ...value,
        formatted: data.formatted_address,
        status: 'manual',
        verified_at: new Date().toISOString(),
        source: 'manual_override'
      });
      setShowSuggestion(false);
      toast.info("Address saved with manual override");
    } catch (error) {
      toast.error("Failed to save address");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
        
        <Input
          placeholder="Street Address"
          value={value.street || ""}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          required={required}
        />

        <div className="grid grid-cols-3 gap-2">
          <Input
            placeholder="City"
            value={value.city || ""}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            required={required}
          />
          
          <Input
            placeholder="State"
            value={value.state || ""}
            onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })}
            maxLength={2}
            className="uppercase"
            required={required}
          />
          
          <div className="relative">
            <Input
              placeholder="ZIP"
              value={value.zip || ""}
              onChange={(e) => handleZipChange(e.target.value)}
              maxLength={5}
              required={required}
            />
            {validating && (
              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {validation?.status === 'verified' && !showSuggestion && (
          <Alert className="border-green-600/20 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              <div className="flex items-center justify-between">
                <span>Address verified: {validation.formatted_address}</span>
                <div className="flex items-center space-x-2 text-xs">
                  {validation.verification_source === 'easypost' && (
                    <Badge variant="outline" className="text-xs">EasyPost</Badge>
                  )}
                  {validation.confidence && (
                    <span className="text-green-600 dark:text-green-400">
                      {Math.round(validation.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showSuggestion && validation?.suggested_city && (
          <Alert className="border-amber-600/20 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              <p className="mb-2">
                Did you mean: {value.street}, {validation.suggested_city}, {validation.suggested_state} {value.zip}?
              </p>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  size="sm" 
                  onClick={acceptSuggestion}
                  className="h-7"
                >
                  Accept Suggestion
                </Button>
                <Button 
                  type="button"
                  size="sm" 
                  variant="outline"
                  onClick={proceedManually}
                  className="h-7"
                >
                  Proceed Manually
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
