import { useState, useMemo } from "react";
import { logger } from "@/lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RepProductVis } from '@/integrations/supabase/table-helpers';
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProducts } from "@/hooks/useRealtimeProducts";
import { resolveCartOwnerUserId } from "@/lib/cartOwnerResolver";
import type { RepProductVisibilityRow } from "@/types/manual-schema";
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
import { Search, ShoppingCart, Plus, HelpCircle } from "lucide-react";
import { ProductDialog } from "./ProductDialog";
import { RequestMedicationDialog } from "./RequestMedicationDialog";
import { PatientSelectionDialog } from "./PatientSelectionDialog";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./ProductCardSkeleton";
import { CartSheet } from "./CartSheet";
import { usePagination } from "@/hooks/usePagination";
import { useCartCount } from "@/hooks/useCartCount";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { usePracticeRxPrivileges } from "@/hooks/usePracticeRxPrivileges";
import { usePracticeShippingAddress } from "@/hooks/usePracticeShippingAddress";
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
  const [sortOrder, setSortOrder] = useState<string>("a-z");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [productForCart, setProductForCart] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [requestMedDialogOpen, setRequestMedDialogOpen] = useState(false);

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
  
  // Resolve cart owner for accurate cart count - cached to prevent loops
  const { data: cartOwnerId } = useQuery({
    queryKey: ['cart-owner-id', effectiveUserId, effectiveRole, effectivePracticeId],
    queryFn: () => resolveCartOwnerUserId(effectiveUserId!, effectiveRole!, effectivePracticeId),
    enabled: !!effectiveUserId && !!effectiveRole,
    staleTime: 30000, // 30 second cache - prevents excessive resolver calls
    gcTime: 60000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  
  const { data: cartCount } = useCartCount(cartOwnerId);
  
  // Check RX ordering privileges
  const { canOrderRx, hasProviders, providerCount, providersWithNpiCount, isLoading: isLoadingRxPrivileges } = usePracticeRxPrivileges();

  // Auto-fetch practice shipping address for providers and staff who can order
  const { data: practiceAddress, isLoading: isLoadingAddress } = usePracticeShippingAddress(
    (isProvider || (isStaffAccount && canOrder)) ? effectivePracticeId : null
  );

  // Use real-time hook for instant updates
  const { data: products, isLoading } = useRealtimeProducts();

  // Fetch all variant stats at once for efficient display
  const { data: allVariantStats } = useQuery({
    queryKey: ['all-variant-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variant_stats')
        .select('*');
      if (error) {
        logger.error('Error fetching variant stats', error);
        return {};
      }
      
      // Convert to map: productId -> stats
      return (data || []).reduce((acc, stat) => {
        acc[stat.product_id] = stat;
        return acc;
      }, {} as Record<string, any>);
    },
    staleTime: 60000, // 1 minute cache
  });

  // Bulk fetch effective prices for all products at once to prevent N+1 queries
  const productIds = useMemo(() => products?.map(p => p?.id).filter(Boolean) || [], [products]);
  
  const { data: allEffectivePrices } = useQuery({
    queryKey: ['bulk-effective-prices', productIds, effectiveUserId],
    queryFn: async () => {
      if (!productIds.length || !effectiveUserId) return {};
      
      const { data, error } = await supabase.rpc('get_effective_prices_bulk', {
        p_product_ids: productIds,
        p_user_id: effectiveUserId
      });
      
      if (error) {
        logger.error('Error fetching bulk prices', error);
        return {};
      }
      
      // Convert to map: productId -> price data
      return (data || []).reduce((acc: Record<string, any>, price: any) => {
        acc[price.product_id] = price;
        return acc;
      }, {} as Record<string, any>);
    },
    enabled: !!productIds.length && !!effectiveUserId && (isToplineRep || isDownlineRep || isProvider),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
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
        logger.error('[ProductsGrid] Error fetching rep ID', repError);
        return {};
      }

      if (!repId) {
        logger.warn('[ProductsGrid] No rep ID found for user:', { effectiveUserId });
        return {};
      }

      logger.info('[ProductsGrid] Fetching visibility for rep ID:', { repId });
      
      const { data, error } = await RepProductVis()
        .select('product_id, visible')
        .eq('topline_rep_id', repId);
      
      if (error) {
        logger.error('[ProductsGrid] Error fetching visibility settings', error, { repId });
        return {};
      }

      logger.info('[ProductsGrid] Visibility settings loaded:', { count: data?.length });
      
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

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    const filtered = products.filter((product) => {
      // Critical: Filter out any null/undefined products
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
    });

    // Sort based on sortOrder
    return filtered.sort((a, b) => {
      const nameA = a?.name?.toLowerCase() || '';
      const nameB = b?.name?.toLowerCase() || '';
      if (sortOrder === 'a-z') {
        return nameA.localeCompare(nameB);
      } else if (sortOrder === 'z-a') {
        return nameB.localeCompare(nameA);
      }
      return 0;
    });
  }, [products, searchQuery, productTypeFilter, prescriptionFilter, canOrderRx, viewingAsAdmin, sortOrder]);

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
      // Critical null check to prevent crashes
      if (!product) return;
      
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
      logger.error("Error getting topline rep ID", error);
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
          logger.info('[ProductsGrid] Using variant price', { variantId, priceTier, correctPrice });
        }
      } else {
        // No variant - use product-level pricing
        if (priceTier === 'topline') {
          correctPrice = productForCart.topline_price || productForCart.base_price;
        } else {
          correctPrice = productForCart.retail_price || productForCart.base_price;
        }
      }

      // Fetch effective price with overrides for this user (only for non-variant)
      if (!variantId) {
        const { data: effectivePriceData } = await supabase.rpc('get_effective_product_price', {
          p_product_id: productForCart.id,
          p_user_id: effectiveUserId
        });

        const effectiveRetailPrice = effectivePriceData?.[0]?.effective_retail_price;
        
        // Use effective retail price (with overrides) or fallback to product defaults
        if (effectiveRetailPrice != null) {
          correctPrice = effectiveRetailPrice;
        }
      }

      // CRITICAL FIX: Use cartOwnerId for cart operations (resolved by cartOwnerResolver)
      // Staff/Practice users share practice cart, Providers use their own cart
      const cartOwnerForDb = cartOwnerId || effectiveUserId;
      
      if (!cartOwnerForDb) {
        toast.error("Unable to determine cart owner. Please contact support.");
        return;
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
        logger.info('[ProductsGrid] Provider detected - using practice context for orders', { 
          provider_user_id: providerId,
          practice_id: practiceId 
        });
      } else if (userRoleData?.role === 'staff' && effectivePracticeId) {
        // For staff, use the effectivePracticeId from context
        resolvedDoctorId = effectivePracticeId;
        logger.info('[ProductsGrid] Staff detected - using practice context for orders', { 
          staff_user_id: effectiveUserId, 
          practice_id: effectivePracticeId 
        });
      }

      // 🔍 DIAGNOSTIC LOG 1: After resolvedDoctorId calculation
      logger.info('[ProductsGrid] 🔍 PRACTICE ORDER DIAGNOSTIC', {
        effectiveUserId,
        providerId,
        resolvedDoctorId,
        isProviderAccount,
        isStaffAccount
      });

      if (shipToPractice) {
        logger.info('[ProductsGrid] Practice order - fetching practice shipping address', { effectiveUserId });
        
        // Get practice's shipping address with fallback to billing address
        const { data: practiceProfile } = await supabase
          .from("profiles")
          .select("shipping_address_formatted, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip, address_state")
          .eq("id", resolvedDoctorId)
          .single();

        // 🔍 DIAGNOSTIC LOG 2: After practice profile fetch
        logger.info('[ProductsGrid] 🔍 PRACTICE PROFILE FETCH', {
          resolvedDoctorId,
          practiceProfileFound: !!practiceProfile,
          hasShippingState: !!practiceProfile?.shipping_address_state,
          hasAddressState: !!practiceProfile?.address_state
        });

        // Use shipping address state with fallback to billing address state
        const destinationState = practiceProfile?.shipping_address_state || practiceProfile?.address_state || '';
        
        // 🔍 DIAGNOSTIC LOG 3: Before state validation
        logger.info('[ProductsGrid] 🔍 STATE VALIDATION CHECK', {
          destinationState,
          destinationStateType: typeof destinationState,
          destinationStateLength: destinationState.length,
          isValidState: /^[A-Z]{2}$/.test(destinationState)
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
        
        logger.info('[ProductsGrid] Provider ID mapping', { providerId_userId: providerId, actualProviderId_providersId: actualProviderId });

        // Get user's topline rep ID for scoping - use resolvedDoctorId (practice_id) to get topline rep
        const userToplineRepId = await getUserToplineRepId(resolvedDoctorId);

        // 🔍 DIAGNOSTIC LOG 4: Before routing call
        logger.info('[ProductsGrid] 🔍 ROUTING REQUEST', {
          product_id: productForCart.id,
          destination_state: destinationState,
          user_topline_rep_id: userToplineRepId,
          product_name: productForCart.name
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
          logger.error("Routing error", routingError);
          toast.error("Unable to verify pharmacy availability. Please try again.");
          return;
        }

        if (!routingResult?.pharmacy_id) {
          logger.error('[ProductsGrid] Pharmacy routing failed', null, { 
            product: productForCart.name, 
            destinationState,
            destinationStateType: typeof destinationState,
            reason: routingResult?.reason
          });
          toast.error(
            `Cannot add to cart: No pharmacy can fulfill "${productForCart.name}" for ${destinationState}. ${routingResult?.reason || 'Please verify the shipping address has a valid 2-letter state code (e.g., FL, CA, NY).'}`,
            { duration: 10000 }
          );
          return;
        }

        // Success - pharmacy found, proceed with insertion
        logger.info(`✅ Pharmacy routed: ${routingResult.reason}`);

        // Non-blocking cart addition for instant UI feedback
        supabase.functions.invoke('manage-cart', {
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
        }).then(({ error }) => {
          if (error) {
            logger.error('[ProductsGrid] Error adding to cart (practice order)', error);
            toast.error(error.message || "Failed to add product to cart");
            // Revert optimistic update
            const resolvedCartOwnerId = cartOwnerId || effectiveUserId;
            queryClient.invalidateQueries({ queryKey: ["cart", resolvedCartOwnerId] });
            queryClient.invalidateQueries({ queryKey: ["cart-count", resolvedCartOwnerId] });
          }
        });
      } else {
        // PATIENT ORDER - fetch from patient_accounts table (patientId is patient_accounts.id from dialog)
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

        // Build formatted address for display
        const patientAddress = patientRecord.address_street && patientRecord.address_city && patientRecord.address_state && patientRecord.address_zip
            ? [patientRecord.address_street, patientRecord.address_suite, patientRecord.address_city, `${patientRecord.address_state} ${patientRecord.address_zip}`].filter(Boolean).join(', ')
            : patientRecord.address_street || null;


        logger.info('[ProductsGrid] Patient shipping state resolved', { 
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
        logger.info('[ProductsGrid] 🔍 Calling route-order-to-pharmacy with:', {
          product_id: productForCart.id,
          product_name: productForCart.name,
          destination_state: destinationState,
          user_topline_rep_id: userToplineRepId
        });

        const { data: routingResult, error: routingError } = await supabase.functions.invoke('route-order-to-pharmacy', {
          body: {
            product_id: productForCart.id,
            destination_state: destinationState,
            user_topline_rep_id: userToplineRepId,
          }
        });

        logger.info('[ProductsGrid] 📦 Routing result:', {
          pharmacy_id: routingResult?.pharmacy_id,
          reason: routingResult?.reason,
          error: routingError
        });

        if (routingError) {
          logger.error("[ProductsGrid] ❌ Routing error details", routingError, {
            message: routingError.message,
            status: routingError.status,
            product: productForCart.name
          });
          toast.error("Unable to verify pharmacy availability. Please try again.");
          return;
        }

        if (!routingResult?.pharmacy_id) {
          logger.error('[ProductsGrid] ❌ Pharmacy routing failed (patient order)', null, { 
            product: productForCart.name, 
            destinationState, 
            reason: routingResult?.reason,
            routingResult: routingResult || {}
          });
          toast.error(
            `Cannot add to cart: No pharmacy available for "${productForCart.name}" in ${destinationState}. ${routingResult?.reason || 'Please verify address has valid 2-letter state code.'}`
          );
          return;
        }

        // Success - pharmacy found, proceed with insertion
        logger.info(`✅ [ProductsGrid] Pharmacy routed successfully:`, {
          pharmacy_id: routingResult.pharmacy_id,
          reason: routingResult.reason,
          product: productForCart.name,
          destinationState
        });

        // Validate patient address completeness - all 4 fields required
        const hasCompleteAddress = !!(
          patientRecord.address_street && 
          patientRecord.address_city && 
          patientRecord.address_state && 
          patientRecord.address_zip
        );

        // CRITICAL FIX: Use resolvedCartOwnerId for optimistic updates (not effectiveUserId)
        const resolvedCartOwnerId = cartOwnerId || effectiveUserId;
        
        // Non-blocking cart addition for instant UI feedback
        supabase.functions.invoke('manage-cart', {
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
            genderAtBirth: patientRecord.gender_at_birth || null,
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
        }).then(({ error }) => {
          if (error) {
            logger.error('[ProductsGrid] Error adding to cart (patient order)', error);
            toast.error(error.message || "Failed to add product to cart");
            // Revert optimistic update
            queryClient.invalidateQueries({ queryKey: ["cart", resolvedCartOwnerId] });
            queryClient.invalidateQueries({ queryKey: ["cart-count", resolvedCartOwnerId] });
          }
        });
      }

      // Show immediate success toast (optimistic)
      toast.success("Product added to cart");
      
      // Immediately trigger optimistic update for UI
      const resolvedCartOwnerId = cartOwnerId || effectiveUserId;
      
      logger.info('[ProductsGrid] 🔍 Invalidating cart queries with:', { 
        resolvedCartOwnerId, 
        effectiveUserId,
        cartOwnerId
      });

      queryClient.invalidateQueries({ queryKey: ["cart", resolvedCartOwnerId] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", resolvedCartOwnerId] });
    } catch (error: any) {
      logger.error('[ProductsGrid] Error adding product to cart', error);
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

          <Select
            value={sortOrder}
            onValueChange={setSortOrder}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a-z">A → Z</SelectItem>
              <SelectItem value="z-a">Z → A</SelectItem>
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

          {(isProvider || (isStaffAccount && staffCanOrder)) && (
            <Button
              variant="outline"
              size="default"
              className="h-10 px-3 sm:px-4"
              onClick={() => setRequestMedDialogOpen(true)}
            >
              <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Don't see a product?</span>
              <span className="sm:hidden">Request</span>
            </Button>
          )}
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

      {/* Practice Shipping Address Missing Alert */}
      {!viewingAsAdmin && (isProvider || (isStaffAccount && canOrder)) && !isLoadingAddress && (!practiceAddress || !practiceAddress.shipping_address_state) && (
        <Alert className="bg-destructive/10 border-destructive">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-sm">
            <strong>Missing Practice Shipping Address.</strong> Please update your practice profile with a valid shipping address to enable ordering.{' '}
            <Button
              variant="link"
              className="h-auto p-0 text-destructive underline font-semibold"
              onClick={() => navigate('/profile')}
            >
              Update Shipping Address
            </Button>
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
            {paginatedProducts?.filter(p => p != null).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variantStats={allVariantStats?.[product.id] || null}
                effectivePrice={allEffectivePrices?.[product.id] || null}
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

      {/* Request Medication Dialog */}
      <RequestMedicationDialog open={requestMedDialogOpen} onOpenChange={setRequestMedDialogOpen} />
    </div>
  );
};
