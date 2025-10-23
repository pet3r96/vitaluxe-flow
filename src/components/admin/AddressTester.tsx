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

  const handleTest = async () => {
    if (!testAddress.zip || testAddress.zip.length < 5) {
      toast.error("ZIP code is required");
      return;
    }

    setTesting(true);
    setTestResult(null);
    
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
      setTestResult(data);
    } catch (error: any) {
      toast.error(`Verification failed: ${error.message}`);
      setTestResult({
        is_valid: false,
        status: 'invalid',
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const getResultAlert = () => {
    if (!testResult) return null;

    if (testResult.status === 'verified' && testResult.verification_source === 'easypost') {
      return (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-green-900">✅ Address Verified via EasyPost</div>
            <div className="text-sm text-green-800">
              <div className="font-mono">{testResult.formatted_address}</div>
              {testResult.confidence && (
                <div className="mt-1">🎯 Confidence: {testResult.confidence}%</div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    if (testResult.status === 'verified' && testResult.verification_source?.includes('zip')) {
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

    if (testResult.status === 'verified' && testResult.suggested_street) {
      return (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-amber-900">⚠️ Address Corrected</div>
            <div className="text-sm text-amber-800">
              <div className="mb-2">
                <span className="font-medium">You entered:</span>
                <div className="font-mono text-xs mt-1">
                  {testAddress.street}, {testAddress.city}, {testAddress.state} {testAddress.zip}
                </div>
              </div>
              <div>
                <span className="font-medium">Corrected to:</span>
                <div className="font-mono text-xs mt-1">{testResult.formatted_address}</div>
              </div>
              <div className="mt-2 text-xs">
                <div className="font-medium">Changes:</div>
                {testResult.suggested_street !== testAddress.street && (
                  <div>• Street: {testAddress.street} → {testResult.suggested_street}</div>
                )}
                {testResult.suggested_city !== testAddress.city && (
                  <div>• City: {testAddress.city} → {testResult.suggested_city}</div>
                )}
                {testResult.suggested_state !== testAddress.state && (
                  <div>• State: {testAddress.state} → {testResult.suggested_state}</div>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    if (!testResult.is_valid) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold text-red-900">❌ Address Could Not Be Verified</div>
            <div className="text-sm text-red-800">
              {testResult.error || "This address is not deliverable."}
            </div>
            <div className="text-xs text-red-700 mt-2">
              <div className="font-medium">Common issues:</div>
              <div>• Street name may be incorrect</div>
              <div>• City/ZIP mismatch</div>
              <div>• Address does not exist</div>
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
