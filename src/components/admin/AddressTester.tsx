import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TestTube2, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ValidationResponse {
  is_valid: boolean;
  formatted_address?: string;
  suggested_street?: string;
  suggested_city?: string;
  suggested_state?: string;
  suggested_zip?: string;
  verification_source?: string;
  status: 'verified' | 'invalid' | 'manual';
  error?: string;
  error_details?: string[];
  confidence?: number;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export const AddressTester = () => {
  const [testAddress, setTestAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: ''
  });
  const [testResult, setTestResult] = useState<ValidationResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);

  const handleTest = async () => {
    if (!testAddress.zip || testAddress.zip.length < 5) {
      toast.error("ZIP code is required");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setShowSuggestion(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: {
          street: testAddress.street,
          city: testAddress.city,
          state: testAddress.state,
          zip: testAddress.zip
        }
      });

      if (error) throw error;
      
      // Check if EasyPost provided corrections
      if (data.error_details && data.error_details.length > 0 && data.formatted_address) {
        setShowSuggestion(true);
      } else if (data.is_valid && data.status === 'verified') {
        setShowSuggestion(false);
      } else {
        setShowSuggestion(false);
      }
      
      setTestResult(data);
    } catch (error: any) {
      toast.error(`Verification failed: ${error.message}`);
      setTestResult({
        is_valid: false,
        status: 'invalid',
        error: error.message
      });
      setShowSuggestion(false);
    } finally {
      setTesting(false);
    }
  };

  const acceptSuggestion = () => {
    if (!testResult?.formatted_address) return;
    
    // Update input fields with corrected values
    setTestAddress({
      street: testResult.suggested_street || testAddress.street,
      city: testResult.suggested_city || testAddress.city,
      state: testResult.suggested_state || testAddress.state,
      zip: testResult.suggested_zip || testAddress.zip,
    });
    
    // Mark as verified
    setTestResult({
      ...testResult,
      status: 'verified',
      is_valid: true
    });
    
    setShowSuggestion(false);
    toast.success("✅ Address corrected and verified");
  };

  const manualOverride = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: {
          ...testAddress,
          manual_override: true
        }
      });
      
      if (error) throw error;
      
      setTestResult({
        ...data,
        status: 'manual',
        is_valid: true
      });
      setShowSuggestion(false);
      toast.success("✅ Using original address (manual override)");
    } catch (error: any) {
      toast.error("Manual override failed");
    } finally {
      setTesting(false);
    }
  };

  const getResultAlert = () => {
    if (!testResult) return null;

    // Priority 1: Show interactive prompt when corrections are available
    if (showSuggestion && testResult.error_details && testResult.error_details.length > 0) {
      return (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="space-y-3">
            <p className="font-semibold text-amber-900">
              {testResult.is_valid 
                ? "⚠️ Address Issue Detected" 
                : "❌ Address Not Deliverable (But We Found Corrections)"}
            </p>
            
            <div className="text-sm text-amber-800 space-y-2">
              <div>
                <p className="font-medium">You entered:</p>
                <p className="pl-2 font-mono text-xs text-amber-700">
                  {testAddress.street}, {testAddress.city}, {testAddress.state} {testAddress.zip}
                </p>
              </div>
              
              <div>
                <p className="font-medium">
                  {testResult.is_valid 
                    ? "EasyPost found the correct address:" 
                    : "EasyPost corrected the format to:"}
                </p>
                <p className={`pl-2 font-mono text-xs font-semibold ${
                  testResult.is_valid ? 'text-green-700' : 'text-amber-700'
                }`}>
                  {testResult.is_valid ? '✓' : '⚠️'} {testResult.formatted_address}
                </p>
              </div>
              
              {!testResult.is_valid && (
                <div className="bg-red-100 p-2 rounded border border-red-200">
                  <p className="text-xs font-semibold text-red-900">
                    ⚠️ Important: Even the corrected address is not deliverable according to EasyPost
                  </p>
                  <p className="text-xs text-red-800 mt-1">
                    This address may not exist, or it may be too new to be in the USPS database.
                  </p>
                </div>
              )}
              
              <div className="text-xs bg-amber-100 p-2 rounded">
                <p className="font-medium mb-1">Corrections made:</p>
                <ul className="list-disc list-inside pl-2 space-y-0.5">
                  {testResult.error_details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button 
                type="button"
                size="sm"
                onClick={acceptSuggestion}
                disabled={testing}
                className="flex-1"
                variant={testResult.is_valid ? 'default' : 'outline'}
              >
                {testResult.is_valid 
                  ? "Apply Correct Address" 
                  : "Use Corrected Address Anyway"}
              </Button>
              <Button 
                type="button"
                size="sm"
                variant="outline"
                onClick={manualOverride}
                disabled={testing}
                className="flex-1"
              >
                Keep My Original Address
              </Button>
            </div>
            
            <p className="text-xs text-amber-600 italic">
              {testResult.is_valid 
                ? "💡 The corrected address is deliverable according to EasyPost" 
                : "⚠️ Use with caution: This address may not be deliverable"}
            </p>
          </AlertDescription>
        </Alert>
      );
    }

    // Priority 2: EasyPost verified success
    if (testResult.status === 'verified' && !showSuggestion && testResult.verification_source === 'easypost') {
      return (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-green-900">✅ Address Verified via EasyPost</div>
            <div className="text-sm text-green-800">
              <div className="font-mono">{testResult.formatted_address}</div>
              {testResult.confidence && (
                <div className="mt-1">🎯 Confidence: {Math.round(testResult.confidence * 100)}%</div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Priority 3: Manual override success
    if (testResult.status === 'manual' && !showSuggestion) {
      return (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-blue-900">✓ Using Original Address (Manual Override)</div>
            <div className="text-sm text-blue-800">
              <div className="font-mono">
                {testAddress.street}, {testAddress.city}, {testAddress.state} {testAddress.zip}
              </div>
              <div className="mt-2 text-xs italic text-blue-700">
                ⚠️ This address was manually overridden and may not be deliverable
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Priority 4: ZIP-only validation
    if (testResult.status === 'verified' && testResult.verification_source?.includes('zip') && !showSuggestion) {
      return (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-blue-900">ℹ️ ZIP Code Valid</div>
            <div className="text-sm text-blue-800">
              <div>ZIP: {testAddress.zip} - {testResult.suggested_city}, {testResult.suggested_state}</div>
              <div className="mt-2 text-xs italic">
                Enter a street address for full EasyPost verification
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Priority 5: Invalid address (no suggestions)
    if (!testResult.is_valid && !testResult.suggested_street && !showSuggestion && !testResult.error_details) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-red-900">❌ Address Could Not Be Verified</div>
            <div className="text-sm text-red-800">
              {testResult.error || "This address is not deliverable and no corrections could be found."}
            </div>
            <div className="text-xs text-red-700 mt-2">
              <div className="font-medium">Common issues:</div>
              <div>• Street name may be completely incorrect</div>
              <div>• City/ZIP combination doesn't exist</div>
              <div>• Address may be in a restricted area</div>
            </div>
            <div className="pt-2">
              <Button 
                type="button"
                size="sm"
                variant="outline"
                onClick={manualOverride}
                disabled={testing}
              >
                Use This Address Anyway (Not Recommended)
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube2 className="h-5 w-5" />
          Test Single Address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="test-street">Street Address</Label>
            <Input
              id="test-street"
              placeholder="123 Main St"
              value={testAddress.street}
              onChange={(e) => setTestAddress({ ...testAddress, street: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="test-city">City</Label>
            <Input
              id="test-city"
              placeholder="Miami Beach"
              value={testAddress.city}
              onChange={(e) => setTestAddress({ ...testAddress, city: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="test-state">State</Label>
            <Select value={testAddress.state} onValueChange={(value) => setTestAddress({ ...testAddress, state: value })}>
              <SelectTrigger id="test-state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="test-zip">ZIP Code *</Label>
            <Input
              id="test-zip"
              placeholder="33139"
              maxLength={5}
              value={testAddress.zip}
              onChange={(e) => setTestAddress({ ...testAddress, zip: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>

        <Button 
          onClick={handleTest} 
          disabled={testing || !testAddress.zip}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <TestTube2 className="h-4 w-4 mr-2" />
              Test Verification
            </>
          )}
        </Button>

        {testResult && (
          <div className="pt-4 border-t">
            {getResultAlert()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
