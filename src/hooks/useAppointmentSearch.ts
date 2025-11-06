import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import { filterAppointments, saveRecentSearch } from '@/lib/appointmentSearch';

export interface UseAppointmentSearchOptions {
  appointments: any[];
  maxResults?: number;
  debounceMs?: number;
}

export function useAppointmentSearch({
  appointments,
  maxResults = 10,
  debounceMs = 300
}: UseAppointmentSearchOptions) {
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

    return filterAppointments(filteredByAdvancedFilters, debouncedQuery, {
      maxResults,
      dateRange: dateFilter
    });
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