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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Eye, UserPlus } from "lucide-react";
import { AddProviderDialog } from "./AddProviderDialog";
import { ProviderDetailsDialog } from "./ProviderDetailsDialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const ProvidersDataTable = () => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const { data: providers, isLoading, refetch } = useQuery({
    queryKey: ["providers", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers" as any)
        .select("*")
        .eq("practice_id", effectiveUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!effectiveUserId && effectiveRole === "doctor"
  });

  const toggleStatus = async (providerId: string, currentStatus: boolean) => {
    const { error } = await supabase.functions.invoke('manage-provider-status', {
      body: { providerId, active: !currentStatus }
    });
    
    if (error) {
      toast.error("Failed to update provider status");
    } else {
      toast.success(currentStatus ? "Provider deactivated" : "Provider activated");
      refetch();
    }
  };

  const filteredProviders = providers?.filter((provider) =>
    provider.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.prescriber_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.npi?.includes(searchQuery)
  );

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Prescriber Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Provider NPI #</TableHead>
              <TableHead>Provider DEA #</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProviders && filteredProviders.length > 0 ? (
              filteredProviders.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.full_name}</TableCell>
                  <TableCell>{provider.prescriber_name}</TableCell>
                  <TableCell>{provider.email}</TableCell>
                  <TableCell>{provider.npi}</TableCell>
                  <TableCell>{provider.dea || "N/A"}</TableCell>
                  <TableCell>{provider.license_number}</TableCell>
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
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No providers found. Add your first provider to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
