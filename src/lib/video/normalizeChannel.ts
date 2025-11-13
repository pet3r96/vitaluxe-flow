/**
 * Normalizes Agora channel names to ensure consistency across the system.
 * Converts UUIDs to underscore format and enforces lowercase.
 * 
 * @param prefix - Channel type prefix ('appt' for scheduled, 'instant' for instant meetings)
 * @param id - The UUID or identifier to normalize
 * @returns Normalized channel name in format: vlx_{prefix}_{safe_id}
 */
export function normalizeChannel(prefix: 'appt' | 'instant', id: string): string {
  const safe = id.replace(/-/g, '_').toLowerCase();
  return `vlx_${prefix}_${safe}`;
}
