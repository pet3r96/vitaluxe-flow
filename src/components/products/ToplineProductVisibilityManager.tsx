import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const ToplineProductVisibilityManager = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  const [search, setSearch] = useState("");

  // Only topline reps can access this component
  if (effectiveRole !== "topline") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Only topline representatives can manage product visibility.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get impersonated topline rep's ID (works during admin impersonation)
  const { data: toplineRepId, isLoading: isRepLoading, error: repIdError } = useQuery({
    queryKey: ["topline-rep-id", effectiveUserId],
    enabled: !!effectiveUserId && effectiveRole === "topline",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_rep_id" as any, { _user_id: effectiveUserId });
      if (error) throw error;
      return data as string | null;
    },
  });

  // Fetch all products and their visibility settings for this topline
  const { data: products, isLoading: isProductsLoading, isError: isProductsError } = useQuery({
    queryKey: ["products-with-visibility", toplineRepId],
    enabled: !!toplineRepId,
    queryFn: async () => {
      // Fetch all products (no active filter - show everything)
      const { data: allProducts, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          dosage,
          active,
          product_types(name)
        `)
        .order("name");

      if (productsError) throw productsError;

      // Fetch visibility settings for this topline
      const { data: visibilitySettings, error: visError } = await supabase
        .from("rep_product_visibility" as any)
        .select("product_id, visible")
        .eq("topline_rep_id", toplineRepId) as any;

      if (visError) throw visError;

      // Merge the data - default ALL products to visible
      const visibilityMap = new Map<string, boolean>(
        (visibilitySettings || []).map((v: any) => [v.product_id, v.visible as boolean])
      );

      return allProducts.map(product => ({
        ...product,
        visible: visibilityMap.get(product.id) ?? true, // Default to visible if no setting exists
      })) as Array<{
        id: string;
        name: string;
        dosage: string | null;
        active: boolean;
        product_types: { name: string } | null;
        visible: boolean;
      }>;
    },
  });

  // Toggle visibility for a product
  const toggleVisibility = useMutation({
    mutationFn: async ({ productId, currentVisible }: { productId: string; currentVisible: boolean }) => {
      if (!toplineRepId) throw new Error("Rep ID not found");

      const { error } = await supabase
        .from("rep_product_visibility" as any)
        .upsert({
          topline_rep_id: toplineRepId,
          product_id: productId,
          visible: !currentVisible,
          updated_at: new Date().toISOString(),
        }, { onConflict: "topline_rep_id,product_id" } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product visibility updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update visibility");
    },
  });

  // Reset all to visible
  const handleResetAll = async () => {
    if (!toplineRepId) {
      toast.error("Rep ID not found");
      return;
    }

    setIsResetting(true);
    try {
      // Delete all visibility settings for this topline
      const { error } = await supabase
        .from("rep_product_visibility" as any)
        .delete()
        .eq("topline_rep_id", toplineRepId) as any;

      if (error) throw error;

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["products-with-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      
      toast.success("All products are now visible to your network");
    } catch (error: any) {
      console.error("Error resetting visibility:", error);
      toast.error("Failed to reset product visibility");
    } finally {
      setIsResetting(false);
    }
  };

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search) return products;
    
    const searchLower = search.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.dosage?.toLowerCase().includes(searchLower) ||
      p.product_types?.name?.toLowerCase().includes(searchLower)
    );
  }, [products, search]);

  // Pagination for filtered products
  const { currentPage, totalPages, startIndex, endIndex, goToPage, hasNextPage, hasPrevPage } = usePagination({
    totalItems: filteredProducts.length,
    itemsPerPage: 25,
  });

  // Get paginated slice
  const paginatedProducts = useMemo(() => 
    filteredProducts.slice(startIndex, endIndex),
    [filteredProducts, startIndex, endIndex]
  );

  // Calculate visible/hidden counts from ALL products (not filtered)
  const visibleCount = products?.filter(p => p.visible).length || 0;
  const hiddenCount = products?.filter(p => !p.visible).length || 0;

// Rep profile error or missing
if (repIdError || (!isRepLoading && toplineRepId === null)) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Visibility Settings</CardTitle>
        <CardDescription>
          {repIdError
            ? "We couldn't determine your rep profile. Please try refreshing the page."
            : "We couldn’t find a rep profile for this user. Please contact support."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-destructive">
          {repIdError
            ? "Error loading rep profile. Please contact support if this persists."
            : "No rep profile found for the selected user."}
        </div>
      </CardContent>
    </Card>
  );
}

  // Show error if products couldn't be fetched
  if (isProductsError) {
    toast.error("Failed to load products");
  }

  const isLoading = isRepLoading || isProductsLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Visibility Control</CardTitle>
        <CardDescription>
          Control which products your network can see and order
        </CardDescription>
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="flex items-center gap-2">
            <Eye className="h-3 w-3" />
            {visibleCount} Visible
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <EyeOff className="h-3 w-3" />
            {hiddenCount} Hidden
          </Badge>
          <Button
            onClick={handleResetAll}
            disabled={isResetting || hiddenCount === 0}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isResetting ? "animate-spin" : ""}`} />
            Show All Products
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading products...
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Dosage</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Visibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {search ? "No products match your search" : "No products found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                        {!product.active && (
                          <Badge variant="outline" className="ml-2">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{product.dosage || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {product.product_types?.name || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.visible ? (
                            <Badge variant="default" className="gap-1">
                              <Eye className="h-3 w-3" />
                              Visible
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <EyeOff className="h-3 w-3" />
                              Hidden
                            </Badge>
                          )}
                          <Switch
                            checked={product.visible}
                            onCheckedChange={() =>
                              toggleVisibility.mutate({
                                productId: product.id,
                                currentVisible: product.visible,
                              })
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filteredProducts.length > 0 && (
              <div className="mt-4">
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  hasNextPage={hasNextPage}
                  hasPrevPage={hasPrevPage}
                  totalItems={filteredProducts.length}
                  startIndex={startIndex}
                  endIndex={Math.min(endIndex, filteredProducts.length)}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
