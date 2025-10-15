import { useState } from "react";
import { useRefillableOrders } from "@/hooks/useRefillableOrders";
import { RefillSearchBar } from "@/components/refills/RefillSearchBar";
import { RefillFilters } from "@/components/refills/RefillFilters";
import { RefillStats } from "@/components/refills/RefillStats";
import { RefillCard } from "@/components/refills/RefillCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Pill } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const RefillCenter = () => {
  const { effectiveRole, isProviderAccount } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: orders, isLoading, refetch } = useRefillableOrders(
    searchTerm,
    activeFilter === "all" ? undefined : activeFilter
  );

  // Access control
  if (effectiveRole !== "doctor" && effectiveRole !== "provider") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Refill Center</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage prescription refills efficiently
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {orders && orders.length > 0 && <RefillStats orders={orders} />}

          <div className="flex flex-col sm:flex-row gap-4">
            <RefillSearchBar value={searchTerm} onChange={setSearchTerm} />
            <RefillFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          </div>

          {!orders || orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Pill className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Refillable Prescriptions</h3>
              <p className="text-muted-foreground max-w-md">
                {searchTerm || activeFilter !== "all"
                  ? "No prescriptions found matching your search criteria."
                  : "You don't have any prescriptions with refills available yet. Orders with refills will appear here."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <RefillCard key={order.id} order={order} onRefillComplete={() => refetch()} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RefillCenter;
