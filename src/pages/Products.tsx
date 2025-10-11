import { ProductsDataTable } from "@/components/products/ProductsDataTable";

const Products = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Product Management</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage products, pricing tiers, and inventory
        </p>
      </div>

      <ProductsDataTable />
    </div>
  );
};

export default Products;
