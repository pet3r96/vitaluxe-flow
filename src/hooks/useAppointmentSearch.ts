import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import { filterAppointments, saveRecentSearch } from '@/lib/appointmentSearch';
import type { Appointment } from '@/types/domain/hooks';

// Base appointment interface with required fields for search
interface SearchableAppointment {
  id: string;
  start_time: string;
  status: string;
  provider_id: string;
  patient_accounts?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

export interface UseAppointmentSearchOptions<T extends SearchableAppointment = Appointment> {
  appointments: T[];
  maxResults?: number;
  debounceMs?: number;
}

export function useAppointmentSearch<T extends SearchableAppointment = Appointment>({
  appointments,
  maxResults = 10,
  debounceMs = 300
}: UseAppointmentSearchOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<{ start: Date; end: Date } | undefined>();
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const debouncedQuery = useDebounce(searchQuery, debounceMs);

  // Filter appointments based on advanced filters
  const filteredByAdvancedFilters = useMemo(() => {
    let filtered = appointments;

    // Apply provider filter
    if (providerFilter.length > 0) {
      filtered = filtered.filter(apt => 
        providerFilter.includes(apt.provider_id)
      );
    }

    // Apply status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(apt => 
        statusFilter.includes(apt.status)
      );
    }

    return filtered;
  }, [appointments, providerFilter, statusFilter]);

  // Perform search with filters
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];

    // JUSTIFIED: filterAppointments uses base type but works with extended types via structural typing
    return filterAppointments(filteredByAdvancedFilters as any, debouncedQuery, {
      maxResults,
      dateRange: dateFilter
    }) as any as T[];
  }, [debouncedQuery, filteredByAdvancedFilters, maxResults, dateFilter]);

  // Check if search is active
  const isSearching = searchQuery.trim().length > 0;

  // Handle search submission (for recent searches)
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
    }
  }, [searchQuery]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setDateFilter(undefined);
    setProviderFilter([]);
    setStatusFilter([]);
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    dateFilter,
    setDateFilter,
    providerFilter,
    setProviderFilter,
    statusFilter,
    setStatusFilter,
    clearFilters,
    clearSearch,
    handleSearchSubmit
  };
}