import { ProductsGrid } from "@/components/products/ProductsGrid";
import { ToplineProductVisibilityManager } from "@/components/products/ToplineProductVisibilityManager";
import { PharmacyProductsGrid } from "@/components/products/PharmacyProductsGrid";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useEffect, useRef } from "react";
import { measurePageLoad } from "@/lib/performanceMonitor";

const Products = () => {
  const perf = useRef(measurePageLoad('Products')).current;
  const { effectiveRole, effectiveUserId } = useAuth();
  const { canOrder, isLoading, isStaffAccount } = useStaffOrderingPrivileges();
  const isTopline = effectiveRole === "topline";
  const isPharmacy = effectiveRole === "pharmacy";
  
  // Only check staff privileges for actual staff role (not doctor/provider)
  const shouldCheckPrivileges = effectiveRole === 'staff';

  useEffect(() => {
    return () => {
      perf.end();
    };
  }, [perf]);

  // Show loading skeleton while checking staff privileges
  if (shouldCheckPrivileges && isLoading && isStaffAccount) {
    return (
      <ResponsivePage
        title="Product Management"
        subtitle="Loading..."
      >
        <TableSkeleton />
      </ResponsivePage>
    );
  }

  // Staff without ordering privileges cannot access products
  if (shouldCheckPrivileges && isStaffAccount && !canOrder) {
    return (
      <ResponsivePage
        title="Product Management"
        subtitle="Access restricted"
      >
        <Alert>
          <AlertDescription>
            You don't have permission to access products or place orders. Please contact your practice administrator to request ordering privileges.
          </AlertDescription>
        </Alert>
      </ResponsivePage>
    );
  }

  if (isPharmacy) {
    return (
      <ResponsivePage
        title="My Products"
        subtitle="View products assigned to your pharmacy"
      >
        <PharmacyProductsGrid />
      </ResponsivePage>
    );
  }

  if (isTopline) {
    return (
      <ResponsivePage
        title="Product Management"
        subtitle="Manage products and control visibility for your network"
      >
        <Tabs defaultValue="products" className="w-full">
          <TabsList>
            <TabsTrigger value="products">Product Catalog</TabsTrigger>
            <TabsTrigger value="visibility">Visibility Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="space-y-6">
            <ProductsGrid />
          </TabsContent>
          <TabsContent value="visibility" className="space-y-6">
            <ToplineProductVisibilityManager />
          </TabsContent>
        </Tabs>
      </ResponsivePage>
    );
  }

  return (
    <ResponsivePage
      title="Product Management"
      subtitle="Manage products, pricing tiers, and inventory"
    >
      <ProductsGrid />
    </ResponsivePage>
  );
};

export default Products;
