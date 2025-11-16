import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Edit, UserPlus, AlertCircle } from "lucide-react";
import { PharmacyDialog } from "./PharmacyDialog";
import { PharmacyShippingRatesDialog } from "./PharmacyShippingRatesDialog";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const PharmaciesDataTable = () => {
  const { effectiveRole, effectiveUserId, isImpersonating } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shippingRatesDialogOpen, setShippingRatesDialogOpen] = useState(false);
  const [selectedPharmacyForRates, setSelectedPharmacyForRates] = useState<any>(null);
  const [fixingPharmacyId, setFixingPharmacyId] = useState<string | null>(null);

  // Only real non-impersonating admins bypass visibility filtering
  const viewingAsAdmin = effectiveRole === "admin" && !isImpersonating;

  const { data: pharmacies, isLoading, refetch } = useQuery({
    queryKey: ["pharmacies", effectiveUserId, effectiveRole],
    staleTime: 600000, // 10 minutes - pharmacies rarely change
    queryFn: async () => {
      let query = supabase
        .from("pharmacies")
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            active
          )
        `)
        .order("created_at", { ascending: false });

      // For impersonated views or non-admin users, filter by visibility
      if (isImpersonating || !viewingAsAdmin) {
        try {
          const { data: visiblePharmacies, error: visError } = await supabase.rpc(
            'get_visible_pharmacies_for_effective_user' as any,
            { p_effective_user_id: effectiveUserId }
          ) as { data: Array<{ id: string }> | null; error: any };
          
          if (visError) {
            console.error('[PharmaciesDataTable] Visibility RPC error:', visError);
            toast.error('Could not determine pharmacy visibility');
            return [];
          } else if (visiblePharmacies && visiblePharmacies.length > 0) {
            const visiblePharmacyIds = visiblePharmacies.map((p) => p.id);
            query = query.in('id', visiblePharmacyIds);
          } else {
            // No visible pharmacies found
            return [];
          }
        } catch (error) {
          console.error('[PharmaciesDataTable] Error checking pharmacy visibility:', error);
          toast.error('Could not determine pharmacy visibility');
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const togglePharmacyStatus = async (pharmacyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("pharmacies")
      .update({ active: !currentStatus })
      .eq("id", pharmacyId);

    if (!error) {
      toast.success(`Pharmacy ${!currentStatus ? "activated" : "deactivated"}`);
      refetch();
    } else {
      toast.error("Failed to update pharmacy status");
    }
  };

  const createAccountForPharmacy = async (pharmacyId: string, pharmacyName: string, contactEmail: string) => {
    setFixingPharmacyId(pharmacyId);
    try {
      const { data, error } = await supabase.functions.invoke('fix-orphaned-pharmacy', {
        body: { pharmacyId }
      });

      if (error) throw error;

      const result = data?.results?.[0];
      if (result?.success) {
        toast.success(
          `Account created for ${pharmacyName}!`,
          {
            description: `Temporary password: ${result.tempPassword || 'Check console'}`,
            duration: 10000,
          }
        );
        refetch();
      } else {
        throw new Error(result?.error || 'Failed to create account');
      }
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error creating pharmacy account', error);
      });
      toast.error(`Failed to create account for ${pharmacyName}`, {
        description: error.message,
      });
    } finally {
      setFixingPharmacyId(null);
    }
  };

  const filteredPharmacies = pharmacies?.filter((pharmacy) =>
    pharmacy.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacy.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
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
    totalItems: filteredPharmacies?.length || 0,
    itemsPerPage: 25
  });

  const paginatedPharmacies = filteredPharmacies?.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pharmacies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Button
          onClick={() => {
            setSelectedPharmacy(null);
            setDialogOpen(true);
          }}
        >
          Add Pharmacy
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1200px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead>Shipping Rates</TableHead>
              <TableHead>States Serviced</TableHead>
              <TableHead>Priority Map</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPharmacies?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No pharmacies found
                </TableCell>
              </TableRow>
            ) : (
              paginatedPharmacies?.map((pharmacy) => (
                <TableRow key={pharmacy.id}>
                  <TableCell className="font-medium">{pharmacy.name}</TableCell>
                  <TableCell>{pharmacy.contact_email}</TableCell>
                  <TableCell>
                    {!pharmacy.user_id ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        No Account
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm" className="gap-1">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPharmacyForRates(pharmacy);
                        setShippingRatesDialogOpen(true);
                      }}
                    >
                      Configure Rates
                    </Button>
                  </TableCell>
                  <TableCell>
                    {pharmacy.states_serviced && pharmacy.states_serviced.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {pharmacy.states_serviced.slice(0, 3).map((state: string) => (
                          <Badge key={state} variant="secondary" className="text-xs">
                            {state}
                          </Badge>
                        ))}
                        {pharmacy.states_serviced.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{pharmacy.states_serviced.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {pharmacy.priority_map && Object.keys(pharmacy.priority_map).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(pharmacy.priority_map)
                          .slice(0, 3)
                          .map(([state, priority]: [string, any]) => (
                            <Badge key={state} variant="outline" className="text-xs">
                              {state}({priority})
                            </Badge>
                          ))}
                        {Object.keys(pharmacy.priority_map).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(pharmacy.priority_map).length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not configured</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={pharmacy.active}
                      onCheckedChange={() => togglePharmacyStatus(pharmacy.id, pharmacy.active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!pharmacy.user_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => createAccountForPharmacy(pharmacy.id, pharmacy.name, pharmacy.contact_email)}
                          disabled={fixingPharmacyId === pharmacy.id}
                        >
                          {fixingPharmacyId === pharmacy.id ? (
                            <>Creating...</>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Create Account
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPharmacy(pharmacy);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredPharmacies && filteredPharmacies.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredPharmacies.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredPharmacies.length)}
        />
      )}

      <PharmacyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pharmacy={selectedPharmacy}
        onSuccess={() => refetch()}
      />

      {selectedPharmacyForRates && (
        <PharmacyShippingRatesDialog
          open={shippingRatesDialogOpen}
          onOpenChange={setShippingRatesDialogOpen}
          pharmacy={selectedPharmacyForRates}
        />
      )}
    </div>
  );
};
