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

    // Only auto-validate when we have both ZIP and street
    if (autoValidate && zip.length === 5 && value.street && value.street.trim().length >= 3) {
      await validateAddress(zip);
    }
  };

  const handleStreetChange = async (street: string) => {
    onChange({ ...value, street });
    
    // If ZIP already entered and street now complete, trigger validation
    if (autoValidate && value.zip && value.zip.length === 5 && street.trim().length >= 3) {
      await validateAddress(value.zip);
    }
  };

  const validateAddress = async (zipOverride?: string) => {
    const zipToValidate = zipOverride || value.zip;
    
    if (!zipToValidate || zipToValidate.length !== 5) {
      return;
    }

    setValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('google-validate-address', {
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
    if (validation?.formatted_address) {
      onChange({
        ...value,
        street: validation.suggested_street || value.street,
        city: validation.suggested_city || value.city,
        state: validation.suggested_state || value.state,
        zip: validation.suggested_zip || value.zip,
        formatted: validation.formatted_address,
        status: 'verified',
        verified_at: new Date().toISOString(),
        source: validation.verification_source,
        confidence: validation.confidence
      });
      setShowSuggestion(false);
      setValidation({ ...validation, status: 'verified' });
      toast.success("✅ Address corrected and verified");
    }
  };

  const proceedManually = async () => {
    setValidating(true);
    try {
      const { data } = await supabase.functions.invoke('google-validate-address', {
        body: {
          street: value.street,
          city: value.city,
          state: value.state,
          zip: value.zip,
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
          onChange={(e) => handleStreetChange(e.target.value)}
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
                <span>
                  {validation.verification_source === 'easypost' 
                    ? `✅ Full address verified: ${validation.formatted_address}`
                    : validation.verification_source === 'zip_only_incomplete_data'
                    ? `ZIP code valid: ${value.zip}. Enter street address for full verification.`
                    : `Address formatted: ${validation.formatted_address}`
                  }
                </span>
                <div className="flex items-center space-x-2 text-xs">
                  {validation.verification_source === 'easypost' && (
                    <>
                      <Badge variant="outline" className="text-xs border-green-600 text-green-700 dark:text-green-400">EasyPost Verified</Badge>
                      {validation.confidence && (
                        <span className="text-green-600 dark:text-green-400">
                          {Math.round(validation.confidence * 100)}% confidence
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showSuggestion && validation?.formatted_address && (
          <Alert className="border-gold1/30 bg-gold1/10">
            <AlertTriangle className="h-4 w-4 text-gold1" />
            <AlertDescription className="text-gold1">
              <div className="space-y-2">
                <p className="font-semibold">⚠️ Address Issue Detected</p>
                <div className="text-sm space-y-1">
                  <p>You entered:</p>
                  <p className="pl-2 text-amber-700 dark:text-amber-400">
                    {value.street}, {value.city}, {value.state} {value.zip}
                  </p>
                  <p className="pt-2">Suggested correction:</p>
                  <p className="pl-2 font-medium text-amber-900 dark:text-amber-200">
                    ✓ {validation.formatted_address}
                  </p>
                  {validation.error_details && validation.error_details.length > 0 && (
                    <div className="pt-2 text-xs">
                      <p className="font-medium">Issues found:</p>
                      <ul className="list-disc list-inside pl-2">
                        {validation.error_details.map((detail: string, idx: number) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={acceptSuggestion}
                    className="h-7"
                  >
                    Use Suggested Address
                  </Button>
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline"
                    onClick={proceedManually}
                    className="h-7"
                  >
                    Keep My Address Anyway
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {validation?.status === 'invalid' && !validation?.formatted_address && !showSuggestion && (
          <Alert className="border-red-600/20 bg-red-50 dark:bg-red-950/20">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              <div className="space-y-2">
                <p className="font-semibold">❌ Address Cannot Be Verified</p>
                <p className="text-sm">
                  This address could not be verified as deliverable:
                </p>
                <p className="pl-2 text-sm text-red-700 dark:text-red-400">
                  {value.street}, {value.city}, {value.state} {value.zip}
                </p>
                <div className="text-sm">
                  <p className="font-medium">Common issues:</p>
                  <ul className="list-disc list-inside pl-2 text-xs">
                    <li>Street name may be incorrect</li>
                    <li>City/ZIP code mismatch</li>
                    <li>Address does not exist</li>
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    type="button"
                    size="sm" 
                    variant="outline"
                    onClick={proceedManually}
                    className="h-7"
                  >
                    Use Anyway (Not Recommended)
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
