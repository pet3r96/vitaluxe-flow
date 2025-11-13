export function normalizeChannel(raw: string): string {
  if (!raw) return "vlx_invalid";

  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "_");

  if (cleaned.startsWith("vlx_")) return cleaned;

  return `vlx_${cleaned}`;
}
