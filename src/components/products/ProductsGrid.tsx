import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShoppingCart } from "lucide-react";
import { ProductDialog } from "./ProductDialog";
import { PatientSelectionDialog } from "./PatientSelectionDialog";
import { ProductCard } from "./ProductCard";
import { CartSheet } from "./CartSheet";
import { usePagination } from "@/hooks/usePagination";
import { useCartCount } from "@/hooks/useCartCount";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ProductsGrid = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [productForCart, setProductForCart] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  const isAdmin = effectiveRole === "admin";
  const isProvider = effectiveRole === "provider" || effectiveRole === "doctor";
  const isToplineRep = effectiveRole === "topline";
  const isDownlineRep = effectiveRole === "downline";
  const isRep = isToplineRep || isDownlineRep;

  const { data: cartCount } = useCartCount(effectiveUserId);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_pharmacies (
            pharmacy:pharmacies (
              id,
              name,
              states_serviced,
              priority_map,
              active
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ active: !currentStatus })
      .eq("id", productId);

    if (!error) {
      toast.success(`Product ${!currentStatus ? "activated" : "deactivated"}`);
      refetch();
    } else {
      toast.error("Failed to update product status");
    }
  };

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-products-count"] });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete product");
    },
  });

  const handleDeleteClick = (product: any) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      deleteProductMutation.mutate(productToDelete.id);
    }
  };

  const filteredProducts = useMemo(() => 
    products?.filter((product) => {
      const matchesSearch =
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.dosage?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = productTypeFilter === "all" || 
        product.product_type === productTypeFilter;
      
      return matchesSearch && matchesType;
    }), 
    [products, searchQuery, productTypeFilter]
  );

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredProducts?.length || 0,
    itemsPerPage: 15
  });

  const paginatedProducts = filteredProducts?.slice(startIndex, endIndex);

  const handleAddToCart = async (
    patientId: string | null, 
    quantity: number, 
    shipToPractice: boolean, 
    providerId: string, 
    prescriptionUrl: string | null = null,
    customSig: string | null = null,
    customDosage: string | null = null,
    orderNotes: string | null = null,
    prescriptionMethod: string | null = null
  ) => {
    if (!effectiveUserId || !productForCart) return;

    try {
      // Determine correct price tier based on practice's rep hierarchy
      const { data: practiceProfile } = await supabase
        .from("profiles")
        .select("linked_topline_id")
        .eq("id", effectiveUserId)
        .single();

      let correctPrice = productForCart.retail_price || productForCart.base_price;

      if (practiceProfile?.linked_topline_id) {
        const { data: linkedRep } = await supabase
          .from("reps")
          .select("role, assigned_topline_id")
          .eq("user_id", practiceProfile.linked_topline_id)
          .single();

        if (linkedRep?.role === 'downline') {
          correctPrice = productForCart.retail_price || productForCart.base_price;
        } else if (linkedRep?.role === 'topline') {
          correctPrice = productForCart.topline_price || productForCart.base_price;
        }
      }

      // Get or create cart
      let { data: cart } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", effectiveUserId)
        .single();

      if (!cart) {
        const { data: newCart, error: cartError } = await supabase
          .from("cart")
          .insert({ doctor_id: effectiveUserId })
          .select("id")
          .single();

        if (cartError) throw cartError;
        cart = newCart;
      }

      if (shipToPractice) {
        const { error } = await supabase
          .from("cart_lines" as any)
          .insert({
            cart_id: cart.id,
            product_id: productForCart.id,
            patient_id: null,
            provider_id: providerId,
            patient_name: "Practice Order",
            patient_email: null,
            patient_phone: null,
            patient_address: null,
            quantity: quantity,
            price_snapshot: correctPrice,
            destination_state: "XX",
            prescription_url: prescriptionUrl,
            custom_sig: customSig,
            custom_dosage: customDosage,
            order_notes: orderNotes,
            prescription_method: prescriptionMethod,
          });

        if (error) throw error;
      } else {
        const { data: patient } = await supabase
          .from("patients")
          .select("name, email, phone, address")
          .eq("id", patientId!)
          .single();

        const { error } = await supabase
          .from("cart_lines" as any)
          .insert({
            cart_id: cart.id,
            product_id: productForCart.id,
            patient_id: patientId,
            provider_id: providerId,
            patient_name: patient?.name || "Unknown",
            patient_email: patient?.email,
            patient_phone: patient?.phone,
            patient_address: patient?.address,
            quantity: quantity,
            price_snapshot: correctPrice,
            destination_state: "IL",
            prescription_url: prescriptionUrl,
            custom_sig: customSig,
            custom_dosage: customDosage,
            order_notes: orderNotes,
            prescription_method: prescriptionMethod,
          });

        if (error) throw error;
      }

      toast.success("Product added to cart");
      queryClient.invalidateQueries({ queryKey: ["cart-count", effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      toast.error(error.message || "Failed to add product to cart");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-1 gap-3 flex-col sm:flex-row">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={productTypeFilter}
            onValueChange={setProductTypeFilter}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Vitamins">Vitamins</SelectItem>
              <SelectItem value="R & D Products">R & D Products</SelectItem>
              <SelectItem value="Peptides">Peptides</SelectItem>
              <SelectItem value="GLP 1">GLP 1</SelectItem>
              <SelectItem value="GLP 2">GLP 2</SelectItem>
              <SelectItem value="GLP 3">GLP 3</SelectItem>
              <SelectItem value="Supplies">Supplies</SelectItem>
              <SelectItem value="Vitamin IV's">Vitamin IV's</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3">
          {isProvider && (
            <Button
              variant="outline"
              size="lg"
              className="relative"
              onClick={() => setCartSheetOpen(true)}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Cart
              {cartCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center"
                >
                  {cartCount}
                </Badge>
              )}
            </Button>
          )}
          
          {isAdmin && (
            <Button
              onClick={() => {
                setSelectedProduct(null);
                setIsEditing(false);
                setDialogOpen(true);
              }}
            >
              Add Product
            </Button>
          )}
          
          {(isProvider || isRep) && <Badge variant="secondary">Read Only</Badge>}
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading products...
        </div>
      ) : filteredProducts?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No products found
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {paginatedProducts?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAdmin={isAdmin}
                isProvider={isProvider}
                isToplineRep={isToplineRep}
                isDownlineRep={isDownlineRep}
                role={effectiveRole}
                onEdit={(product) => {
                  setSelectedProduct(product);
                  setIsEditing(true);
                  setDialogOpen(true);
                }}
                onDelete={handleDeleteClick}
                onAddToCart={(product) => {
                  setProductForCart(product);
                  setPatientDialogOpen(true);
                }}
                onToggleStatus={toggleProductStatus}
              />
            ))}
          </div>

          {filteredProducts && filteredProducts.length > 0 && (
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
          )}
        </>
      )}

      {/* Dialogs */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={isEditing ? selectedProduct : null}
        onSuccess={() => refetch()}
      />

      <PatientSelectionDialog
        open={patientDialogOpen}
        onOpenChange={setPatientDialogOpen}
        product={productForCart}
        onAddToCart={handleAddToCart}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cart Sheet */}
      <CartSheet open={cartSheetOpen} onOpenChange={setCartSheetOpen} />
    </div>
  );
};
