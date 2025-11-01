import { ProductsGrid } from "@/components/products/ProductsGrid";
import { ToplineProductVisibilityManager } from "@/components/products/ToplineProductVisibilityManager";
import { PharmacyProductsGrid } from "@/components/products/PharmacyProductsGrid";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const Products = () => {
  const { effectiveRole } = useAuth();
  const { canOrder, isLoading, isStaffAccount } = useStaffOrderingPrivileges();
  const isTopline = effectiveRole === "topline";
  const isPharmacy = effectiveRole === "pharmacy";
  
  // Only check staff privileges for actual staff role (not doctor/provider)
  const shouldCheckPrivileges = effectiveRole === 'staff';

  // Show loading skeleton while checking staff privileges
  if (shouldCheckPrivileges && isLoading && isStaffAccount) {
    return (
      <div className="patient-container">
        <div className="mb-8">
          <h1 className="text-left text-3xl sm:text-4xl font-bold gold-text-gradient">Product Management</h1>
          <p className="text-muted-foreground mt-2">
            Loading...
          </p>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Staff without ordering privileges cannot access products
  if (shouldCheckPrivileges && isStaffAccount && !canOrder) {
    return (
      <div className="patient-container">
        <div className="mb-8">
           <h1 className="text-left text-3xl sm:text-4xl font-bold gold-text-gradient">Product Management</h1>
          <p className="text-muted-foreground mt-2">
            Access restricted
          </p>
        </div>
        <Alert>
          <AlertDescription>
            You don't have permission to access products or place orders. Please contact your practice administrator to request ordering privileges.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isPharmacy) {
    return (
      <div className="patient-container">
        <div className="mb-8">
           <h1 className="text-left text-3xl sm:text-4xl font-bold gold-text-gradient">
            My Products
          </h1>
          <p className="text-muted-foreground mt-2">
            View products assigned to your pharmacy
          </p>
        </div>

        <PharmacyProductsGrid />
      </div>
    );
  }

  if (isTopline) {
    return (
      <div className="patient-container">
        <div className="mb-8">
           <h1 className="text-left text-3xl sm:text-4xl font-bold gold-text-gradient">
            Product Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage products and control visibility for your network
          </p>
        </div>

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
      </div>
    );
  }

  return (
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-left text-3xl sm:text-4xl font-bold gold-text-gradient">Product Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage products, pricing tiers, and inventory
        </p>
      </div>

      <ProductsGrid />
    </div>
  );
};

export default Products;
