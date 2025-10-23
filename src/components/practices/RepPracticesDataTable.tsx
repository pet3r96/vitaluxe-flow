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
import { Card, CardContent } from "@/components/ui/card";
import { Search, Eye, UserPlus } from "lucide-react";
import { PracticeDetailsDialog } from "./PracticeDetailsDialog";
import { AddPracticeRequestDialog } from "./AddPracticeRequestDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const RepPracticesDataTable = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPractice, setSelectedPractice] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch practices based on role using rep_practice_links
  const { data: practices, isLoading, refetch } = useQuery({
    queryKey: ["rep-practices", effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      // Get the current user's rep record (reps.id, not user_id)
      const { data: repRecord, error: repError } = await supabase
        .from("reps")
        .select("id, role")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      if (repError) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Error fetching rep record", repError);
        });
        throw repError;
      }
      
      if (!repRecord) {
        return [];
      }
      
      // Build list of rep_ids to include (for toplines: include downlines too)
      let networkRepIds = [repRecord.id];
      
      if (effectiveRole === 'topline') {
        // Get all downlines assigned to this topline
        const { data: downlines, error: downlinesError } = await supabase
          .from("reps")
          .select("id")
          .eq("assigned_topline_id", repRecord.id)
          .eq("role", "downline")
          .eq("active", true);
        
        if (downlinesError) {
          import('@/lib/logger').then(({ logger }) => {
            logger.error("Error fetching downlines", downlinesError);
          });
          throw downlinesError;
        }
        
        const downlineRepIds = downlines?.map(d => d.id) || [];
        networkRepIds = [repRecord.id, ...downlineRepIds];
      }
      
      // Query practices via rep_practice_links for entire network
      const { data: practiceLinks, error: linksError } = await supabase
        .from("rep_practice_links")
        .select("practice_id")
        .in("rep_id", networkRepIds);
      
      if (linksError) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Error fetching practice links", linksError);
        });
        throw linksError;
      }
      
      if (!practiceLinks || practiceLinks.length === 0) {
        return [];
      }

      // De-duplicate practice IDs
      const practiceIds = Array.from(new Set(practiceLinks.map(link => link.practice_id)));

      // Fetch full practice details (no role filter needed - rep_practice_links validates these are practices)
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", practiceIds)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (profilesError) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Error fetching profiles", profilesError);
        });
        throw profilesError;
      }

      // Get provider user IDs to filter out
      const { data: providerIds, error: providersError } = await supabase
        .from("providers")
        .select("user_id");

      if (providersError) throw providersError;

      const providerUserIds = new Set(providerIds?.map(p => p.user_id) || []);
      
      // Filter out providers
      const practicesData = profilesData?.filter(p => !providerUserIds.has(p.id)) || [];
      
      return practicesData;
    },
    enabled: !!effectiveUserId && (effectiveRole === "topline" || effectiveRole === "downline"),
  });

  const { data: providerCounts } = useQuery({
    queryKey: ["provider-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("practice_id");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach(provider => {
        counts[provider.practice_id] = (counts[provider.practice_id] || 0) + 1;
      });

      return counts;
    },
  });

  const { data: allReps } = useQuery({
    queryKey: ["all-reps-lookup"],
    queryFn: async () => {
      const { data: toplineReps, error: toplineError } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "topline")
        .eq("active", true);
      
      if (toplineError) throw toplineError;
      
      const { data: downlineReps, error: downlineError } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "downline")
        .eq("active", true);
      
      if (downlineError) throw downlineError;
      
      const allReps = [...(toplineReps || []), ...(downlineReps || [])];
      const repMap = new Map();
      allReps.forEach(rep => {
        repMap.set(rep.id, {
          name: rep.name,
          role: rep.user_roles[0].role
        });
      });
      
      return repMap;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["rep-practice-stats", effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (!practices || practices.length === 0) {
        return {
          totalPractices: 0,
          activePractices: 0,
          totalOrders: 0,
          totalRevenue: 0,
        };
      }

      const practiceIds = practices.map(p => p.id);

      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount, doctor_id")
        .in("doctor_id", practiceIds);

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const activePractices = practices?.filter(p => p.active).length || 0;

      return {
        totalPractices: practices?.length || 0,
        activePractices,
        totalOrders,
      };
    },
    enabled: !!practices && practices.length > 0,
  });

  const getRepDisplay = (linkedToplineId: string | null) => {
    if (!linkedToplineId || !allReps) {
      return "N/A";
    }
    
    const rep = allReps.get(linkedToplineId);
    if (!rep) {
      return "N/A";
    }
    
    return `${rep.name} (${rep.role})`;
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

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredPractices?.length || 0,
    itemsPerPage: 25
  });

  const paginatedPractices = filteredPractices?.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Search */}
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
      </div>

      {/* Practices Table (Read-Only) */}
      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1200px]">
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
              <TableHead>Assigned Rep</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPractices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No practices found
                </TableCell>
              </TableRow>
            ) : (
              paginatedPractices?.map((practice) => (
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
                    <span className="text-sm">
                      {getRepDisplay(practice.linked_topline_id)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={practice.active ? "default" : "secondary"}>
                      {practice.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredPractices && filteredPractices.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredPractices.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredPractices.length)}
        />
      )}

      <div className="flex justify-end mb-4">
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Request New Practice
        </Button>
          </div>

      {selectedPractice && (
        <PracticeDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          provider={selectedPractice}
          onSuccess={() => refetch()}
        />
      )}

      <AddPracticeRequestDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
