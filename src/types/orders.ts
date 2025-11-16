import type { Database } from "@/integrations/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderLineRow = Database["public"]["Tables"]["order_lines"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export interface OrderLineWithProduct extends OrderLineRow {
  products?: ProductRow;
}

export interface OrderWithLines extends OrderRow {
  order_lines?: OrderLineWithProduct[];
  doctor?: {
    id: string;
    name: string;
    email?: string;
  };
  practice?: {
    id: string;
    name: string;
  };
}

export interface CartLine {
  id: string;
  cart_id: string;
  product_id: string;
  patient_name: string;
  quantity?: number | null;
  price_snapshot?: number | null;
  destination_state: string;
  products?: ProductRow;
}

export interface Cart {
  id: string;
  doctor_id: string;
  created_at: string | null;
  updated_at: string | null;
  cart_lines?: CartLine[];
}
