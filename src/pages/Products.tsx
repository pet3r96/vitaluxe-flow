import { ProductsGrid } from "@/components/products/ProductsGrid";
import { ToplineProductVisibilityManager } from "@/components/products/ToplineProductVisibilityManager";
import { PharmacyProductsGrid } from "@/components/products/PharmacyProductsGrid";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Products = () => {
  const { effectiveRole } = useAuth();
  const isTopline = effectiveRole === "topline";
  const isPharmacy = effectiveRole === "pharmacy";

  if (isPharmacy) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            My Products
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            View products assigned to your pharmacy
          </p>
        </div>

        <PharmacyProductsGrid />
      </div>
    );
  }

  if (isTopline) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            Product Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Product Management</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage products, pricing tiers, and inventory
        </p>
      </div>

      <ProductsGrid />
    </div>
  );
};

export default Products;
