import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User, Package, FileText, Building2, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { menus } from "@/config/menus";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'patient' | 'order' | 'product' | 'practice' | 'representative' | 'menu';
  icon: any;
  action: () => void;
}

export function EnhancedCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { effectiveRole, isStaffAccount, user } = useAuth();
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const roleMenus = effectiveRole 
    ? (isStaffAccount ? menus.staff : menus[effectiveRole]) || []
    : [];

  const searchData = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search menu items
      roleMenus.forEach((section) => {
        section.items.forEach((item) => {
          if (item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
              section.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            searchResults.push({
              id: `menu-${item.href}`,
              title: item.label,
              subtitle: section.title,
              type: 'menu',
              icon: item.icon,
              action: () => {
                navigate(item.href);
                setOpen(false);
              }
            });
          }
        });
      });

      // Search products using RPC to avoid type issues
      if (effectiveRole !== 'patient') {
        try {
          const { data: products } = await supabase
            .from('products')
            .select('id, name, base_price')
            .ilike('name', `%${searchTerm}%`)
            .eq('active', true)
            .limit(5);

          products?.forEach((product: any) => {
            searchResults.push({
              id: `product-${product.id}`,
              title: product.name,
              subtitle: `Price: $${product.base_price}`,
              type: 'product',
              icon: Package,
              action: () => {
                navigate('/products');
                setOpen(false);
              }
            });
          });
        } catch (err) {
          console.error('Products search error:', err);
        }
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveRole, roleMenus, navigate]);

  useEffect(() => {
    if (debouncedSearch) {
      searchData(debouncedSearch);
    } else {
      setResults([]);
    }
  }, [debouncedSearch, searchData]);

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const typeLabels = {
    menu: 'Menu Items',
    patient: 'Patients',
    practice: 'Practices',
    representative: 'Representatives',
    product: 'Products',
    order: 'Orders'
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-32 justify-start text-sm text-muted-foreground sm:w-48 md:w-56 lg:w-72 xl:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search everything...</span>
        <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search patients, orders, products..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && search.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {!loading && search.length === 0 && roleMenus.map((section) => (
            <CommandGroup key={section.title} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    navigate(item.href);
                    setOpen(false);
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {!loading && search.length > 0 && search.length < 2 && (
            <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
          )}
          {!loading && search.length >= 2 && Object.entries(groupedResults).map(([type, items]) => (
            <CommandGroup key={type} heading={typeLabels[type as keyof typeof typeLabels]}>
              {items.map((result) => {
                const Icon = result.icon;
                return (
                  <CommandItem
                    key={result.id}
                    onSelect={result.action}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
