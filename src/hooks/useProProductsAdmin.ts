import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
  active: boolean;
  sort_order: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProProductFormData {
  name: string;
  price: number;
  description?: string;
  active?: boolean;
  sort_order?: number;
}

export function useProProducts() {
  return useQuery({
    queryKey: ["pro-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_products")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as ProProduct[];
    },
  });
}

export function useActiveProProducts() {
  return useQuery({
    queryKey: ["pro-products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_products")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as ProProduct[];
    },
  });
}

export function useCreateProProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: ProProductFormData) => {
      const { data, error } = await supabase
        .from("pro_products")
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-products"] });
      toast.success("Product created");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ProProductFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("pro_products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-products"] });
      toast.success("Product updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pro_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-products"] });
      toast.success("Product deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
