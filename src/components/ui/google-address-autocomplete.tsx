import { useState, useEffect } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { Input } from './input';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const libraries: ("places")[] = ['places'];

export interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  formatted?: string;
  status?: 'verified' | 'unverified' | 'manual';
  verified_at?: string;
  source?: string;
  deliverable?: boolean;
}

interface GoogleAddressAutocompleteProps {
  value: AddressValue;
  onChange: (address: AddressValue) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export const GoogleAddressAutocomplete = ({
  value,
  onChange,
  label = "Address",
  required = false,
  placeholder = "Start typing address...",
  disabled = false,
}: GoogleAddressAutocompleteProps) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'AIzaSyCiUhfxvWq5kp1eRuqntSBJ7fdUHRHTe9I',
    libraries,
  });

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (value.formatted) {
      setInputValue(value.formatted);
    } else if (value.street) {
      setInputValue(`${value.street}${value.city ? ', ' + value.city : ''}${value.state ? ', ' + value.state : ''}${value.zip ? ' ' + value.zip : ''}`);
    }
  }, [value]);

  const onLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = async () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      
      if (!place.address_components) {
        return;
      }

      const components = place.address_components;
      let street = '';
      let city = '';
      let state = '';
      let zip = '';
      
      for (const component of components) {
        const types = component.types;
        
        if (types.includes('street_number')) {
          street = component.long_name + ' ';
        }
        if (types.includes('route')) {
          street += component.long_name;
        }
        if (types.includes('locality')) {
          city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          state = component.short_name;
        }
        if (types.includes('postal_code')) {
          zip = component.long_name;
        }
      }
      
      setInputValue(place.formatted_address || '');
      
      await validateAddress({ street, city, state, zip });
    }
  };

  const validateAddress = async (address: AddressValue) => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-validate-address', {
        body: address
      });
      
      if (error) throw error;
      
      setValidationResult(data);
      
      onChange({
        street: data.suggested_street || address.street || '',
        city: data.suggested_city || address.city || '',
        state: data.suggested_state || address.state || '',
        zip: data.suggested_zip || address.zip || '',
        formatted: data.formatted_address || '',
        status: data.is_valid ? 'verified' : 'unverified',
        verified_at: new Date().toISOString(),
        source: 'google_places',
        deliverable: data.deliverable || data.is_valid,
      });
      
    } catch (error) {
      console.error('Validation error:', error);
      onChange({
        ...address,
        status: 'manual',
        source: 'manual_entry',
      });
    } finally {
      setValidating(false);
    }
  };

  if (loadError) {
    return (
      <Alert className="border-destructive">
        <AlertDescription>Failed to load address autocomplete</AlertDescription>
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <Label>{label} {required && '*'}</Label>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading address autocomplete...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label} {required && '*'}</Label>
      
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ['address'],
          componentRestrictions: { country: 'us' },
        }}
      >
        <Input
          placeholder={placeholder}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={disabled}
        />
      </Autocomplete>
      
      {value.street && (
        <div className="grid grid-cols-3 gap-2">
          <Input 
            value={value.city || ''} 
            placeholder="City" 
            readOnly 
            className="bg-muted/50"
          />
          <Input 
            value={value.state || ''} 
            placeholder="State" 
            readOnly 
            className="bg-muted/50"
          />
          <Input 
            value={value.zip || ''} 
            placeholder="ZIP" 
            readOnly 
            className="bg-muted/50"
          />
        </div>
      )}
      
      {validating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating address...
        </div>
      )}
      
      {validationResult?.is_valid && !validating && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Address verified by USPS
          </AlertDescription>
        </Alert>
      )}
      
      {validationResult && !validationResult.is_valid && !validating && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Address may need correction. Please verify the details are correct.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
