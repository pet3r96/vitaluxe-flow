import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User, Package, FileText, Building2, Users, SearchX } from "lucide-react";
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

      // Search patients (for practice, pharmacy, admin, topline)
      if (['practice', 'pharmacy', 'admin', 'topline'].includes(effectiveRole || '')) {
        try {
          const { data: patients } = await supabase
            .from('patient_accounts')
            .select('id, first_name, last_name, date_of_birth, email')
            .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
            .limit(10);

          patients?.forEach((patient: any) => {
            searchResults.push({
              id: `patient-${patient.id}`,
              title: `${patient.first_name} ${patient.last_name}`,
              subtitle: patient.email || (patient.date_of_birth ? `DOB: ${new Date(patient.date_of_birth).toLocaleDateString()}` : ''),
              type: 'patient',
              icon: User,
              action: () => {
                navigate(`/patients/${patient.id}`);
                setOpen(false);
              }
            });
          });
        } catch (err) {
          console.error('Patients search error:', err);
        }
      }

      // Search representatives (for admin, topline, pharmacy)
      if (['admin', 'topline', 'pharmacy'].includes(effectiveRole || '')) {
        try {
          const { data: reps } = await supabase
            .from('reps')
            .select(`
              id,
              role,
              user_id,
              profiles!reps_user_id_fkey(name, email, full_name)
            `)
            .limit(10);

          reps?.forEach((rep: any) => {
            const profile = rep.profiles;
            const displayName = profile?.full_name || profile?.name || profile?.email || 'Unknown';
            const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (matchesSearch) {
              searchResults.push({
                id: `rep-${rep.id}`,
                title: displayName,
                subtitle: `${rep.role === 'topline' ? 'Topline' : 'Downline'} Rep${profile?.email ? ` - ${profile.email}` : ''}`,
                type: 'representative',
                icon: Users,
                action: () => {
                  navigate('/representatives');
                  setOpen(false);
                }
              });
            }
          });
        } catch (err) {
          console.error('Representatives search error:', err);
        }
      }

      // Search practices (for admin, pharmacy, topline)
      if (['admin', 'pharmacy', 'topline'].includes(effectiveRole || '')) {
        try {
          const { data: practices } = await supabase
            .from('profiles')
            .select('id, name, full_name, email, company, address_city, address_state')
            .or(`name.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
            .not('name', 'is', null)
            .limit(10);

          practices?.forEach((practice: any) => {
            const displayName = practice.full_name || practice.name || practice.company;
            const location = practice.address_city && practice.address_state 
              ? `${practice.address_city}, ${practice.address_state}` 
              : practice.email;
            
            searchResults.push({
              id: `practice-${practice.id}`,
              title: displayName,
              subtitle: location,
              type: 'practice',
              icon: Building2,
              action: () => {
                navigate('/practices');
                setOpen(false);
              }
            });
          });
        } catch (err) {
          console.error('Practices search error:', err);
        }
      }

      // Search orders (for all non-patient roles)
      if (effectiveRole !== 'patient') {
        try {
          const { data: orders } = await supabase
            .from('orders')
            .select('id, order_number, status, created_at')
            .ilike('order_number', `%${searchTerm}%`)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })
            .limit(10);

          orders?.forEach((order: any) => {
            searchResults.push({
              id: `order-${order.id}`,
              title: `Order #${order.order_number}`,
              subtitle: `Status: ${order.status} - ${new Date(order.created_at).toLocaleDateString()}`,
              type: 'order',
              icon: FileText,
              action: () => {
                navigate('/orders');
                setOpen(false);
              }
            });
          });
        } catch (err) {
          console.error('Orders search error:', err);
        }
      }

      // Search products
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
  }, [effectiveRole, roleMenus, navigate, user]);

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
        className="relative h-7 w-7 sm:h-8 sm:w-auto md:w-48 lg:w-64 xl:w-80 justify-start text-xs sm:text-sm text-muted-foreground px-1.5 sm:px-3 shrink-0"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 sm:mr-2" />
        <span className="hidden sm:inline truncate">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 sm:right-2 hidden h-4 sm:h-5 select-none items-center gap-0.5 sm:gap-1 rounded border border-gold1/30 bg-gold1/10 px-1 sm:px-1.5 font-mono text-[9px] sm:text-[10px] font-medium text-gold1 opacity-100 md:flex">
          <span className="text-[10px] sm:text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search patients, reps, orders, practices..." 
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
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-gold1/10 p-4 mb-4">
                <SearchX className="h-8 w-8 text-gold1" />
              </div>
              <p className="text-base font-semibold text-foreground mb-2">No results found</p>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Try searching with different keywords or check your spelling
              </p>
            </div>
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
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <div className="rounded-full bg-muted/50 p-3 mb-3">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Type at least 2 characters to search...
              </p>
            </div>
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
