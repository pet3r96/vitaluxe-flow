import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Plus } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { RequestProductDialog } from "./RequestProductDialog";

export const PharmacyProductsGrid = () => {
  const { effectiveUserId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>("all");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  // Get pharmacy ID for current user
  const { data: pharmacyData } = useQuery({
    queryKey: ["pharmacy-id", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id")
        .eq("user_id", effectiveUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Fetch products assigned to this pharmacy
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["pharmacy-products", pharmacyData?.id],
    queryFn: async () => {
      if (!pharmacyData?.id) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_types(id, name)
        `)
        .eq("pharmacy_id", pharmacyData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!pharmacyData?.id,
  });

  // Fetch product types for filter dropdown
  const { data: productTypes } = useQuery({
    queryKey: ["product-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const filteredProducts = useMemo(
    () =>
      products?.filter((product) => {
        const matchesSearch =
          product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.dosage?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType =
          productTypeFilter === "all" ||
          product.product_type_id === productTypeFilter;

        const matchesPrescription =
          prescriptionFilter === "all" ||
          (prescriptionFilter === "yes" && product.requires_prescription === true) ||
          (prescriptionFilter === "no" && product.requires_prescription === false);

        return matchesSearch && matchesType && matchesPrescription;
      }),
    [products, searchQuery, productTypeFilter, prescriptionFilter]
  );

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = usePagination({
    totalItems: filteredProducts?.length || 0,
    itemsPerPage: 25,
  });

  const paginatedProducts = filteredProducts?.slice(startIndex, endIndex);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Products</h2>
        <Button onClick={() => setRequestDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request New Product
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Product Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {productTypes?.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prescriptionFilter} onValueChange={setPrescriptionFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Prescription" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="yes">Rx Required</SelectItem>
            <SelectItem value="no">No Rx Required</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {paginatedProducts && paginatedProducts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedProducts.map((product) => (
              <Card key={product.id} className="flex flex-col h-full">
                <CardContent className="p-4 flex-1">
                  {/* Product Image */}
                  <div className="aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg line-clamp-2">
                      {product.name}
                    </h3>

                    {product.dosage && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        <span className="font-medium">Dosage:</span> {product.dosage}
                      </p>
                    )}

                    {product.sig && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        <span className="font-medium">Sig:</span> {product.sig}
                      </p>
                    )}

                    {/* Product Type */}
                    {product.product_types && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Type:</span>{" "}
                        {product.product_types.name}
                      </p>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {product.requires_prescription && (
                        <Badge variant="default" className="text-xs">
                          Rx Required
                        </Badge>
                      )}
                      <Badge
                        variant={product.active ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              hasNextPage={hasNextPage}
              hasPrevPage={hasPrevPage}
              totalItems={filteredProducts?.length || 0}
              startIndex={startIndex}
              endIndex={endIndex}
            />
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || productTypeFilter !== "all" || prescriptionFilter !== "all"
              ? "No products match your search criteria"
              : "No products assigned to your pharmacy"}
          </p>
        </div>
      )}

      {/* Summary Stats */}
      {products && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{products.length}</div>
            <div className="text-sm text-muted-foreground">Total Products</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {products.filter((p) => p.active).length}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {products.filter((p) => p.requires_prescription).length}
            </div>
            <div className="text-sm text-muted-foreground">Rx Required</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {products.filter((p) => !p.requires_prescription).length}
            </div>
            <div className="text-sm text-muted-foreground">No Rx</div>
          </div>
        </div>
      )}

      <RequestProductDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
};
