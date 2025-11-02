import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Eye, UserPlus } from "lucide-react";
import { AddProviderDialog } from "./AddProviderDialog";
import { ProviderDetailsDialog } from "./ProviderDetailsDialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { sanitizeEncrypted } from "@/lib/utils";

export const ProvidersDataTable = () => {
  const { effectiveUserId, effectiveRole, effectivePracticeId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Check if user can view credentials
  const canViewCredentials = effectiveRole && ['admin', 'doctor', 'provider', 'pharmacy'].includes(effectiveRole);

  const { data: providers, isLoading, refetch } = useQuery({
    queryKey: ["providers", effectiveUserId, effectiveRole, effectivePracticeId],
    staleTime: 300000, // 5 minutes - providers change occasionally
    queryFn: async () => {
      console.log('[ProvidersDataTable] Fetching providers via edge function', {
        effectiveUserId,
        effectiveRole,
        effectivePracticeId
      });
      
      // Use edge function to get providers with full profile data
      const { data, error } = await supabase.functions.invoke('list-providers', {
        body: effectivePracticeId ? { practice_id: effectivePracticeId } : {}
      });

      if (error) {
        console.error('[ProvidersDataTable] Error from edge function:', error);
        throw error;
      }

      const providersList = data?.providers || [];
      console.log('[ProvidersDataTable] Received providers:', {
        count: providersList.length,
        sample: providersList[0] ? {
          id: providersList[0].id,
          hasProfile: !!providersList[0].profiles,
          fullName: providersList[0].profiles?.full_name,
          name: providersList[0].profiles?.name,
          email: providersList[0].profiles?.email
        } : null
      });
      
      // Log any missing data
      providersList.forEach((p: any, idx: number) => {
        if (!p.profiles?.full_name && !p.profiles?.name && !p.profiles?.email) {
          console.warn('[ProvidersDataTable] ⚠️ Provider missing display fields:', {
            index: idx,
            providerId: p.id,
            userId: p.user_id,
            profileData: p.profiles
          });
        }
      });

      return providersList;
    },
    enabled: !!(effectiveUserId || effectivePracticeId)
  });

  // No longer need decryption - credentials stored in profiles table

  const toggleStatus = async (providerId: string, currentStatus: boolean) => {
    const { data, error } = await supabase.functions.invoke('manage-provider-status', {
      body: { providerId, active: !currentStatus }
    });

    const serverMessage = (error as any)?.message || (typeof data === 'object' && (data as any)?.error);
    if (error || serverMessage) {
      toast.error(serverMessage || 'Failed to update provider status');
      return;
    }

    toast.success(currentStatus ? 'Provider deactivated' : 'Provider activated');
    refetch();
  };

  const filteredProviders = providers?.filter((provider) =>
    provider.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.practice?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredProviders?.length || 0,
    itemsPerPage: 25
  });

  const paginatedProviders = filteredProviders?.slice(startIndex, endIndex);

  // No longer need credential access logging - encryption removed

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading providers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1200px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Practice</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProviders && filteredProviders.length > 0 ? (
              paginatedProviders?.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.profiles?.name || provider.profiles?.full_name || provider.profiles?.email || 'Unknown Provider'}</TableCell>
                  <TableCell>{provider.practice?.name || provider.practice?.company}</TableCell>
                  <TableCell>{provider.profiles?.email || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={provider.active ? "default" : "secondary"}>
                      {provider.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={provider.active}
                        onCheckedChange={() => toggleStatus(provider.id, provider.active)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No providers found. Add your first provider to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredProviders && filteredProviders.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredProviders.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredProviders.length)}
        />
      )}

      <AddProviderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refetch}
      />

      {selectedProvider && (
        <ProviderDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          provider={selectedProvider}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};
