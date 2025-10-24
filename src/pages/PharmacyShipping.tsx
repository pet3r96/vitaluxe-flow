import { PharmacyShippingManager } from "@/components/pharmacies/PharmacyShippingManager";

const PharmacyShipping = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Shipping Management</h1>
        <p className="text-muted-foreground mt-2">
          Process orders, download prescriptions, and manage shipments
        </p>
      </div>
      
      <PharmacyShippingManager />
    </div>
  );
};

export default PharmacyShipping;
