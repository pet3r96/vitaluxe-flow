import { useState, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useViosCatalogSearch, type ViosCatalogProduct } from "@/hooks/useViosCatalog";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";

interface ViosProductSearchProps {
  value: string;
  onChange: (medId: string, product?: ViosCatalogProduct) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ViosProductSearch({
  value,
  onChange,
  disabled = false,
  placeholder = "Search VIOS catalog...",
}: ViosProductSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  const { data: products = [], isLoading } = useViosCatalogSearch(debouncedSearch);

  const selectedProduct = products.find(p => p.med_id === value);

  const handleSelect = useCallback((product: ViosCatalogProduct) => {
    onChange(product.med_id, product);
    setOpen(false);
    setSearchTerm("");
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange("", undefined);
  }, [onChange]);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex-1 justify-between font-normal",
              !value && "text-muted-foreground"
            )}
          >
            {value ? (
              <span className="truncate">
                {selectedProduct?.product_name || value}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search by name or Med ID..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {isLoading && (
                <div className="py-6 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  <span className="text-sm text-muted-foreground">Searching...</span>
                </div>
              )}
              {!isLoading && debouncedSearch.length >= 2 && products.length === 0 && (
                <CommandEmpty>No products found.</CommandEmpty>
              )}
              {!isLoading && debouncedSearch.length < 2 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              )}
              {products.length > 0 && (
                <CommandGroup heading="VIOS Catalog Products">
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.med_id}
                      onSelect={() => handleSelect(product)}
                      className="flex flex-col items-start gap-1 py-2"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-medium truncate max-w-[280px]">
                          {product.product_name}
                        </span>
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            value === product.med_id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          Med ID: {product.med_id}
                        </Badge>
                        {product.form && (
                          <Badge variant="outline" className="text-xs">
                            {product.form}
                          </Badge>
                        )}
                        {product.strength && (
                          <Badge variant="outline" className="text-xs">
                            {product.strength}
                          </Badge>
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
      
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={disabled}
          className="shrink-0"
          title="Clear selection"
        >
          <Link2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
