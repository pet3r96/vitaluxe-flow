import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { validatePhone } from "@/lib/validators";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  required,
  id,
  name,
  placeholder = "5551234567"
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  // Initialize display value from prop - display raw 10 digits
  useEffect(() => {
    if (value) {
      setDisplayValue(value);
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Strip non-digits AND limit to exactly 10 digits
    const cleaned = input.replace(/[^\d]/g, "").slice(0, 10);
    setDisplayValue(cleaned);
    onChange(cleaned);
  };

  const handleBlur = () => {
    setTouched(true);
    
    if (!value || value === "") {
      setError(undefined);
      setDisplayValue("");
      return;
    }

    const validation = validatePhone(value);
    
    if (validation.valid) {
      setError(undefined);
      // Display raw 10 digits only
      setDisplayValue(value);
    } else {
      setError(validation.error);
      setDisplayValue(value);
    }
  };

  return (
    <div className="space-y-1">
      <Input
        id={id}
        name={name}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        maxLength={10}
        inputMode="numeric"
        pattern="\d*"
        className={cn(
          touched && error && "border-destructive focus-visible:ring-destructive"
        )}
      />
      {touched && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
