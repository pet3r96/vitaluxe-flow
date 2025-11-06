import { parse, isValid, format } from "date-fns";

export type SearchType = 'name' | 'id' | 'date' | 'phone' | 'general';

export interface ParsedQuery {
  type: SearchType;
  value: string;
  parsedDate?: Date;
}

/**
 * Parse natural language dates like "today", "tomorrow", "11/06", "Nov 6"
 */
export function parseNaturalDate(input: string): Date | null {
  const normalized = input.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Handle relative dates
  if (normalized === 'today') return today;
  
  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  if (normalized === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Handle day names (next monday, etc.)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = normalized.match(/(?:next\s+)?(\w+)/);
  if (dayMatch) {
    const dayIndex = dayNames.findIndex(day => day.startsWith(dayMatch[1]));
    if (dayIndex !== -1) {
      const targetDate = new Date(today);
      const currentDay = targetDate.getDay();
      let daysToAdd = dayIndex - currentDay;
      if (daysToAdd <= 0 || normalized.includes('next')) {
        daysToAdd += 7;
      }
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      return targetDate;
    }
  }

  // Try parsing various date formats
  const formats = [
    'MM/dd/yyyy',
    'MM/dd/yy',
    'MM/dd',
    'M/d',
    'MMM d',
    'MMM dd',
    'MMMM d',
    'yyyy-MM-dd'
  ];

  for (const formatString of formats) {
    try {
      const parsed = parse(input, formatString, today);
      if (isValid(parsed)) {
        // If year not specified, assume current year
        if (!input.match(/\d{4}/)) {
          parsed.setFullYear(today.getFullYear());
        }
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Parse search query and determine search type
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  
  // Check if it's a UUID (appointment ID)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(trimmed)) {
    return { type: 'id', value: trimmed };
  }

  // Check if it starts with digits (could be appointment ID or phone)
  if (/^\d+/.test(trimmed)) {
    // If it has phone-like patterns, treat as phone
    if (/[\d\-\(\)\s]{7,}/.test(trimmed)) {
      return { type: 'phone', value: trimmed.replace(/\D/g, '') };
    }
    return { type: 'id', value: trimmed };
  }

  // Try to parse as date
  const parsedDate = parseNaturalDate(trimmed);
  if (parsedDate) {
    return { type: 'date', value: trimmed, parsedDate };
  }

  // Default to name search
  return { type: 'name', value: trimmed };
}

/**
 * Calculate relevance score for search results
 */
function calculateScore(appointment: any, query: string, searchType: SearchType): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  if (searchType === 'name') {
    const firstName = appointment.patient_accounts?.first_name?.toLowerCase() || '';
    const lastName = appointment.patient_accounts?.last_name?.toLowerCase() || '';
    const fullName = `${firstName} ${lastName}`;

    // Exact match gets highest score
    if (fullName === lowerQuery) score += 100;
    else if (firstName === lowerQuery || lastName === lowerQuery) score += 80;
    // Starts with gets medium score
    else if (fullName.startsWith(lowerQuery)) score += 60;
    else if (firstName.startsWith(lowerQuery) || lastName.startsWith(lowerQuery)) score += 50;
    // Contains gets lower score
    else if (fullName.includes(lowerQuery)) score += 30;
    else if (firstName.includes(lowerQuery) || lastName.includes(lowerQuery)) score += 20;
  } else if (searchType === 'id') {
    if (appointment.id.toLowerCase().includes(lowerQuery)) score += 100;
  } else if (searchType === 'phone') {
    const phone = appointment.patient_accounts?.phone?.replace(/\D/g, '') || '';
    if (phone.includes(query)) score += 100;
  } else if (searchType === 'date') {
    score += 50; // Date matches are already filtered
  }

  // Boost recent appointments
  const appointmentDate = new Date(appointment.start_time);
  const daysDiff = Math.abs((new Date().getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 1) score += 20;
  else if (daysDiff < 7) score += 10;
  else if (daysDiff < 30) score += 5;

  // Boost upcoming appointments over past ones
  if (appointmentDate > new Date()) score += 15;

  // Boost pending/scheduled appointments
  if (appointment.status === 'pending' || appointment.status === 'scheduled') score += 10;

  return score;
}

/**
 * Filter appointments based on search query
 */
export function filterAppointments(
  appointments: any[],
  query: string,
  options: {
    maxResults?: number;
    dateRange?: { start: Date; end: Date };
  } = {}
): any[] {
  if (!query.trim()) return [];

  const { maxResults = 10, dateRange } = options;
  const parsed = parseSearchQuery(query);
  const lowerQuery = query.toLowerCase();

  let filtered = appointments.filter((apt) => {
    // Apply date range filter if specified
    if (dateRange) {
      const aptDate = new Date(apt.start_time);
      if (aptDate < dateRange.start || aptDate > dateRange.end) return false;
    }

    // Filter based on search type
    switch (parsed.type) {
      case 'name':
        const firstName = apt.patient_accounts?.first_name?.toLowerCase() || '';
        const lastName = apt.patient_accounts?.last_name?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        return fullName.includes(lowerQuery) || 
               firstName.includes(lowerQuery) || 
               lastName.includes(lowerQuery);

      case 'id':
        return apt.id.toLowerCase().includes(lowerQuery);

      case 'phone':
        const phone = apt.patient_accounts?.phone?.replace(/\D/g, '') || '';
        return phone.includes(parsed.value);

      case 'date':
        if (!parsed.parsedDate) return false;
        const aptDate = new Date(apt.start_time);
        return aptDate.toDateString() === parsed.parsedDate.toDateString();

      default:
        return false;
    }
  });

  // Calculate scores and sort by relevance
  const scored = filtered.map((apt) => ({
    appointment: apt,
    score: calculateScore(apt, parsed.value, parsed.type)
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map(item => item.appointment);
}

/**
 * Highlight matching text in search results
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
}

/**
 * Save recent search to localStorage
 */
export function saveRecentSearch(query: string) {
  if (!query.trim()) return;
  
  try {
    const recent = getRecentSearches();
    const updated = [query, ...recent.filter(q => q !== query)].slice(0, 5);
    localStorage.setItem('appointment-search-recent', JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent search:', error);
  }
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem('appointment-search-recent');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get recent searches:', error);
    return [];
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches() {
  try {
    localStorage.removeItem('appointment-search-recent');
  } catch (error) {
    console.error('Failed to clear recent searches:', error);
  }
}