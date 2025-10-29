import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { validatePhone, formatPhoneNumber } from "@/lib/validators";
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
  placeholder = "(555) 123-4567"
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  // Initialize display value from prop
  useEffect(() => {
    if (value) {
      setDisplayValue(formatPhoneNumber(value));
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow only digits and common phone formatting characters
    const cleaned = input.replace(/[^\d]/g, "");
    setDisplayValue(input);
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
      // Format the display
      const formatted = formatPhoneNumber(value);
      setDisplayValue(formatted);
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
