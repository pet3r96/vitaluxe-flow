import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProducts } from "@/hooks/useRealtimeProducts";
import { resolveCartOwnerUserId } from "@/lib/cartOwnerResolver";
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
import { Search, ShoppingCart, Plus } from "lucide-react";
import { ProductDialog } from "./ProductDialog";
import { PatientSelectionDialog } from "./PatientSelectionDialog";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./ProductCardSkeleton";
import { CartSheet } from "./CartSheet";
import { usePagination } from "@/hooks/usePagination";
import { useCartCount } from "@/hooks/useCartCount";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { usePracticeRxPrivileges } from "@/hooks/usePracticeRxPrivileges";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { toast } from "sonner";
import { extractStateWithFallback, isValidStateCode } from "@/lib/addressUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  const { effectiveRole, effectiveUserId, effectivePracticeId, isImpersonating, isProviderAccount } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  // Fetch product types for dynamic filtering
  const { data: productTypes } = useQuery({
    queryKey: ["product-types"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_types")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { canOrder: staffCanOrder, isStaffAccount } = useStaffOrderingPrivileges();
  // Providers and doctors always have ordering privileges, but reps and admins cannot order
  const canOrder = (isProvider || staffCanOrder) && !isRep && !isAdmin;
  
  // Resolve cart owner for accurate cart count
  const { data: cartOwnerId } = useQuery({
    queryKey: ['cart-owner', effectiveUserId, effectiveRole, effectivePracticeId],
    queryFn: () => resolveCartOwnerUserId(effectiveUserId!, effectiveRole!, effectivePracticeId),
    enabled: !!effectiveUserId && !!effectiveRole,
    staleTime: 5 * 60 * 1000,
  });
  
  const { data: cartCount } = useCartCount(cartOwnerId);
  
  // Check RX ordering privileges
  const { canOrderRx, hasProviders, providerCount, providersWithNpiCount, isLoading: isLoadingRxPrivileges } = usePracticeRxPrivileges();

  // Use real-time hook for instant updates
  const { data: products, isLoading } = useRealtimeProducts();

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
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
      if (!product) return false;
      
      const matchesSearch =
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.dosage?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = productTypeFilter === "all" || 
        product.product_type_id === productTypeFilter;
      
      const matchesPrescription = 
        prescriptionFilter === "all" ||
        (prescriptionFilter === "yes" && product.requires_prescription === true) ||
        (prescriptionFilter === "no" && product.requires_prescription === false);
      
      // Filter out RX products if practice cannot order them (unless admin viewing)
      const canSeeProduct = viewingAsAdmin || !product?.requires_prescription || canOrderRx;
      
      return matchesSearch && matchesType && matchesPrescription && canSeeProduct;
    }), 
    [products, searchQuery, productTypeFilter, prescriptionFilter, canOrderRx, viewingAsAdmin]
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
      // First, resolve practice ID for correct pricing lookup
      let practiceIdForPricing = effectiveUserId;  // Default to logged-in user
      
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
        .eq("user_id", effectiveUserId)  // ✅ Check the logged-in user to detect staff role
        .single();

      if (userRoleData?.role === 'provider') {
        const practiceId = await getPracticeIdFromProviderUserId(providerId);  // ✅ Use providerId
        if (!practiceId) {
          toast.error("Unable to find practice association. Please contact support.");
          return;
        }
        resolvedDoctorId = practiceId;
        console.debug('[ProductsGrid] Provider detected - using practice context for orders', { 
          provider_user_id: providerId,  // ✅ Log correct provider ID
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

      // 🔍 DIAGNOSTIC LOG 1: After resolvedDoctorId calculation
      console.log('[ProductsGrid] 🔍 PRACTICE ORDER DIAGNOSTIC', {
        effectiveUserId,
        providerId,
        resolvedDoctorId,
        userRole: userRoleData?.role,
        shipToPractice,
        effectivePracticeId
      });

      if (shipToPractice) {
        console.debug('[ProductsGrid] Practice order - fetching practice shipping address', { effectiveUserId });
        
        // Get practice's shipping address with fallback to billing address
        const { data: practiceProfile } = await supabase
          .from("profiles")
          .select("shipping_address_formatted, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip, address_state")
          .eq("id", resolvedDoctorId)
          .single();

        // 🔍 DIAGNOSTIC LOG 2: After practice profile fetch
        console.log('[ProductsGrid] 🔍 PRACTICE PROFILE FETCH', {
          resolvedDoctorId,
          practiceProfileFound: !!practiceProfile,
          practiceProfile: practiceProfile ? {
            shipping_address_state: practiceProfile.shipping_address_state,
            shipping_address_street: practiceProfile.shipping_address_street,
            shipping_address_city: practiceProfile.shipping_address_city,
            shipping_address_zip: practiceProfile.shipping_address_zip,
            address_state: practiceProfile.address_state
          } : null
        });

        // Use shipping address state with fallback to billing address state
        const destinationState = practiceProfile?.shipping_address_state || practiceProfile?.address_state || '';
        
        // 🔍 DIAGNOSTIC LOG 3: Before state validation
        console.log('[ProductsGrid] 🔍 STATE VALIDATION CHECK', {
          destinationState,
          destinationStateType: typeof destinationState,
          destinationStateLength: destinationState.length,
          destinationStateCharCodes: destinationState ? 
            [...destinationState].map(c => `${c}:${c.charCodeAt(0)}`).join(', ') : [],
          isValidResult: isValidStateCode(destinationState),
          practiceProfileExists: !!practiceProfile,
          hasShippingState: !!practiceProfile?.shipping_address_state,
          hasBillingState: !!practiceProfile?.address_state,
          usingFallback: !practiceProfile?.shipping_address_state && !!practiceProfile?.address_state
        });

        if (!isValidStateCode(destinationState)) {
          toast.error(
            `Invalid or missing practice address${destinationState ? ` (got: "${destinationState}")` : ''}. Please update your practice profile with a valid shipping address (Settings → Profile → Shipping Address).`,
            { duration: 10000 }
          );
          return;
        }

        // Only look up provider ID if this is actually a provider account
        // Staff and practice owners don't have provider records
        const actualProviderId = isProviderAccount 
          ? await getProviderIdFromUserId(providerId)
          : null;
        
        console.debug('[ProductsGrid] Provider ID mapping', { providerId_userId: providerId, actualProviderId_providersId: actualProviderId });

        // Get user's topline rep ID for scoping - use resolvedDoctorId (practice_id) to get topline rep
        const userToplineRepId = await getUserToplineRepId(resolvedDoctorId);

        // 🔍 DIAGNOSTIC LOG 4: Before routing call
        console.log('[ProductsGrid] 🔍 ROUTING REQUEST', {
          product_id: productForCart.id,
          destination_state: destinationState,
          user_topline_rep_id: userToplineRepId,
          resolvedDoctorId
        });

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
          console.error('[ProductsGrid] Pharmacy routing failed', { 
            product: productForCart.name, 
            destinationState,
            destinationStateType: typeof destinationState,
            destinationStateLength: destinationState?.length,
            reason: routingResult?.reason 
          });
          toast.error(
            `Cannot add to cart: No pharmacy can fulfill "${productForCart.name}" for ${destinationState}. ${routingResult?.reason || 'Please verify the shipping address has a valid 2-letter state code (e.g., FL, CA, NY).'}`,
            { duration: 10000 }
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
        // PATIENT ORDER - fetch from patient_accounts table (patientId is patient_accounts.id from dialog)
        const { data: patientRecord, error: patientError } = await supabase
          .from("patient_accounts")
          .select("id, name, first_name, last_name, email, phone, address_street, address_city, address_state, address_zip, user_id, gender_at_birth")
          .eq("id", patientId!)
          .single();

        if (patientError || !patientRecord) {
          console.error("Failed to fetch patient:", patientError);
          toast.error("Unable to find patient information. Please refresh and try again.");
          return;
        }

        // Validate patient has required data
        if (!patientRecord.email) {
          toast.error("Patient email is required. Please update the patient record before adding to cart.");
          return;
        }

        // Use state from patients table
        const destinationState = patientRecord.address_state || '';

        // Build formatted address for display
        const patientAddress = patientRecord.address_street && patientRecord.address_city && patientRecord.address_state && patientRecord.address_zip
            ? `${patientRecord.address_street}, ${patientRecord.address_city}, ${patientRecord.address_state} ${patientRecord.address_zip}`
            : patientRecord.address_street || null;


        console.debug('[ProductsGrid] Patient shipping state resolved', { 
          destinationState, 
          patientId: patientRecord.id,
          hasAddressState: !!patientRecord.address_state
        });

        if (!isValidStateCode(destinationState)) {
          toast.error(
            `Invalid or missing patient shipping address${destinationState ? ` (got: "${destinationState}")` : ''}. Please update the patient's address with a valid 2-letter US state code.`,
            { duration: 8000 }
          );
          return;
        }

        // Only look up provider ID if this is actually a provider account
        // Staff and practice owners don't have provider records
        const actualProviderId = isProviderAccount 
          ? await getProviderIdFromUserId(providerId)
          : null;

        // Get user's topline rep ID for scoping - use resolvedDoctorId (practice_id) to get topline rep
        const userToplineRepId = await getUserToplineRepId(resolvedDoctorId);

        // Route to pharmacy - BLOCK if no pharmacy available
        console.log('[ProductsGrid] 🔍 Calling route-order-to-pharmacy with:', {
          product_id: productForCart.id,
          product_name: productForCart.name,
          destination_state: destinationState,
          user_topline_rep_id: userToplineRepId,
          patient_id: patientId,
          practice_id: resolvedDoctorId
        });

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

        console.log('[ProductsGrid] 📦 Routing result:', {
          pharmacy_id: routingResult?.pharmacy_id,
          reason: routingResult?.reason,
          error: routingError
        });

        if (routingError) {
          console.error("[ProductsGrid] ❌ Routing error details:", {
            error: routingError,
            message: routingError.message,
            status: routingError.status,
            productId: productForCart.id,
            productName: productForCart.name,
            state: destinationState,
            userToplineRepId
          });
          toast.error(`Unable to verify pharmacy availability: ${routingError.message || 'Unknown error'}`);
          return;
        }

        if (!routingResult?.pharmacy_id) {
          console.error('[ProductsGrid] ❌ Pharmacy routing failed (patient order)', { 
            product: productForCart.name, 
            destinationState, 
            reason: routingResult?.reason,
            fullResponse: routingResult
          });
          toast.error(
            `Unable to add to cart: No pharmacy available to fulfill "${productForCart.name}" for delivery to ${destinationState}. Reason: ${routingResult?.reason || 'Unknown error'}`,
            { duration: 10000 }
          );
          return;
        }

        // Success - pharmacy found, proceed with insertion
        console.log(`✅ [ProductsGrid] Pharmacy routed successfully:`, {
          pharmacy_id: routingResult.pharmacy_id,
          reason: routingResult.reason,
          product: productForCart.name,
          state: destinationState
        });

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
            gender_at_birth: patientRecord.gender_at_birth || null,
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
      
      // CRITICAL FIX: Use cartOwnerId for optimistic updates (not effectiveUserId)
      const resolvedCartOwnerId = cartOwnerId || effectiveUserId;
      
      // Optimistic update: increment count immediately
      queryClient.setQueryData(
        ["cart-count", resolvedCartOwnerId],
        (old: number | undefined) => (old || 0) + quantity
      );
      
      // Optimistic update: push item into cart cache for instant UI
      queryClient.setQueryData(["cart", resolvedCartOwnerId], (old: any) => {
        const patientName = shipToPractice ? 'Practice Order' : (patientId ? 'Patient Order' : 'Practice Order');
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
          return { id: cart.id, lines: [optimisticItem] };
        }
        if (old.items) {
          return { ...old, items: [...old.items, optimisticItem] };
        }
        if (old.lines) {
          return { ...old, lines: [...old.lines, optimisticItem] };
        }
        return { ...old, lines: [optimisticItem] };
      });
      
      // Immediately invalidate to force fresh fetch with correct data from DB
      await queryClient.invalidateQueries({ queryKey: ["cart-count", resolvedCartOwnerId] });
      await queryClient.invalidateQueries({ queryKey: ["cart", resolvedCartOwnerId] });
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error adding to cart", error);
      });
      toast.error(error.message || "Failed to add product to cart");
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1600px] space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="flex flex-1 gap-2 sm:gap-3 flex-col sm:flex-row w-full sm:w-auto">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 sm:pl-9 text-sm sm:text-base h-10"
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
              {productTypes?.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name} ({productCounts.byType[type.id] || 0})
                </SelectItem>
              ))}
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
        
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          {(isProvider || (isStaffAccount && canOrder)) && (
            <Button
              variant="outline"
              size="default"
              className="relative h-10 px-3 sm:px-4"
              onClick={() => setCartSheetOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Cart</span>
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
              size="default"
              className="h-10 px-3 sm:px-4"
              onClick={() => {
                setSelectedProduct(null);
                setIsEditing(false);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
          
          {(isProvider || isRep) && <Badge variant="secondary">Read Only</Badge>}
        </div>
      </div>

      {/* RX Ordering Restriction Alert */}
      {!viewingAsAdmin && isProvider && !canOrderRx && (
        <Alert className="bg-warning/10 border-warning">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            {providerCount === 0 ? (
              <>
                <strong>RX products are hidden.</strong> Your practice needs at least one provider with a valid NPI to order prescription products.{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-warning underline font-semibold"
                  onClick={() => navigate('/providers')}
                >
                  Add a provider with NPI
                </Button>
              </>
            ) : (
              <>
                <strong>RX products are hidden.</strong> Your practice has {providerCount} provider(s), but none have a valid NPI. Add an NPI to enable RX ordering.{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-warning underline font-semibold"
                  onClick={() => navigate('/providers')}
                >
                  Update provider NPIs
                </Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredProducts?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-2">No products found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
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
