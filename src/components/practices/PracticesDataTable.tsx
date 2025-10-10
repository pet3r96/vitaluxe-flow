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
import { AddPracticeDialog } from "./AddPracticeDialog";
import { PracticeDetailsDialog } from "./PracticeDetailsDialog";
import { toast } from "sonner";

export const PracticesDataTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPractice, setSelectedPractice] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: practices, isLoading, refetch } = useQuery({
    queryKey: ["practices"],
    queryFn: async () => {
      // First get all doctor role users
      const { data: allDoctors, error: doctorsError } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "doctor")
        .order("created_at", { ascending: false });

      if (doctorsError) throw doctorsError;

      // Then get all provider user_ids
      const { data: providerIds, error: providersError } = await supabase
        .from("providers")
        .select("user_id");

      if (providersError) throw providersError;

      // Filter out providers, keeping only practices
      const providerUserIds = new Set(providerIds?.map(p => p.user_id) || []);
      const practicesOnly = allDoctors?.filter(doc => !providerUserIds.has(doc.id)) || [];

      return practicesOnly;
    },
  });

  const { data: providerCounts } = useQuery({
    queryKey: ["provider-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("practice_id");

      if (error) throw error;

      // Count providers per practice
      const counts: Record<string, number> = {};
      data?.forEach(provider => {
        counts[provider.practice_id] = (counts[provider.practice_id] || 0) + 1;
      });

      return counts;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["practice-stats"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount, doctor_id");

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
      const activePractices = practices?.filter(p => p.active).length || 0;

      return {
        totalPractices: practices?.length || 0,
        activePractices,
        totalOrders,
        totalRevenue,
      };
    },
    enabled: !!practices,
  });

  const toggleAccountStatus = async (practiceId: string, currentStatus: boolean) => {
    if (currentStatus) {
      const confirmed = window.confirm(
        "⚠️ Disable Practice Account?\n\n" +
        "This practice will be immediately signed out and unable to:\n" +
        "• Access their account\n" +
        "• Place new orders\n" +
        "• View patient information\n\n" +
        "Active orders will remain visible but practice cannot modify them.\n\n" +
        "Continue?"
      );
      if (!confirmed) return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ active: !currentStatus })
      .eq("id", practiceId);

    if (!error) {
      toast.success(
        currentStatus 
          ? "✅ Practice account disabled successfully"
          : "✅ Practice account enabled successfully"
      );
      refetch();
    } else {
      toast.error("❌ Failed to update practice status");
    }
  };

  const filteredPractices = practices?.filter((practice) => {
    const matchesSearch = 
      practice.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.npi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.license_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{stats?.totalPractices || 0}</div>
            <p className="text-sm text-muted-foreground">Total Practices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats?.activePractices || 0}</div>
            <p className="text-sm text-muted-foreground">Active Practices</p>
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
          Add Practice
        </Button>
      </div>

      {/* Practices Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Practice Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NPI</TableHead>
              <TableHead>License #</TableHead>
              <TableHead>Company/Practice</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Providers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPractices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No practices found
                </TableCell>
              </TableRow>
            ) : (
              filteredPractices?.map((practice) => (
                <TableRow key={practice.id}>
                  <TableCell className="font-medium">{practice.name}</TableCell>
                  <TableCell>{practice.email}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{practice.npi || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{practice.license_number || "-"}</span>
                  </TableCell>
                  <TableCell>{practice.company || "-"}</TableCell>
                  <TableCell>{practice.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{providerCounts?.[practice.id] || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={practice.active ? "default" : "secondary"}>
                      {practice.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPractice(practice);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAccountStatus(practice.id, practice.active)}
                      >
                        {practice.active ? (
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

      <AddPracticeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => refetch()}
      />

      {selectedPractice && (
        <PracticeDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          provider={selectedPractice}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
