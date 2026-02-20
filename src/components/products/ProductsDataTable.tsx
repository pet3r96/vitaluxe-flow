import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useResponsive } from "@/hooks/useResponsive";
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
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { toast } from "sonner";
import { isValidStateCode } from "@/lib/addressUtils";
import { logger } from "@/lib/logger";
import { ProductMobileCard } from "./ProductMobileCard";
import { ProductTableRow } from "./ProductTableRow";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { measurePageLoad } from "@/lib/performanceMonitor";
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
  const perf = useRef(measurePageLoad('ProductsDataTable')).current;
  const { effectiveRole, effectiveUserId, effectivePracticeId, isProviderAccount } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [productForCart, setProductForCart] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);

  const isAdmin = effectiveRole === "admin";
  const isProvider = effectiveRole === "provider" || effectiveRole === "doctor";
  const isToplineRep = effectiveRole === "topline";
  const isDownlineRep = effectiveRole === "downline";
  const isRep = isToplineRep || isDownlineRep;

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products"],
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

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.dosage?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = activeFilter === "all" || 
      (activeFilter === "active" && product.active) || 
      (activeFilter === "inactive" && !product.active);
    return matchesSearch && matchesActive;
  });

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
    itemsPerPage: 25
  });

  const paginatedProducts = filteredProducts?.slice(startIndex, endIndex);

  // Helper to convert user_id to provider.id
  const getProviderIdFromUserId = async (userId: string): Promise<string | null> => {
    try {
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .single();
      
      return provider?.id || null;
    } catch (error) {
      logger.error("Error getting provider ID", error);
      return null;
    }
  };

  // Helper: Get practice_id for a provider user
  const getPracticeIdFromProviderUserId = async (userId: string): Promise<string | null> => {
    try {
      const { data: provider } = await supabase
        .from("providers")
        .select("practice_id")
        .eq("user_id", userId)
        .eq("active", true)
        .single();
      
      return provider?.practice_id || null;
    } catch (error) {
      logger.error("Error getting practice ID from provider", error);
      return null;
    }
  };

  // Helper to get user's topline rep ID for pharmacy scoping
  const getUserToplineRepId = async (userId: string): Promise<string | null> => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("linked_topline_id")
        .eq("id", userId)
        .single();
      
      if (!profile?.linked_topline_id) return null;
      
      const { data: rep } = await supabase
        .from("reps")
        .select("id")
        .eq("user_id", profile.linked_topline_id)
        .single();
      
      return rep?.id || null;
    } catch (error) {
      logger.error("Error getting topline rep ID", error);
      return null;
    }
  };

  const handleAddToCart = async (
    patientId: string | null, 
    quantity: number, 
    shipToPractice: boolean, 
    providerId: string, 
    prescriptionUrl: string | null = null,
    customSig: string | null = null,
    customDosage: string | null = null,
    orderNotes: string | null = null,
    prescriptionMethod: string | null = null,
    variantId: string | null = null,
    daysSupply: number | null = null
  ) => {
    if (!effectiveUserId || !productForCart) return;

    try {
      // Resolve practice context for providers and staff
      let resolvedDoctorId = effectiveUserId;
      
      // For providers: resolve practice ID from their provider record
      if (effectiveRole === 'provider' && effectiveUserId) {
        try {
          const { data: providerData } = await supabase
            .from('providers')
            .select('practice_id')
            .eq('user_id', effectiveUserId)
            .single();
          
          if (providerData?.practice_id) {
            resolvedDoctorId = providerData.practice_id;
            logger.info('ProductsDataTable resolved provider practice', logger.sanitize({ practiceId: resolvedDoctorId }));
          }
        } catch (error) {
          logger.error('[ProductsDataTable] ❌ Error resolving provider practice', error);
        }
      }
      
      // For staff: use effective practice ID
      if (effectiveRole === 'staff' && effectivePracticeId) {
        resolvedDoctorId = effectivePracticeId;
      }
      
      logger.info('[ProductsDataTable] 🎯 Cart context:', {
        effectiveUserId,
        effectiveRole,
        effectivePracticeId,
        isProviderAccount
      });
      
      // First, resolve practice ID for correct pricing lookup
      let practiceIdForPricing = resolvedDoctorId;  // Use resolved doctor ID
      
      // Check if the selected provider is actually a provider
      const { data: providerRoleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", providerId)  // ✅ Check selected provider
        .single();

      if (providerRoleCheck?.role === 'provider') {
        const resolvedPracticeId = await getPracticeIdFromProviderUserId(providerId);
        if (resolvedPracticeId) {
          practiceIdForPricing = resolvedPracticeId;
        }
      }

      // Determine correct price tier based on practice's rep hierarchy
      const { data: practiceProfile } = await supabase
        .from("profiles")
        .select("linked_topline_id")
        .eq("id", practiceIdForPricing)  // ✅ Use practice ID for providers
        .single();

      // Determine price tier based on linked rep
      let priceTier: 'topline' | 'downline' | 'retail' = 'retail';
      
      if (practiceProfile?.linked_topline_id) {
        const { data: linkedRep } = await supabase
          .from("reps")
          .select("role, assigned_topline_id")
          .eq("user_id", practiceProfile.linked_topline_id)
          .single();

        if (linkedRep?.role === 'topline') {
          priceTier = 'topline';
        }
        // downline practices pay retail price
      }

      // If a variant is selected, fetch variant pricing
      let correctPrice = productForCart.retail_price || productForCart.base_price;
      
      if (variantId) {
        const { data: variant } = await supabase
          .from("product_variants")
          .select("base_price, topline_price, downline_price, retail_price")
          .eq("id", variantId)
          .single();
        
        if (variant) {
          switch (priceTier) {
            case 'topline':
              correctPrice = variant.topline_price ?? variant.base_price;
              break;
            case 'retail':
            default:
              correctPrice = variant.retail_price ?? variant.base_price;
              break;
          }
          logger.info('[ProductsDataTable] Using variant price', { variantId, priceTier, correctPrice });
        }
      } else {
        // No variant - use product-level pricing
        if (priceTier === 'topline') {
          correctPrice = productForCart.topline_price || productForCart.base_price;
        } else {
          correctPrice = productForCart.retail_price || productForCart.base_price;
        }
      }

      // CRITICAL FIX: Need to resolve cart owner for staff/practice users
      // Import and use cartOwnerResolver at the top of the file
      const { resolveCartOwnerUserId } = await import("@/lib/cartOwnerResolver");
      const cartOwnerId = await resolveCartOwnerUserId(effectiveUserId, effectiveRole!, effectivePracticeId);
      const cartOwnerForDb = cartOwnerId || effectiveUserId;
      
      if (!cartOwnerForDb) {
        toast.error("Unable to determine cart owner. Please contact support.");
        return;
      }

      // ORDER CONTEXT: For providers, use resolved practice ID for shipping/routing
      // (cart stays linked to provider's user_id above)
      const { data: userRoleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", providerId)  // ✅ Check the selected provider, not logged-in user
        .single();

      if (userRoleData?.role === 'provider') {
        const practiceId = await getPracticeIdFromProviderUserId(providerId);  // ✅ Use providerId
        if (!practiceId) {
          toast.error("Unable to find practice association. Please contact support.");
          return;
        }
        resolvedDoctorId = practiceId;
        logger.info('[ProductsDataTable] Provider detected - using practice context for orders', { 
          provider_user_id: providerId,
          practice_id: practiceId 
        });
      }

      if (shipToPractice) {
        logger.info('[ProductsDataTable] Practice order - fetching practice shipping address', { effectiveUserId });
        
        // Get practice's shipping address
        const { data: practiceProfile } = await supabase
          .from("profiles")
          .select("shipping_address_formatted, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip")
          .eq("id", resolvedDoctorId)
          .single();

        // Use direct state field from Google Address (no parsing needed)
        const destinationState = practiceProfile?.shipping_address_state || '';
        
        logger.info('[ProductsDataTable] Practice shipping state resolved', { destinationState });

        if (!isValidStateCode(destinationState)) {
          toast.error(
            "Invalid practice shipping address. Please set it in your Profile with a valid 2-letter state."
          );
          return;
        }

        // Only look up provider ID if this is actually a provider account
        // Staff and practice owners don't have provider records
        const actualProviderId = isProviderAccount 
          ? await getProviderIdFromUserId(providerId)
          : null;
        
        logger.info('[ProductsDataTable] Provider ID mapping', { providerId_userId: providerId, actualProviderId_providersId: actualProviderId });

        // Get user's topline rep ID for scoping (use resolved practice ID)
        const userToplineRepId = await getUserToplineRepId(resolvedDoctorId || effectiveUserId);

        // Route to pharmacy - BLOCK if no pharmacy available
        const { data: routingResult, error: routingError } = await supabase.functions.invoke(
          'route-order-to-pharmacy',
          {
            body: {
              product_id: productForCart.id,
              destination_state: destinationState,
              user_topline_rep_id: userToplineRepId
            }
          }
        );

        if (routingError) {
          logger.error("Routing error", routingError);
          toast.error("Unable to verify pharmacy availability. Please try again.");
          return;
        }

        if (!routingResult?.pharmacy_id) {
          toast.error(
            `Unable to add to cart: No pharmacy available to fulfill "${productForCart.name}" in ${destinationState}. ${routingResult?.reason || 'Please contact support.'}`
          );
          return;
        }

        logger.info(`✅ Pharmacy routed: ${routingResult.reason}`);

        const { error } = await supabase.functions.invoke('manage-cart', {
          body: {
            action: 'add',
            cartOwnerId: cartOwnerForDb,
            productId: productForCart.id,
            patientId: null,
            providerId: actualProviderId,
            patientName: "Practice Order",
            patientEmail: null,
            patientPhone: null,
            patientAddress: null,
            quantity: quantity,
            priceSnapshot: correctPrice,
            destinationState: destinationState,
            assignedPharmacyId: routingResult.pharmacy_id,
            prescriptionUrl: prescriptionUrl,
            customSig: customSig,
            customDosage: customDosage,
            orderNotes: orderNotes,
            prescriptionMethod: prescriptionMethod,
            variantId: variantId,
            daysSupply: daysSupply,
          }
        });

        if (error) throw error;
      } else {
        // Patient order - fetch from patient_accounts table (patientId is patient_accounts.id from dialog)
        const { data: patientRecord, error: patientError } = await supabase
          .from("patient_accounts")
          .select("id, name, first_name, last_name, email, phone, address_street, address_city, address_state, address_zip, user_id, gender_at_birth")
          .eq("id", patientId!)
          .single();
        
        if (patientError || !patientRecord) {
          logger.error("Failed to fetch patient", patientError);
          toast.error("Unable to find patient information. Please refresh and try again.");
          return;
        }

        // Use state from patients table
        const destinationState = patientRecord.address_state || '';

        if (!isValidStateCode(destinationState)) {
          toast.error(
            "Patient address is incomplete or invalid. Please update the patient's address with valid state information."
          );
          return;
        }

        // Only look up provider ID if this is actually a provider account
        // Staff and practice owners don't have provider records
        const actualProviderId = isProviderAccount 
          ? await getProviderIdFromUserId(providerId)
          : null;

        // Get user's topline rep ID for scoping
        const userToplineRepId = await getUserToplineRepId(effectiveUserId);

        // Route to pharmacy - BLOCK if no pharmacy available
        const { data: routingResult, error: routingError } = await supabase.functions.invoke(
          'route-order-to-pharmacy',
          {
            body: {
              product_id: productForCart.id,
              destination_state: destinationState,
              user_topline_rep_id: userToplineRepId
            }
          }
        );

        if (routingError) {
          logger.error("Routing error", routingError);
          toast.error("Unable to verify pharmacy availability. Please try again.");
          return;
        }

        if (!routingResult?.pharmacy_id) {
          logger.error('[ProductsDataTable] Routing failed', null, {
            error: routingError,
            product_id: productForCart.id
          });
          toast.error(
            `Cannot add to cart: No pharmacy available for "${productForCart.name}" in ${destinationState}. ${routingResult?.reason || 'Please verify address has valid 2-letter state code.'}`
          );
          return;
        }

        // Validate patient address completeness - all 4 fields required
        const hasCompleteAddress = !!(
          patientRecord.address_street && 
          patientRecord.address_city && 
          patientRecord.address_state && 
          patientRecord.address_zip
        );

        const { error } = await supabase.functions.invoke('manage-cart', {
          body: {
            action: 'add',
            cartOwnerId: cartOwnerForDb,
            productId: productForCart.id,
            patientId: patientRecord.id,
            providerId: actualProviderId,
            patientName: patientRecord.name || "Unknown",
            patientEmail: patientRecord.email,
            patientPhone: patientRecord.phone,
            patientAddress: null,
            patientAddressStreet: patientRecord.address_street || null,
            patientAddressCity: patientRecord.address_city || null,
            patientAddressState: patientRecord.address_state || null,
            patientAddressZip: patientRecord.address_zip || null,
            patientAddressValidated: hasCompleteAddress,
            patientAddressValidationSource: hasCompleteAddress ? 'patient_record' : null,
            quantity: quantity,
            priceSnapshot: correctPrice,
            destinationState: destinationState,
            assignedPharmacyId: routingResult.pharmacy_id,
            prescriptionUrl: prescriptionUrl,
            customSig: customSig,
            customDosage: customDosage,
            orderNotes: orderNotes,
            prescriptionMethod: prescriptionMethod,
            genderAtBirth: patientRecord.gender_at_birth,
            variantId: variantId,
            daysSupply: daysSupply,
          }
        });

        if (error) throw error;
      }

      toast.success("Product added to cart");
      // Optimistic update: increment count immediately
      queryClient.setQueryData(
        ["cart-count", effectiveUserId],
        (old: number | undefined) => (old || 0) + quantity
      );
      // Then refetch to sync with server
      queryClient.refetchQueries({ queryKey: ["cart-count", effectiveUserId], type: 'active' });
      queryClient.refetchQueries({ queryKey: ["cart", effectiveUserId], type: 'active' });
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error adding to cart", error);
      });
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
        {(isProvider || isRep) && <Badge variant="secondary">Read Only</Badge>}
      </div>

      {/* Mobile View */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : filteredProducts?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No products found
            </div>
          ) : (
            paginatedProducts?.map((product) => (
              <ProductMobileCard
                key={product.id}
                product={product}
                onView={(product) => {
                  setSelectedProduct(product);
                  setIsEditing(false);
                  setDialogOpen(true);
                }}
                onEdit={(product) => {
                  setSelectedProduct(product);
                  setIsEditing(true);
                  setDialogOpen(true);
                }}
                onAddToCart={(product) => {
                  setProductForCart(product);
                  setPatientDialogOpen(true);
                }}
                onDelete={handleDeleteClick}
                onToggleStatus={toggleProductStatus}
                isAdmin={isAdmin}
                isProvider={isProvider}
                isRep={isRep}
              />
            ))
          )}
        </div>
      ) : (
        /* Desktop View */
        <div className="min-w-[1600px]">
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
                {isToplineRep && <TableHead>Topline Price</TableHead>}
                {isToplineRep && <TableHead>Practice Price</TableHead>}
                {isDownlineRep && <TableHead>Downline Price</TableHead>}
                {isDownlineRep && <TableHead>Practice Price</TableHead>}
                {isProvider && <TableHead>Practice Price</TableHead>}
                {isAdmin && <TableHead>Pharmacy</TableHead>}
                {isAdmin && <TableHead>Rx Required</TableHead>}
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : isRep ? 5 : 6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredProducts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : isRep ? 5 : 6} className="text-center text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts?.map((product) => (
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
                  {isToplineRep && (
                    <TableCell className="font-semibold text-primary">
                      ${product.topline_price || "-"}
                    </TableCell>
                  )}
                  {isToplineRep && (
                    <TableCell>
                      ${product.retail_price || "-"}
                    </TableCell>
                  )}
                  {isDownlineRep && (
                    <TableCell className="font-semibold text-primary">
                      ${product.downline_price || "-"}
                    </TableCell>
                  )}
                  {isDownlineRep && (
                    <TableCell>
                      ${product.retail_price || "-"}
                    </TableCell>
                  )}
                  {isProvider && <TableCell className="font-semibold text-primary">${product.retail_price || product.base_price}</TableCell>}
                  {isAdmin && (
                    <TableCell>
                      {product.product_pharmacies?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.product_pharmacies.slice(0, 2).map((pp: any) => (
                            <Badge key={pp.pharmacy.id} variant="secondary" className="text-xs">
                              {pp.pharmacy.name}
                            </Badge>
                          ))}
                          {product.product_pharmacies.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{product.product_pharmacies.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          No pharmacies
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  {isAdmin && (
                    <TableCell>
                      <Badge variant={product.requires_prescription ? "default" : "secondary"}>
                        {product.requires_prescription ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                  )}
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
      )}

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
