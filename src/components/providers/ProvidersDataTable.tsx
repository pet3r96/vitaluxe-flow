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
import { logCredentialAccess } from "@/lib/auditLogger";

export const ProvidersDataTable = () => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Check if user can view credentials
  const canViewCredentials = effectiveRole && ['admin', 'doctor', 'provider', 'pharmacy'].includes(effectiveRole);

  const { data: providers, isLoading, refetch } = useQuery({
    queryKey: ["providers", effectiveUserId, effectiveRole],
    staleTime: 0,
    queryFn: async () => {
      // Step 1: Fetch all providers for this practice
      let providersQuery = supabase
        .from("providers")
        .select("*")
        .order("created_at", { ascending: false });
      
      // If doctor role, only show their own providers
      if (effectiveRole === "doctor") {
        providersQuery = providersQuery.eq("practice_id", effectiveUserId);
      }
      
      const { data: providersData, error: providersError } = await providersQuery;
      if (providersError) throw providersError;

      if (!providersData || providersData.length === 0) {
        return [];
      }

      // Step 2: Fetch all user profiles for these providers
      const userIds = providersData.map(p => p.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Step 3: Fetch practice information
      const practiceIds = [...new Set(providersData.map(p => p.practice_id))];
      const { data: practicesData, error: practicesError } = await supabase
        .from("profiles")
        .select("id, name, company, email")
        .in("id", practiceIds);

      if (practicesError) throw practicesError;

      // Step 4: Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const practicesMap = new Map(practicesData?.map(p => [p.id, p]) || []);

      // Step 5: Merge the data
      const enrichedProviders = providersData.map(provider => ({
        ...provider,
        profiles: profilesMap.get(provider.user_id) || null,
        practice: practicesMap.get(provider.practice_id) || null,
      }));

      return enrichedProviders;
    },
    enabled: !!effectiveUserId
  });

  // Fetch decrypted credentials for authorized users (parallel for performance)
  const { data: decryptedCredentials, isLoading: isDecrypting } = useQuery({
    queryKey: ["decrypted-provider-credentials", providers?.map(p => p.id)],
    enabled: !!providers && providers.length > 0 && canViewCredentials,
    queryFn: async () => {
      if (!providers || !canViewCredentials) return new Map();
      
      const credMap = new Map();
      
      // Fetch all decryptions in parallel for better performance
      const decryptionPromises = providers.map(async (provider) => {
        try {
          const { data, error } = await supabase.rpc('get_decrypted_provider_credentials', {
            p_provider_id: provider.id
          });
          
          if (!error && data && data.length > 0) {
            return { providerId: provider.id, credentials: data[0] };
          }
        } catch (error) {
          console.error(`Error decrypting credentials for provider ${provider.id}:`, error);
        }
        return null;
      });

      const results = await Promise.all(decryptionPromises);
      
      results.forEach(result => {
        if (result) {
          credMap.set(result.providerId, result.credentials);
        }
      });
      
      return credMap;
    }
  });

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
    provider.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  // Log credential access when providers with decrypted credentials are displayed
  useEffect(() => {
    if (paginatedProviders && paginatedProviders.length > 0 && canViewCredentials && decryptedCredentials) {
      paginatedProviders.forEach(provider => {
        const creds = decryptedCredentials.get(provider.id);
        if (creds && (creds.npi || creds.dea || creds.license_number)) {
          const isPracticeView = effectiveRole === "doctor" && effectiveUserId === provider.practice_id;
          const isOwnProvider = effectiveUserId === provider.user_id;
          
          logCredentialAccess({
            profileId: provider.user_id,
            profileName: provider.profiles?.full_name || provider.profiles?.name || 'Unknown',
            accessedFields: {
              npi: !!creds.npi,
              dea: !!creds.dea,
              license: !!creds.license_number,
            },
            viewerRole: effectiveRole || 'unknown',
            relationship: isOwnProvider ? 'self' : isPracticeView ? 'practice_admin' : 'admin',
            componentContext: 'ProvidersDataTable'
          });
        }
      });
    }
  }, [paginatedProviders, effectiveRole, effectiveUserId, canViewCredentials, decryptedCredentials]);

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
              {canViewCredentials && (
                <>
                  <TableHead>Provider NPI #</TableHead>
                  <TableHead>Provider DEA #</TableHead>
                  <TableHead>License</TableHead>
                </>
              )}
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProviders && filteredProviders.length > 0 ? (
              paginatedProviders?.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.profiles?.full_name || provider.profiles?.name}</TableCell>
                  <TableCell>{provider.practice?.name || provider.practice?.company}</TableCell>
                  <TableCell>{provider.profiles?.email}</TableCell>
                   {canViewCredentials && (
                    <>
                      <TableCell>
                        {isDecrypting ? (
                          <span className="text-xs text-muted-foreground">Decrypting...</span>
                        ) : (
                          <span className="font-mono text-sm">
                            {(() => {
                              const npi = decryptedCredentials?.get(provider.id)?.npi;
                              if (!npi || npi === '[ENCRYPTED]') {
                                return <span className="text-muted-foreground italic">Not set</span>;
                              }
                              return npi;
                            })()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isDecrypting ? (
                          <span className="text-xs text-muted-foreground">Decrypting...</span>
                        ) : (
                          <span className="font-mono text-sm">
                            {(() => {
                              const dea = decryptedCredentials?.get(provider.id)?.dea;
                              if (!dea || dea === '[ENCRYPTED]') {
                                return <span className="text-muted-foreground italic">Not set</span>;
                              }
                              return dea;
                            })()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isDecrypting ? (
                          <span className="text-xs text-muted-foreground">Decrypting...</span>
                        ) : (
                          <span className="font-mono text-sm">
                            {(() => {
                              const license = decryptedCredentials?.get(provider.id)?.license_number;
                              if (!license || license === '[ENCRYPTED]') {
                                return <span className="text-muted-foreground italic">Not set</span>;
                              }
                              return license;
                            })()}
                          </span>
                        )}
                      </TableCell>
                    </>
                  )}
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
                <TableCell colSpan={canViewCredentials ? 8 : 5} className="text-center text-muted-foreground">
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
