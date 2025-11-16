import type { Json } from "@/integrations/supabase/types";

/** Safe serializer for JSONB columns */
export function toJsonSafe<T>(data: T): Json {
  return JSON.parse(JSON.stringify(data)) as Json;
}

/** Safe reader with fallback */
export function fromJsonSafe<T>(json: Json | null | undefined, fallback: T): T {
  if (json == null) return fallback;
  return json as T;
}
