import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Eye, Edit, ShoppingCart, Trash2 } from "lucide-react";
import { ProductDialog } from "./ProductDialog";
import { PatientSelectionDialog } from "./PatientSelectionDialog";
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

export const ProductsDataTable = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [productForCart, setProductForCart] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);

  const isAdmin = effectiveRole === "admin";
  const isProvider = effectiveRole === "provider" || effectiveRole === "doctor";

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
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

  const filteredProducts = products?.filter((product) =>
    product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.dosage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToCart = async (patientId: string | null, quantity: number, shipToPractice: boolean, providerId: string) => {
    if (!effectiveUserId || !productForCart) return;

    try {
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
        // Practice order - no patient info needed
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
            price_snapshot: productForCart.retail_price || productForCart.base_price,
            destination_state: "XX", // Placeholder for practice orders
          });

        if (error) throw error;
      } else {
        // Patient order - get patient details
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
            price_snapshot: productForCart.retail_price || productForCart.base_price,
            destination_state: "IL", // Default state, can be updated
          });

        if (error) throw error;
      }

      toast.success("Product added to cart");
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      toast.error(error.message || "Failed to add product to cart");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
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
        {isProvider && <Badge variant="secondary">Read Only</Badge>}
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Dosage</TableHead>
              {isAdmin && <TableHead>Base Price</TableHead>}
              {isAdmin && <TableHead>Topline Price</TableHead>}
              {isAdmin && <TableHead>Downline Price</TableHead>}
              {isAdmin && <TableHead>Practice Price</TableHead>}
              {isProvider && <TableHead>Practice Price</TableHead>}
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 6} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredProducts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 6} className="text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs">
                        No image
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.dosage || "-"}</TableCell>
                  {isAdmin && <TableCell>${product.base_price}</TableCell>}
                  {isAdmin && <TableCell>${product.topline_price || "-"}</TableCell>}
                  {isAdmin && <TableCell>${product.downline_price || "-"}</TableCell>}
                  {isAdmin && <TableCell>${product.retail_price || "-"}</TableCell>}
                  {isProvider && <TableCell className="font-semibold text-primary">${product.retail_price || product.base_price}</TableCell>}
                  <TableCell>
                    <Switch
                      checked={product.active}
                      onCheckedChange={() => toggleProductStatus(product.id, product.active)}
                      disabled={!isAdmin}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isProvider && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setProductForCart(product);
                            setPatientDialogOpen(true);
                          }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Add to Cart
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setIsEditing(true);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
};
