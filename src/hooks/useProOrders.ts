import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProOrderLineItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface ProOrder {
  id: string;
  user_id: string;
  practice_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  ship_to_address: Record<string, string> | null;
  line_items: ProOrderLineItem[];
  subtotal: number;
  shipping: number;
  total: number;
  notes: string | null;
  created_at: string;
}

export function useProOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pro-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProOrder[];
    },
  });
}

export function useCreateProOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: Omit<ProOrder, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("pro_orders")
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-orders"] });
      toast.success("Professional order submitted successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
