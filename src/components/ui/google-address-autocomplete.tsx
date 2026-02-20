import { useState, useEffect, useRef } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { Input } from './input';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const libraries: ("places")[] = ['places'];

export interface AddressValue {
  street?: string;
  suite?: string;
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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Fetch Google Maps API key from backend on mount
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        if (error) throw error;
        if (data?.key) {
          setApiKey(data.key);
        } else {
          setApiKeyError('No API key returned');
        }
      } catch (err) {
        logger.error('Failed to fetch Google Maps API key', err);
        setApiKeyError('Failed to load address autocomplete');
      } finally {
        setApiKeyLoading(false);
      }
    };
    fetchKey();
  }, []);

  if (apiKeyLoading) {
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

  if (apiKeyError || !apiKey) {
    return (
      <div className="space-y-2">
        <Label>{label} {required && '*'}</Label>
        <Input
          placeholder={placeholder}
          value={value.formatted || ''}
          onChange={(e) => onChange({ ...value, formatted: e.target.value, status: 'manual', source: 'manual_entry' })}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">Address autocomplete unavailable. Please enter manually.</p>
      </div>
    );
  }

  return (
    <GoogleAddressAutocompleteInner
      apiKey={apiKey}
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};

// Inner component that uses the fetched API key
const GoogleAddressAutocompleteInner = ({
  apiKey,
  value,
  onChange,
  label,
  required,
  placeholder,
  disabled,
}: GoogleAddressAutocompleteProps & { apiKey: string }) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [suiteValue, setSuiteValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure Google autocomplete dropdown stays visible and clickable
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .pac-container {
        z-index: 9999 !important;
        pointer-events: auto !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
      }
      .pac-item {
        cursor: pointer !important;
        pointer-events: auto !important;
        padding: 8px !important;
      }
      .pac-item:hover {
        background-color: #f0f0f0 !important;
      }
      .pac-item-query {
        font-size: 14px !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (value.formatted) {
      setInputValue(value.formatted);
    } else if (value.street) {
      setInputValue(`${value.street}${value.city ? ', ' + value.city : ''}${value.state ? ', ' + value.state : ''}${value.zip ? ' ' + value.zip : ''}`);
    }
    if (value.suite !== undefined) {
      setSuiteValue(value.suite || '');
    }
  }, [value]);

  // Prevent input from clearing during selection and dialog close
  useEffect(() => {
    if (!autocomplete || !inputRef.current) return;
    
    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('.pac-container')) {
        e.stopPropagation();
      }
    };
    
    document.addEventListener('mousedown', handleInteraction, true);
    document.addEventListener('pointerdown', handleInteraction, true);
    document.addEventListener('touchstart', handleInteraction, true);
    
    return () => {
      document.removeEventListener('mousedown', handleInteraction, true);
      document.removeEventListener('pointerdown', handleInteraction, true);
      document.removeEventListener('touchstart', handleInteraction, true);
    };
  }, [autocomplete]);

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
      
      const formattedAddress = (place.formatted_address || `${street}, ${city}, ${state} ${zip}`).replace(/, USA$/i, '');
      
      setInputValue(formattedAddress);
      
      onChange({
        street,
        city,
        state,
        zip,
        formatted: formattedAddress,
        status: 'unverified',
        source: 'google_places',
      });
      
      await validateAddress({ street, city, state, zip }, formattedAddress);
    }
  };

  const validateAddress = async (address: AddressValue, displayAddress?: string) => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-validate-address', {
        body: address
      });
      
      if (error) throw error;
      
      setValidationResult(data);
      
      const validatedAddress: AddressValue = {
        street: data.suggested_street || address.street || '',
        city: data.suggested_city || address.city || '',
        state: data.suggested_state || address.state || '',
        zip: data.suggested_zip || address.zip || '',
        formatted: data.formatted_address || displayAddress || '',
        status: (data.is_valid ? 'verified' : 'unverified') as 'verified' | 'unverified',
        verified_at: new Date().toISOString(),
        source: 'google_places',
        deliverable: data.deliverable || data.is_valid,
      };
      
      onChange(validatedAddress);
      setInputValue(validatedAddress.formatted);
      
    } catch (error) {
      logger.error('Validation error', error);
      onChange({
        ...address,
        formatted: displayAddress || '',
        status: 'manual',
        source: 'manual_entry',
      });
      if (displayAddress) {
        setInputValue(displayAddress);
      }
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
        key="google-autocomplete-stable"
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ['address'],
          componentRestrictions: { country: 'us' },
        }}
      >
        <Input
          ref={inputRef}
          placeholder={placeholder}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          onFocus={(e) => {
            e.target.setAttribute('autocomplete', 'new-password');
          }}
          onBlur={(e) => {
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (relatedTarget?.closest('.pac-container')) {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
          disabled={disabled}
          autoComplete="off"
          data-form-type="other"
          name="address-autocomplete"
        />
      </Autocomplete>
      
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
            Address verified
          </AlertDescription>
        </Alert>
      )}
      
      {validationResult && !validationResult.is_valid && !validating && (
        <Alert className="border-gold1/50 bg-gold1/10">
          <AlertTriangle className="h-4 w-4 text-gold1" />
          <AlertDescription className="text-gold1">
            Address may need correction. Please verify the details are correct.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
