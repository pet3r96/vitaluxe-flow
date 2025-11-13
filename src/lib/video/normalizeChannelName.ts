/**
 * Normalizes any channel name string by replacing hyphens with underscores
 * and converting to lowercase. Use this for channel names fetched from the database.
 * 
 * @param channelName - The channel name to normalize
 * @returns Normalized channel name with underscores and lowercase
 */
export function normalizeChannelName(channelName: string): string {
  return channelName.replace(/-/g, '_').toLowerCase();
}
