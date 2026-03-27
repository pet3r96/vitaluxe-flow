import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProCartItem {
  id: string;
  user_id: string;
  practice_id: string | null;
  pro_product_id: string;
  quantity: number;
  created_at: string;
  pro_products: {
    id: string;
    name: string;
    price: number;
    active: boolean;
  };
}

export function useProCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pro-cart", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_cart_items")
        .select("*, pro_products(id, name, price, active)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as ProCartItem[];
    },
  });
}

export function useProCartCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pro-cart-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pro_cart_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useAddToProCart() {
  const qc = useQueryClient();
  const { user, effectivePracticeId } = useAuth();

  return useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if item already in cart
      const { data: existing } = await supabase
        .from("pro_cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("pro_product_id", productId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("pro_cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pro_cart_items").insert({
          user_id: user.id,
          practice_id: effectivePracticeId || null,
          pro_product_id: productId,
          quantity,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-cart"] });
      qc.invalidateQueries({ queryKey: ["pro-cart-count"] });
      toast.success("Added to cart");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity < 1) {
        const { error } = await supabase.from("pro_cart_items").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pro_cart_items")
          .update({ quantity })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-cart"] });
      qc.invalidateQueries({ queryKey: ["pro-cart-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveProCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pro_cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-cart"] });
      qc.invalidateQueries({ queryKey: ["pro-cart-count"] });
      toast.success("Removed from cart");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useClearProCart() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("pro_cart_items")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-cart"] });
      qc.invalidateQueries({ queryKey: ["pro-cart-count"] });
    },
  });
}
