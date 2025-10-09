import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Card, CardContent } from "@/components/ui/card";
import { Search, Eye, Power, PowerOff, UserPlus } from "lucide-react";
import { AddProviderDialog } from "./AddProviderDialog";
import { ProviderDetailsDialog } from "./ProviderDetailsDialog";
import { toast } from "sonner";

export const ProvidersDataTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: providers, isLoading, refetch } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "doctor")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["provider-stats"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount, doctor_id");

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
      const activeProviders = providers?.filter(p => p.active).length || 0;

      return {
        totalProviders: providers?.length || 0,
        activeProviders,
        totalOrders,
        totalRevenue,
      };
    },
    enabled: !!providers,
  });

  const toggleAccountStatus = async (providerId: string, currentStatus: boolean) => {
    if (currentStatus) {
      const confirmed = window.confirm(
        "⚠️ Disable Provider Account?\n\n" +
        "This provider will be immediately signed out and unable to:\n" +
        "• Access their account\n" +
        "• Place new orders\n" +
        "• View patient information\n\n" +
        "Active orders will remain visible but provider cannot modify them.\n\n" +
        "Continue?"
      );
      if (!confirmed) return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ active: !currentStatus })
      .eq("id", providerId);

    if (!error) {
      toast.success(
        currentStatus 
          ? "✅ Provider account disabled successfully"
          : "✅ Provider account enabled successfully"
      );
      refetch();
    } else {
      toast.error("❌ Failed to update provider status");
    }
  };

  const filteredProviders = providers?.filter((provider) => {
    const matchesSearch = 
      provider.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.npi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.license_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{stats?.totalProviders || 0}</div>
            <p className="text-sm text-muted-foreground">Total Providers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats?.activeProviders || 0}</div>
            <p className="text-sm text-muted-foreground">Active Providers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{stats?.totalOrders || 0}</div>
            <p className="text-sm text-muted-foreground">Total Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              ${(stats?.totalRevenue || 0).toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Add Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, NPI, license..."
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

      {/* Providers Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NPI</TableHead>
              <TableHead>License #</TableHead>
              <TableHead>Company/Practice</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
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
            ) : filteredProviders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No providers found
                </TableCell>
              </TableRow>
            ) : (
              filteredProviders?.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell>{provider.email}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{provider.npi || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{provider.license_number || "-"}</span>
                  </TableCell>
                  <TableCell>{provider.company || "-"}</TableCell>
                  <TableCell>{provider.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={provider.active ? "default" : "secondary"}>
                      {provider.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAccountStatus(provider.id, provider.active)}
                      >
                        {provider.active ? (
                          <PowerOff className="h-4 w-4 text-destructive" />
                        ) : (
                          <Power className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddProviderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => refetch()}
      />

      {selectedProvider && (
        <ProviderDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          provider={selectedProvider}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
