import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
  value: string;
  label: string;
  code?: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<AutocompleteOption[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(
  ({ value, onChange, onSearch, placeholder, disabled, className, id }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [options, setOptions] = React.useState<AutocompleteOption[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value);
    const timeoutRef = React.useRef<NodeJS.Timeout>();

    // Sync input value with prop value
    React.useEffect(() => {
      setInputValue(value);
    }, [value]);

    // Debounced search
    const handleInputChange = React.useCallback(
      (newValue: string) => {
        setInputValue(newValue);
        onChange(newValue);

        // Clear previous timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Don't search if value is too short
        if (newValue.length < 2) {
          setOptions([]);
          setOpen(false);
          return;
        }

        // Set loading state and debounce the search
        setLoading(true);
        timeoutRef.current = setTimeout(async () => {
          try {
            const results = await onSearch(newValue);
            setOptions(results);
            setOpen(results.length > 0);
          } catch (error) {
            console.error('Search error:', error);
            setOptions([]);
          } finally {
            setLoading(false);
          }
        }, 300);
      },
      [onChange, onSearch]
    );

    // Cleanup timeout on unmount
    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleSelect = (selectedValue: string) => {
      setInputValue(selectedValue);
      onChange(selectedValue);
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={ref}
              id={id}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(className, loading && "pr-8")}
              autoComplete="off"
            />
            {loading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              {options.length === 0 && !loading && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.code && (
                          <span className="text-xs text-muted-foreground">
                            Code: {option.code}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

AutocompleteInput.displayName = "AutocompleteInput";
