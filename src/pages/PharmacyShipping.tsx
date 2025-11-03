import { PharmacyShippingManager } from "@/components/pharmacies/PharmacyShippingManager";

const PharmacyShipping = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-left text-2xl sm:text-3xl lg:text-4xl font-bold gold-text-gradient">Shipping Management</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Process orders, download prescriptions, and manage shipments
        </p>
      </div>
      
      <PharmacyShippingManager />
    </div>
  );
};

export default PharmacyShipping;
