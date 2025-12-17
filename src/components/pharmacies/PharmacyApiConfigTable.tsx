import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Search, Settings2, Check, X, Webhook } from "lucide-react";
import { useResponsive } from "@/hooks/use-mobile";
import { MobileDataTable } from "@/components/responsive/MobileDataTable";
import { debounce } from "@/lib/performance";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { PharmacyApiConfigDialog } from "./PharmacyApiConfigDialog";

export const PharmacyApiConfigTable = () => {
  const { isMobile } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const debouncedSetSearch = debounce((value: string) => setSearchQuery(value), 300);

  const { data: pharmacies, isLoading, refetch } = useQuery({
    queryKey: ["pharmacies-api-config"],
    staleTime: 600000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select(`
          id,
          name,
          contact_email,
          active,
          api_enabled,
          api_endpoint_url,
          api_http_method,
          api_auth_type,
          api_auth_key_name,
          api_retry_count,
          api_timeout_seconds,
          api_custom_headers,
          api_payload_template,
          inbound_webhook_enabled,
          inbound_webhook_path,
          webhook_secret,
          api_status_mapping
        `)
        .order("name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

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
            onChange={(e) => debouncedSetSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
      </div>

      {isMobile ? (
        <MobileDataTable 
          rows={paginatedPharmacies?.map((pharmacy) => ({
            title: pharmacy.name,
            subtitle: pharmacy.contact_email,
            fields: [
              { 
                label: 'API Enabled', 
                value: pharmacy.api_enabled ? 'Yes' : 'No',
                badge: true,
                badgeVariant: pharmacy.api_enabled ? 'default' : 'secondary'
              },
              { 
                label: 'Webhook Enabled', 
                value: pharmacy.inbound_webhook_enabled ? 'Yes' : 'No',
                badge: true,
                badgeVariant: pharmacy.inbound_webhook_enabled ? 'default' : 'secondary'
              },
              { 
                label: 'Endpoint', 
                value: pharmacy.api_endpoint_url || 'Not configured'
              }
            ],
            actions: [
              { label: 'Configure API', onClick: () => {
                setSelectedPharmacy(pharmacy);
                setDialogOpen(true);
              }}
            ]
          })) || []}
        />
      ) : (
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pharmacy</TableHead>
                <TableHead>API Status</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredPharmacies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No pharmacies found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPharmacies?.map((pharmacy) => (
                  <TableRow key={pharmacy.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pharmacy.name}</div>
                        <div className="text-xs text-muted-foreground">{pharmacy.contact_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pharmacy.api_enabled ? (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <X className="h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {pharmacy.api_endpoint_url ? (
                        <span className="text-xs font-mono truncate max-w-[200px] block">
                          {pharmacy.api_endpoint_url}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not configured</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pharmacy.api_http_method ? (
                        <Badge variant="outline" className="text-xs">
                          {pharmacy.api_http_method}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pharmacy.inbound_webhook_enabled ? (
                        <Badge variant="default" className="gap-1">
                          <Webhook className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPharmacy(pharmacy);
                          setDialogOpen(true);
                        }}
                      >
                        <Settings2 className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

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

      {selectedPharmacy && (
        <PharmacyApiConfigDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pharmacyId={selectedPharmacy.id}
          pharmacyName={selectedPharmacy.name}
        />
      )}
    </div>
  );
};
