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
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { toast } from "sonner";
import { extractStateWithFallback, isValidStateCode } from "@/lib/addressUtils";
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
  const { effectiveRole, effectiveUserId, effectivePracticeId, isImpersonating } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>("all");
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
  // Topline reps see all products but with visibility indicators
  // Only real non-impersonating admins bypass visibility filtering
  const viewingAsAdmin = effectiveRole === "admin" && !isImpersonating;

  const { canOrder, isStaffAccount } = useStaffOrderingPrivileges();
  const { data: cartCount } = useCartCount(effectiveUserId);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products", effectiveUserId, effectiveRole],
    staleTime: 600000, // 10 minutes - products are relatively static
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          *,
          product_types(id, name),
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

      // Non-admins should only see active products
      // Admins see all products to manage status
      if (!viewingAsAdmin) {
        query = query.eq('active', true);
      }

      // For toplines, impersonated views, or non-admin users, filter by visibility
      if (isImpersonating || !viewingAsAdmin) {
        try {
          const { data: visibleProducts, error: visError } = await supabase.rpc(
            'get_visible_products_for_effective_user' as any,
            { p_effective_user_id: effectiveUserId }
          ) as { data: Array<{ id: string }> | null; error: any };
          
          if (visError) {
            import('@/lib/logger').then(({ logger }) => {
              logger.error('Visibility RPC error', visError);
            });
            toast.error('Could not determine product visibility');
            return [];
          } else if (visibleProducts && visibleProducts.length > 0) {
            const visibleProductIds = visibleProducts.map((p) => p.id);
            query = query.in('id', visibleProductIds);
          } else {
            // No visible products found
            return [];
          }
        } catch (error) {
          import('@/lib/logger').then(({ logger }) => {
            logger.error('Error checking product visibility', error);
          });
          toast.error('Could not determine product visibility');
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch visibility settings for topline rep to show hidden status
  const { data: visibilitySettings } = useQuery({
    queryKey: ["rep-product-visibility", effectiveUserId, isToplineRep],
    queryFn: async () => {
      if (!isToplineRep || !effectiveUserId) return {};
      
      const { data: repId, error: repError } = await supabase.rpc('get_user_rep_id', { 
        _user_id: effectiveUserId 
      });

      if (repError) {
        console.error('[ProductsGrid] Error fetching rep ID:', repError);
        return {};
      }

      if (!repId) {
        console.warn('[ProductsGrid] No rep ID found for user:', effectiveUserId);
        return {};
      }

      console.log('[ProductsGrid] Fetching visibility for rep ID:', repId);
      
      const { data, error } = await supabase
        .from('rep_product_visibility')
        .select('product_id, visible')
        .eq('topline_rep_id', repId);
      
      if (error) {
        console.error('[ProductsGrid] Error fetching visibility settings:', error);
        console.error('[ProductsGrid] Rep ID was:', repId);
        return {};
      }

      console.log('[ProductsGrid] Visibility settings loaded:', data?.length, 'entries');
      
      // Convert to map: productId -> visible boolean
      const visibilityMap: Record<string, boolean> = {};
      data?.forEach(item => {
        visibilityMap[item.product_id] = item.visible;
      });
      
      return visibilityMap;
    },
    enabled: isToplineRep,
    staleTime: 10000, // 10 seconds - syncs faster with Visibility Settings tab changes
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
        product.product_type_id === productTypeFilter;
      
      const matchesPrescription = 
        prescriptionFilter === "all" ||
        (prescriptionFilter === "yes" && product.requires_prescription === true) ||
        (prescriptionFilter === "no" && product.requires_prescription === false);
      
      return matchesSearch && matchesType && matchesPrescription;
    }), 
    [products, searchQuery, productTypeFilter, prescriptionFilter]
  );

  const productCounts = useMemo(() => {
    if (!products) return {
      all: 0,
      byType: {} as Record<string, number>,
      prescriptionRequired: 0,
      noPrescription: 0
    };

    const counts = {
      all: products.length,
      byType: {} as Record<string, number>,
      prescriptionRequired: 0,
      noPrescription: 0
    };

    products.forEach(product => {
      if (product.product_type_id) {
        counts.byType[product.product_type_id] = (counts.byType[product.product_type_id] || 0) + 1;
      }
      
      if (product.requires_prescription === true) {
        counts.prescriptionRequired++;
      } else {
        counts.noPrescription++;
      }
    });

    return counts;
  }, [products]);

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

  // Helper to get user's topline rep ID for pharmacy scoping
  const getUserToplineRepId = async (userId: string): Promise<string | null> => {
    try {
      // Get practice's linked_topline_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("linked_topline_id")
        .eq("id", userId)
        .single();
      
      if (!profile?.linked_topline_id) return null;
      
      // Convert user_id to rep_id
      const { data: rep } = await supabase
        .from("reps")
        .select("id")
        .eq("user_id", profile.linked_topline_id)
        .single();
      
      return rep?.id || null;
    } catch (error) {
      console.error("Error getting topline rep ID:", error);
      return null;
    }
  };

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
      console.error("Error getting provider ID:", error);
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
      console.error("Error getting practice ID from provider:", error);
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

      // Fetch effective price with overrides for this user
      const { data: effectivePriceData } = await supabase.rpc('get_effective_product_price', {
        p_product_id: productForCart.id,
        p_user_id: effectiveUserId
      });

      const effectiveRetailPrice = effectivePriceData?.[0]?.effective_retail_price;
      
      // Use effective retail price (with overrides) or fallback to product defaults
      correctPrice = effectiveRetailPrice ?? productForCart.retail_price ?? productForCart.base_price;

      // CART OPERATIONS: Always use effectiveUserId (provider's or practice's user_id)
      // This ensures providers see their own cart items
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

      // ORDER CONTEXT: For providers, resolve practice_id for shipping/routing/profits
      // For staff, use effectivePracticeId directly for practice context
      // (but cart stays linked to provider's/staff's user_id above)
      let resolvedDoctorId = effectiveUserId;
      const { data: userRoleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", effectiveUserId)
        .single();

      if (userRoleData?.role === 'provider') {
        const practiceId = await getPracticeIdFromProviderUserId(effectiveUserId);
        if (!practiceId) {
          toast.error("Unable to find practice association. Please contact support.");
          return;
        }
        resolvedDoctorId = practiceId;
        console.debug('[ProductsGrid] Provider detected - using practice context for orders', { 
          provider_user_id: effectiveUserId, 
          practice_id: practiceId 
        });
      } else if (userRoleData?.role === 'staff' && effectivePracticeId) {
        // For staff, use the effectivePracticeId from context
        resolvedDoctorId = effectivePracticeId;
        console.debug('[ProductsGrid] Staff detected - using practice context for orders', { 
          staff_user_id: effectiveUserId, 
          practice_id: effectivePracticeId 
        });
      }

      if (shipToPractice) {
        console.debug('[ProductsGrid] Practice order - fetching practice shipping address', { effectiveUserId });
        
        // Get practice's shipping address
        const { data: practiceProfile } = await supabase
          .from("profiles")
          .select("shipping_address_formatted, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip")
          .eq("id", resolvedDoctorId)
          .single();

        // Use direct state field from Google Address (no parsing needed)
        const destinationState = practiceProfile?.shipping_address_state || '';
        
        console.debug('[ProductsGrid] Practice shipping state resolved', { destinationState });

        if (!isValidStateCode(destinationState)) {
          toast.error(
            "Invalid practice shipping address. Please update your practice shipping address in Profile with a valid 2-letter state."
          );
          return;
        }

        // Convert user_id to provider.id for database insertion
        const actualProviderId = await getProviderIdFromUserId(providerId);
        if (!actualProviderId) {
          toast.error("Unable to find provider record. Please contact support.");
          return;
        }
        
        console.debug('[ProductsGrid] Provider ID mapping', { providerId_userId: providerId, actualProviderId_providersId: actualProviderId });

        // Get user's topline rep ID for scoping - use resolvedDoctorId (practice_id) to get topline rep
        const userToplineRepId = await getUserToplineRepId(resolvedDoctorId);

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
          console.error("Routing error:", routingError);
          toast.error("Unable to verify pharmacy availability. Please try again.");
          return;
        }

        if (!routingResult?.pharmacy_id) {
          toast.error(
            `Unable to add to cart: No pharmacy available to fulfill "${productForCart.name}" in ${destinationState}. ${routingResult?.reason || 'Please contact support.'}`
          );
          return;
        }

        // Success - pharmacy found, proceed with insertion
        console.log(`✅ Pharmacy routed: ${routingResult.reason}`);

        const { error } = await supabase
          .from("cart_lines" as any)
          .insert({
            cart_id: cart.id,
            product_id: productForCart.id,
            patient_id: null,
            provider_id: actualProviderId,
            patient_name: "Practice Order",
            patient_email: null,
            patient_phone: null,
            patient_address: null,
            quantity: quantity,
            price_snapshot: correctPrice,
            destination_state: destinationState,
            assigned_pharmacy_id: routingResult.pharmacy_id,
            prescription_url: prescriptionUrl,
            custom_sig: customSig,
            custom_dosage: customDosage,
            order_notes: orderNotes,
            prescription_method: prescriptionMethod,
          });

        if (error) throw error;
      } else {
        // PATIENT ORDER - fetch from patients table (patientId is patients.id from dialog)
        const { data: patientRecord, error: patientError } = await supabase
          .from("patients")
          .select("id, name, email, phone, address_street, address_city, address_state, address_zip, patient_account_id")
          .eq("id", patientId!)
          .single();

        if (patientError || !patientRecord) {
          console.error("Failed to fetch patient:", patientError);
          toast.error("Unable to find patient information. Please select a valid patient.");
          return;
        }

        // Use state from patients table
        const destinationState = patientRecord.address_state || '';

        // Build formatted address for display
        const patientAddress = patientRecord.address_street && patientRecord.address_city && patientRecord.address_state && patientRecord.address_zip
            ? `${patientRecord.address_street}, ${patientRecord.address_city}, ${patientRecord.address_state} ${patientRecord.address_zip}`
            : patientRecord.address_street || null;


        if (!isValidStateCode(destinationState)) {
          // If destination state is invalid/missing, allow adding to cart without routing.
          // Use placeholder state "XX" to satisfy NOT NULL constraint, will be corrected on Delivery Confirmation
          console.warn('[ProductsGrid] Missing/invalid patient state. Skipping routing and inserting unassigned line with placeholder state.');
          const actualProviderId = await getProviderIdFromUserId(providerId);
          if (!actualProviderId) {
            toast.error("Unable to find provider record. Please contact support.");
            return;
          }

          const { error: insertError } = await supabase
            .from("cart_lines" as any)
            .insert({
              cart_id: cart.id,
              product_id: productForCart.id,
              patient_id: patientRecord.id, // Use patients.id for foreign key
              provider_id: actualProviderId,
              patient_name: patientRecord.name || "Unknown",
              patient_email: patientRecord.email,
              patient_phone: patientRecord.phone,
              patient_address: null,
              patient_address_street: patientRecord.address_street || null,
              patient_address_city: patientRecord.address_city || null,
              patient_address_state: patientRecord.address_state || null,
              patient_address_zip: patientRecord.address_zip || null,
              patient_address_validated: false,
              patient_address_validation_source: null,
              quantity: quantity,
              price_snapshot: correctPrice,
              destination_state: 'XX', // Placeholder for missing/invalid state
              assigned_pharmacy_id: null,
              prescription_url: prescriptionUrl,
              custom_sig: customSig,
              custom_dosage: customDosage,
              order_notes: orderNotes,
              prescription_method: prescriptionMethod,
            });

          if (insertError) throw insertError;

          toast.message("Added to cart", { description: "Please complete patient address on Delivery Confirmation." });
          // Optimistic update: increment count immediately
          queryClient.setQueryData(
            ["cart-count", effectiveUserId],
            (old: number | undefined) => (old || 0) + quantity
          );
          queryClient.invalidateQueries({ queryKey: ["cart-count", effectiveUserId] });
          // Optimistically push item into cart cache so CartSheet updates instantly
          queryClient.setQueryData(["cart", effectiveUserId], (old: any) => {
            const productMeta = {
              id: productForCart.id,
              name: productForCart.name,
              dosage: (productForCart as any).dosage,
              image_url: (productForCart as any).image_url,
            };
            const optimisticItem = {
              id: `temp_${Date.now()}`,
              cart_id: cart.id,
              product_id: productForCart.id,
              product: productMeta,
              patient_name: patientRecord.name || 'Unknown',
              quantity,
              price_snapshot: correctPrice,
              destination_state: 'XX',
              created_at: new Date().toISOString(),
            };
            if (!old) {
              return { cartId: cart.id, items: [optimisticItem] };
            }
            if (old.items) {
              return { ...old, items: [...old.items, optimisticItem] };
            }
            if (old.lines) {
              return { ...old, lines: [...old.lines, optimisticItem] };
            }
            return old;
          });
          queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
          return;
        }

        // Convert user_id to provider.id for database insertion
        const actualProviderId = await getProviderIdFromUserId(providerId);
        if (!actualProviderId) {
          toast.error("Unable to find provider record. Please contact support.");
          return;
        }

        // Get user's topline rep ID for scoping - use resolvedDoctorId (practice_id) to get topline rep
        const userToplineRepId = await getUserToplineRepId(resolvedDoctorId);

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
          console.error("Routing error:", routingError);
          toast.error("Unable to verify pharmacy availability. Please try again.");
          return;
        }

        if (!routingResult?.pharmacy_id) {
          toast.error(
            `Unable to add to cart: No pharmacy available to fulfill "${productForCart.name}" in ${destinationState}. ${routingResult?.reason || 'Please contact support.'}`
          );
          return;
        }

        // Success - pharmacy found, proceed with insertion
        console.log(`✅ Pharmacy routed: ${routingResult.reason}`);

        // Validate patient address completeness - all 4 fields required
        const hasCompleteAddress = !!(
          patientRecord.address_street && 
          patientRecord.address_city && 
          patientRecord.address_state && 
          patientRecord.address_zip
        );

        const { error } = await supabase
          .from("cart_lines" as any)
          .insert({
            cart_id: cart.id,
            product_id: productForCart.id,
            patient_id: patientRecord.id, // Use patients.id for foreign key
            provider_id: actualProviderId,
            patient_name: patientRecord.name || "Unknown",
            patient_email: patientRecord.email,
            patient_phone: patientRecord.phone,
            patient_address: null, // Clear legacy field
            patient_address_street: patientRecord.address_street || null,
            patient_address_city: patientRecord.address_city || null,
            patient_address_state: patientRecord.address_state || null,
            patient_address_zip: patientRecord.address_zip || null,
            patient_address_validated: hasCompleteAddress,
            patient_address_validation_source: hasCompleteAddress ? 'patient_record' : null,
            quantity: quantity,
            price_snapshot: correctPrice,
            destination_state: destinationState,
            assigned_pharmacy_id: routingResult.pharmacy_id,
            prescription_url: prescriptionUrl,
            custom_sig: customSig,
            custom_dosage: customDosage,
            order_notes: orderNotes,
            prescription_method: prescriptionMethod,
          });

        if (error) throw error;
      }

      toast.success("Product added to cart");
      // Optimistic update: increment count immediately
      queryClient.setQueryData(
        ["cart-count", effectiveUserId],
        (old: number | undefined) => (old || 0) + quantity
      );
      // Optimistic update: push item into cart cache for instant UI
      queryClient.setQueryData(["cart", effectiveUserId], (old: any) => {
        const patientName = 'Practice Order';
        const productMeta = {
          id: productForCart.id,
          name: productForCart.name,
          dosage: (productForCart as any).dosage,
          image_url: (productForCart as any).image_url,
        };
        const optimisticItem = {
          id: `temp_${Date.now()}`,
          cart_id: cart.id,
          product_id: productForCart.id,
          product: productMeta,
          patient_name: patientName,
          quantity,
          price_snapshot: correctPrice,
          destination_state: 'XX',
          created_at: new Date().toISOString(),
        };
        if (!old) {
          return { cartId: cart.id, items: [optimisticItem] };
        }
        if (old.items) {
          return { ...old, items: [...old.items, optimisticItem] };
        }
        if (old.lines) {
          return { ...old, lines: [...old.lines, optimisticItem] };
        }
        return old;
      });
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
              <SelectItem value="all">All Types ({productCounts.all})</SelectItem>
              <SelectItem value="Vitamins">Vitamins ({productCounts.byType["Vitamins"] || 0})</SelectItem>
              <SelectItem value="R & D Products">R & D Products ({productCounts.byType["R & D Products"] || 0})</SelectItem>
              <SelectItem value="Peptides">Peptides ({productCounts.byType["Peptides"] || 0})</SelectItem>
              <SelectItem value="GLP 1">GLP 1 ({productCounts.byType["GLP 1"] || 0})</SelectItem>
              <SelectItem value="GLP 2">GLP 2 ({productCounts.byType["GLP 2"] || 0})</SelectItem>
              <SelectItem value="GLP 3">GLP 3 ({productCounts.byType["GLP 3"] || 0})</SelectItem>
              <SelectItem value="Supplies">Supplies ({productCounts.byType["Supplies"] || 0})</SelectItem>
              <SelectItem value="Vitamin IV's">Vitamin IV's ({productCounts.byType["Vitamin IV's"] || 0})</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={prescriptionFilter}
            onValueChange={setPrescriptionFilter}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by prescription" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products ({productCounts.all})</SelectItem>
              <SelectItem value="yes">Prescription Required ({productCounts.prescriptionRequired})</SelectItem>
              <SelectItem value="no">No Prescription ({productCounts.noPrescription})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3">
          {(isProvider || (isStaffAccount && canOrder)) && (
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
                canOrder={canOrder}
                isHiddenFromDownline={isToplineRep && visibilitySettings?.[product.id] === false}
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
