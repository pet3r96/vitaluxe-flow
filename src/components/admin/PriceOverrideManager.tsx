import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Save, Trash2, DollarSign, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Override {
  id: string;
  product_id: string;
  override_topline_price: number | null;
  override_downline_price: number | null;
  override_retail_price: number | null;
}

interface PendingOverride {
  override_topline_price: string;
  override_downline_price: string;
  override_retail_price: string;
}

export const PriceOverrideManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRepId, setSelectedRepId] = useState<string>("");
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingOverride>>({});

  // Fetch all reps (topline + downline)
  const { data: reps, isLoading: repsLoading } = useQuery({
    queryKey: ['all-reps-for-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select('id, user_id, role, profiles!reps_user_id_fkey(name, email)')
        .order('role', { ascending: false })
        .order('profiles(name)');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['all-products-for-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, dosage, base_price, topline_price, downline_price, retail_price, image_url, active, product_types(name)')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing overrides for selected rep
  const { data: existingOverrides, isLoading: overridesLoading } = useQuery({
    queryKey: ['price-overrides', selectedRepId],
    queryFn: async () => {
      if (!selectedRepId) return [];
      
      const { data, error } = await supabase
        .from('rep_product_price_overrides')
        .select('*')
        .eq('rep_id', selectedRepId);
      
      if (error) throw error;
      return data as Override[];
    },
    enabled: !!selectedRepId,
  });

  // Pagination (25 items per page)
  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: products?.length || 0,
    itemsPerPage: 25,
    initialPage: 1
  });

  const paginatedProducts = products?.slice(startIndex, endIndex) || [];

  // Get existing override for a product
  const getExistingOverride = (productId: string): Override | undefined => {
    return existingOverrides?.find(o => o.product_id === productId);
  };

  // Get pending or existing override values
  const getOverrideValues = (productId: string) => {
    const pending = pendingChanges[productId];
    const existing = getExistingOverride(productId);
    
    return {
      topline: pending?.override_topline_price || existing?.override_topline_price?.toString() || '',
      downline: pending?.override_downline_price || existing?.override_downline_price?.toString() || '',
      retail: pending?.override_retail_price || existing?.override_retail_price?.toString() || '',
    };
  };

  // Track pending changes
  const handleOverrideChange = (productId: string, field: keyof PendingOverride, value: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  // Validate price hierarchy based on rep type
  const validatePrices = (productId: string): string | null => {
    const product = products?.find(p => p.id === productId);
    if (!product) return "Product not found";

    const values = getOverrideValues(productId);
    const selectedRep = reps?.find(r => r.id === selectedRepId);
    
    const topline = parseFloat(values.topline) || product.topline_price;
    const downline = parseFloat(values.downline) || product.downline_price;
    const retail = parseFloat(values.retail) || product.retail_price;

    // For topline reps: only validate topline < retail
    if (selectedRep?.role === 'topline') {
      if (values.topline && values.retail && topline >= retail) {
        return "Topline price must be less than practice price";
      }
    }

    // For downline reps: only validate downline < retail
    if (selectedRep?.role === 'downline') {
      if (values.downline && values.retail && downline >= retail) {
        return "Downline price must be less than practice price";
      }
    }

    return null;
  };

  // Save override mutation
  const saveMutation = useMutation({
    mutationFn: async (productId: string) => {
      const validationError = validatePrices(productId);
      if (validationError) throw new Error(validationError);

      const values = getOverrideValues(productId);
      const selectedRep = reps?.find(r => r.id === selectedRepId);
      
      // Only save relevant price fields based on rep type
      const overrideData: any = {
        rep_id: selectedRepId,
        product_id: productId,
        override_retail_price: values.retail ? parseFloat(values.retail) : null,
      };

      if (selectedRep?.role === 'topline') {
        overrideData.override_topline_price = values.topline ? parseFloat(values.topline) : null;
        overrideData.override_downline_price = null;
      } else if (selectedRep?.role === 'downline') {
        overrideData.override_downline_price = values.downline ? parseFloat(values.downline) : null;
        overrideData.override_topline_price = null;
      }
      
      const { error } = await supabase
        .from('rep_product_price_overrides')
        .upsert(overrideData, {
          onConflict: 'rep_id,product_id'
        });
      
      if (error) throw error;
    },
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: ['price-overrides', selectedRepId] });
      // Invalidate all effective price queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: ({ queryKey }) => queryKey?.[0] === 'effective-price' 
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
      toast({
        title: "Override saved",
        description: "Price override has been applied",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving override",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear override mutation
  const clearMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('rep_product_price_overrides')
        .delete()
        .eq('rep_id', selectedRepId)
        .eq('product_id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-overrides', selectedRepId] });
      // Invalidate all effective price queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: ({ queryKey }) => queryKey?.[0] === 'effective-price' 
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Override cleared",
        description: "Product reverted to default pricing",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error clearing override",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear all overrides for rep
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('rep_product_price_overrides')
        .delete()
        .eq('rep_id', selectedRepId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-overrides', selectedRepId] });
      setPendingChanges({});
      toast({
        title: "All overrides cleared",
        description: "Rep reverted to default pricing for all products",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error clearing overrides",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedRep = reps?.find(r => r.id === selectedRepId);
  const isToplineRep = selectedRep?.role === 'topline';
  const isDownlineRep = selectedRep?.role === 'downline';
  const overrideCount = existingOverrides?.length || 0;

  if (repsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rep Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Representative</CardTitle>
          <CardDescription>
            Choose a topline or downline rep to manage their product pricing overrides
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedRepId} onValueChange={setSelectedRepId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a representative..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                TOPLINE REPS
              </div>
              {reps?.filter(r => r.role === 'topline').map(rep => (
                <SelectItem key={rep.id} value={rep.id}>
                  <div className="flex items-center gap-2">
                    <span>{rep.profiles?.name || 'Unnamed Rep'}</span>
                    <Badge variant="outline" className="text-xs">Topline</Badge>
                  </div>
                </SelectItem>
              ))}
              
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                DOWNLINE REPS
              </div>
              {reps?.filter(r => r.role === 'downline').map(rep => (
                <SelectItem key={rep.id} value={rep.id}>
                  <div className="flex items-center gap-2">
                    <span>{rep.profiles?.name || 'Unnamed Rep'}</span>
                    <Badge variant="secondary" className="text-xs">Downline</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedRep && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{selectedRep.profiles?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedRep.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={overrideCount > 0 ? "default" : "secondary"}>
                  <DollarSign className="h-3 w-3 mr-1" />
                  {overrideCount} override{overrideCount !== 1 ? 's' : ''} active
                </Badge>
                {overrideCount > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all overrides?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {overrideCount} price override{overrideCount !== 1 ? 's' : ''} for {selectedRep.profiles?.name}.
                          All products will revert to default pricing. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => clearAllMutation.mutate()}>
                          Clear All Overrides
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Override Table */}
      {selectedRepId && (
        <Card>
          <CardHeader>
            <CardTitle>Product Price Overrides</CardTitle>
            <CardDescription>
              Set custom pricing for this rep. Empty fields use default prices. Changes apply only to this rep and their downlines/practices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading || overridesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Product</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        
                        {isToplineRep && (
                          <>
                            <TableHead className="text-right">Default Topline</TableHead>
                            <TableHead className="text-right">Override Topline</TableHead>
                          </>
                        )}
                        
                        {isDownlineRep && (
                          <>
                            <TableHead className="text-right">Default Downline</TableHead>
                            <TableHead className="text-right">Override Downline</TableHead>
                          </>
                        )}
                        
                        <TableHead className="text-right">Default Practice</TableHead>
                        <TableHead className="text-right">Override Practice</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No products found
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedProducts.map((product) => {
                          const values = getOverrideValues(product.id);
                          const hasOverride = !!getExistingOverride(product.id);
                          const hasPendingChanges = !!pendingChanges[product.id];
                          const validationError = validatePrices(product.id);

                          return (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.image_url && (
                                    <img 
                                      src={product.image_url} 
                                      alt={product.name}
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium">{product.name}</p>
                                    <p className="text-sm text-muted-foreground">{product.dosage}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{product.product_types?.name || 'N/A'}</Badge>
                              </TableCell>
                              
                              {isToplineRep && (
                                <>
                                  <TableCell className="text-right text-muted-foreground">
                                    ${product.topline_price?.toFixed(2) ?? 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder={product.topline_price?.toFixed(2) ?? '0.00'}
                                      value={values.topline}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                          handleOverrideChange(product.id, 'override_topline_price', val);
                                        }
                                      }}
                                      className="w-24 text-right"
                                    />
                                  </TableCell>
                                </>
                              )}
                              
                              {isDownlineRep && (
                                <>
                                  <TableCell className="text-right text-muted-foreground">
                                    ${product.downline_price?.toFixed(2) ?? 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder={product.downline_price?.toFixed(2) ?? '0.00'}
                                      value={values.downline}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                          handleOverrideChange(product.id, 'override_downline_price', val);
                                        }
                                      }}
                                      className="w-24 text-right"
                                    />
                                  </TableCell>
                                </>
                              )}
                              
                              <TableCell className="text-right text-muted-foreground">
                                ${product.retail_price?.toFixed(2) ?? 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={product.retail_price?.toFixed(2) ?? '0.00'}
                                  value={values.retail}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      handleOverrideChange(product.id, 'override_retail_price', val);
                                    }
                                  }}
                                  className="w-24 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-2">
                                  {hasOverride && (
                                    <Badge variant="secondary" className="text-xs">
                                      Active
                                    </Badge>
                                  )}
                                  {hasPendingChanges && (
                                    <Button
                                      size="sm"
                                      onClick={() => saveMutation.mutate(product.id)}
                                      disabled={saveMutation.isPending || !!validationError}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  )}
                                  {hasOverride && !hasPendingChanges && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => clearMutation.mutate(product.id)}
                                      disabled={clearMutation.isPending}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {validationError && (
                                    <div title={validationError}>
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    hasNextPage={hasNextPage}
                    hasPrevPage={hasPrevPage}
                    totalItems={products?.length || 0}
                    startIndex={startIndex}
                    endIndex={endIndex}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
