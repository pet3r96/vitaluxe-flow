import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RefillableOrder {
  id: string;
  order_id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  prescription_url: string;
  custom_sig: string | null;
  custom_dosage: string | null;
  refills_allowed: boolean;
  refills_total: number;
  refills_remaining: number;
  status: string;
  order_created_at: string;
  months_old: number;
  is_eligible: boolean;
  is_expiring_soon: boolean;
}

export function useRefillableOrders(searchTerm?: string, filterType?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["refillable-orders", user?.id, searchTerm, filterType],
    queryFn: async () => {
      if (!user) return [];

      // Build the query
      let query = supabase
        .from("order_lines")
        .select(`
          id,
          order_id,
          product_id,
          patient_id,
          patient_name,
          patient_phone,
          prescription_url,
          custom_sig,
          custom_dosage,
          refills_allowed,
          refills_total,
          refills_remaining,
          status,
          orders!inner (
            id,
            created_at,
            doctor_id,
            status
          ),
          products!inner (
            name
          )
        `)
        .not("prescription_url", "is", null)
        .gt("refills_total", 0)
        .in("status", ["filled", "shipped", "delivered"]);

      // Filter by practice (doctor_id matches current user)
      query = query.eq("orders.doctor_id", user.id);

      const { data, error } = await query;

      if (error) throw error;

      // Process and enrich the data
      const enrichedData: RefillableOrder[] = (data || []).map((line: any) => {
        const orderCreatedAt = new Date(line.orders.created_at);
        const now = new Date();
        const monthsOld = Math.floor(
          (now.getTime() - orderCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        const isEligible =
          line.refills_remaining > 0 &&
          monthsOld < 6 &&
          ["filled", "shipped", "delivered"].includes(line.status);

        const isExpiringSoon = monthsOld >= 4 && monthsOld < 6 && line.refills_remaining > 0;

        return {
          id: line.id,
          order_id: line.order_id,
          order_number: line.order_id.slice(0, 8).toUpperCase(),
          product_id: line.product_id,
          product_name: line.products.name,
          patient_id: line.patient_id,
          patient_name: line.patient_name,
          patient_phone: line.patient_phone,
          prescription_url: line.prescription_url,
          custom_sig: line.custom_sig,
          custom_dosage: line.custom_dosage,
          refills_allowed: line.refills_allowed,
          refills_total: line.refills_total,
          refills_remaining: line.refills_remaining,
          status: line.status,
          order_created_at: line.orders.created_at,
          months_old: monthsOld,
          is_eligible: isEligible,
          is_expiring_soon: isExpiringSoon,
        };
      });

      // Apply search filter
      let filtered = enrichedData;
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (order) =>
            order.order_number.toLowerCase().includes(term) ||
            order.patient_name.toLowerCase().includes(term) ||
            order.product_name.toLowerCase().includes(term)
        );
      }

      // Apply filter type
      if (filterType) {
        switch (filterType) {
          case "eligible":
            filtered = filtered.filter((order) => order.is_eligible);
            break;
          case "expiring":
            filtered = filtered.filter((order) => order.is_expiring_soon);
            break;
          case "recent":
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filtered = filtered.filter(
              (order) => new Date(order.order_created_at) >= thirtyDaysAgo
            );
            break;
        }
      }

      // Sort: eligible first, then by date (newest first)
      filtered.sort((a, b) => {
        if (a.is_eligible !== b.is_eligible) {
          return a.is_eligible ? -1 : 1;
        }
        return new Date(b.order_created_at).getTime() - new Date(a.order_created_at).getTime();
      });

      return filtered;
    },
    enabled: !!user,
  });
}
