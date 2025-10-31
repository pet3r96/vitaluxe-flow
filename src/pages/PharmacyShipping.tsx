import { PharmacyShippingManager } from "@/components/pharmacies/PharmacyShippingManager";

const PharmacyShipping = () => {
  return (
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">Shipping Management</h1>
        <p className="text-muted-foreground mt-2">
          Process orders, download prescriptions, and manage shipments
        </p>
      </div>
      
      <PharmacyShippingManager />
    </div>
  );
};

export default PharmacyShipping;
