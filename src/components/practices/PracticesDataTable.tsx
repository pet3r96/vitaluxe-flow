import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
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
import { Search, Eye, Power, PowerOff, UserPlus, FileText, Package } from "lucide-react";
import { AddPracticeDialog } from "./AddPracticeDialog";
import { PracticeDetailsDialog } from "./PracticeDetailsDialog";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { formatPhoneNumber } from "@/lib/validators";

export const PracticesDataTable = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPractice, setSelectedPractice] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Check if user can view credentials
  const canViewCredentials = effectiveRole && ['admin', 'doctor', 'provider', 'pharmacy'].includes(effectiveRole);

  const { data: practices, isLoading, refetch } = useRealtimeQuery(
    ["practices"],
    async () => {
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

      // Get ALL roles for these doctor profiles to detect conflicting roles
      const doctorIds = allDoctors?.map(d => d.id) || [];
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", doctorIds);

      if (rolesError) throw rolesError;

      // Create map of user_id -> Set of all roles
      const userRolesMap = new Map<string, Set<string>>();
      allRoles?.forEach(ur => {
        if (!userRolesMap.has(ur.user_id)) {
          userRolesMap.set(ur.user_id, new Set());
        }
        userRolesMap.get(ur.user_id)!.add(ur.role);
      });

      // Get provider records with both user_id and practice_id
      const { data: providerRecords, error: providersError } = await supabase
        .from("providers")
        .select("user_id, practice_id");

      if (providersError) throw providersError;

      // Filter out actual providers (user_id != practice_id), but keep self-referential practice records
      const providerUserIds = new Set(
        providerRecords?.filter(p => p.user_id !== p.practice_id).map(p => p.user_id) || []
      );

      // Filter for TRUE practices only - exclude those with non-practice roles
      const NON_PRACTICE_ROLES = ['downline', 'topline', 'staff', 'patient', 'pharmacy'];
      const practicesOnly = allDoctors?.filter(doc => {
        // Exclude if they're a provider at another practice
        if (providerUserIds.has(doc.id)) return false;
        
        // Exclude if they have any non-practice roles
        const roles = userRolesMap.get(doc.id);
        if (roles) {
          for (const nonPracticeRole of NON_PRACTICE_ROLES) {
            if (roles.has(nonPracticeRole)) {
              console.warn(`[Practices] Excluding ${doc.name} - has ${nonPracticeRole} role in addition to doctor`);
              return false;
            }
          }
        }
        
        return true;
      }) || [];

      return practicesOnly;
    },
    { staleTime: 60000 } // 1 minute for instant updates
  );

  // No longer need decryption - credentials stored in profiles table

  const { data: providerCounts } = useQuery({
    queryKey: ["provider-counts"],
    staleTime: 5 * 60 * 1000, // 5min - provider counts rarely change
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("practice_id"); // Only select needed field

      if (error) throw error;

      // Count providers per practice
      const counts: Record<string, number> = {};
      data?.forEach(provider => {
        counts[provider.practice_id] = (counts[provider.practice_id] || 0) + 1;
      });

      return counts;
    },
  });

  const { data: allReps } = useQuery({
    queryKey: ["all-reps-lookup"],
    staleTime: 5 * 60 * 1000, // 5min - rep data changes infrequently
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    queryFn: async () => {
      // Fetch topline reps
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
      
      // Fetch downline reps
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
      
      // Combine and create a lookup map
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

  // Fetch rep-practice links
  const { data: repPracticeLinks } = useQuery({
    queryKey: ["rep-practice-links"],
    staleTime: 5 * 60 * 1000, // 5min - links rarely change
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rep_practice_links")
        .select(`
          practice_id,
          rep_id,
          reps!rep_practice_links_rep_id_fkey!inner(
            user_id,
            role
          )
        `);
      
      if (error) throw error;
      
      // Group by practice_id
      const linksByPractice: Record<string, any[]> = {};
      data?.forEach(link => {
        if (!linksByPractice[link.practice_id]) {
          linksByPractice[link.practice_id] = [];
        }
        linksByPractice[link.practice_id].push(link);
      });
      
      return linksByPractice;
    },
    enabled: !!practices,
  });

  const { data: stats } = useQuery({
    queryKey: ["practice-stats"],
    staleTime: 2 * 60 * 1000, // 2min - stats can be slightly stale
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount, doctor_id"); // Only select needed fields for stats

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

  const getRepDisplay = (practiceId: string, linkedToplineId: string | null) => {
    const links = repPracticeLinks?.[practiceId] || [];
    
    if (links.length === 0) {
      // Fallback to old linked_topline_id system
      if (!linkedToplineId || !allReps) return "N/A";
      const rep = allReps.get(linkedToplineId);
      return rep ? `${rep.name} (${rep.role})` : "N/A";
    }
    
    // Show all reps linked to this practice
    return links.map(link => {
      const rep = allReps.get(link.reps.user_id);
      return rep ? `${rep.name} (${rep.role})` : "Unknown";
    }).join(", ");
  };

  const toggleAccountStatus = useCallback(async (practiceId: string, currentStatus: boolean) => {
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

    // Get practice details for audit log
    const practice = practices?.find(p => p.id === practiceId);
    const practiceName = practice?.name || "Unknown Practice";

    const { error } = await supabase
      .from("profiles")
      .update({ active: !currentStatus })
      .eq("id", practiceId);

    if (!error) {
      // Log to audit_logs
      await supabase.from("audit_logs").insert({
        action_type: currentStatus ? "practice_disabled" : "practice_enabled",
        entity_type: "practice",
        entity_id: practiceId,
        user_id: effectiveUserId,
        details: {
          practice_name: practiceName,
          previous_status: currentStatus,
          new_status: !currentStatus,
        },
      });

      toast.success(
        currentStatus 
          ? "✅ Practice account disabled successfully"
          : "✅ Practice account enabled successfully"
      );
      refetch();
    } else {
      toast.error("❌ Failed to update practice status");
    }
  }, [refetch, practices, effectiveUserId]);

  const filteredPractices = useMemo(() => practices?.filter((practice) => {
    const matchesSearch = 
      practice.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      practice.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  }), [practices, searchQuery]);

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

  // No longer need credential access logging - encryption removed

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          Add Practice
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practice Name</TableHead>
                <TableHead>Email</TableHead>
                {canViewCredentials && (
                  <>
                    <TableHead>NPI</TableHead>
                    <TableHead>License #</TableHead>
                  </>
                )}
              <TableHead>Phone</TableHead>
              <TableHead>Prescriber Status</TableHead>
              <TableHead>Providers</TableHead>
              <TableHead>Assigned Rep</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canViewCredentials ? 10 : 8} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPractices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canViewCredentials ? 10 : 8} className="text-center text-muted-foreground">
                  No practices found
                </TableCell>
              </TableRow>
            ) : (
              paginatedPractices?.map((practice) => (
                <TableRow key={practice.id}>
                  <TableCell className="font-medium">{practice.name}</TableCell>
                  <TableCell>{practice.email}</TableCell>
                  {canViewCredentials && (
                    <>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {practice.npi || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {practice.license_number || "-"}
                        </span>
                      </TableCell>
                    </>
                  )}
                  <TableCell>{formatPhoneNumber(practice.phone)}</TableCell>
                  <TableCell>
                    {practice.has_prescriber ? (
                      <Badge variant="success" size="sm">
                        <FileText className="h-3 w-3 mr-1" />
                        Prescriber
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        <Package className="h-3 w-3 mr-1" />
                        Non-Rx Only
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{providerCounts?.[practice.id] || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {getRepDisplay(practice.id, practice.linked_topline_id)}
                    </span>
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
