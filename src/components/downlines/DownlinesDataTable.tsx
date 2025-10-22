import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Search } from "lucide-react";
import { DownlineDetailsDialog } from "./DownlineDetailsDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface EnrichedDownline {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  active: boolean;
  practiceCount: number;
  orderCount: number;
}

export function DownlinesDataTable() {
  const { effectiveUserId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDownline, setSelectedDownline] = useState<EnrichedDownline | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: downlines, isLoading } = useQuery({
    queryKey: ["downlines-table", effectiveUserId],
    staleTime: 300000, // 5 minutes - downlines change infrequently
    queryFn: async () => {
      if (!effectiveUserId) return [];

      // First, get the current user's rep record to get their rep ID
      const { data: currentRep, error: repError } = await supabase
        .from("reps")
        .select("id")
        .eq("user_id", effectiveUserId)
        .eq("role", "topline")
        .single();

      if (repError) throw repError;
      if (!currentRep) return [];

      // Get downline REPS assigned to this topline (from reps table - source of truth)
      const { data: downlineReps, error: repsError } = await supabase
        .from("reps")
        .select(`
          id,
          user_id,
          active,
          profiles!inner(
            name,
            email,
            phone,
            company,
            active
          )
        `)
        .eq("assigned_topline_id", currentRep.id)
        .eq("role", "downline")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (repsError) throw repsError;
      if (!downlineReps || downlineReps.length === 0) return [];

      // Flatten the data structure
      const downlinesData = downlineReps.map(rep => ({
        id: rep.user_id,
        name: rep.profiles.name,
        email: rep.profiles.email,
        phone: rep.profiles.phone,
        company: rep.profiles.company,
        active: rep.active && rep.profiles.active,
      }));

      // Get practice counts for each downline
      const downlineIds = downlinesData.map((d) => d.id);
      const { data: practices, error: practicesError } = await supabase
        .from("profiles")
        .select("id, linked_topline_id")
        .in("linked_topline_id", downlineIds)
        .eq("active", true);

      if (practicesError) throw practicesError;

      // Create practice counts map
      const practiceCountsMap: Record<string, number> = {};
      practices?.forEach((practice) => {
        const downlineId = practice.linked_topline_id;
        if (downlineId && downlineIds.includes(downlineId)) {
          practiceCountsMap[downlineId] = (practiceCountsMap[downlineId] || 0) + 1;
        }
      });

      // Get order counts for each downline's practices
      const practiceIds = practices?.map(p => p.id) || [];
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("doctor_id, id")
        .in("doctor_id", practiceIds);

      if (ordersError) throw ordersError;

      // Create order counts map per downline
      const orderCountsMap: Record<string, number> = {};
      orders?.forEach((order) => {
        const practice = practices?.find(p => p.id === order.doctor_id);
        if (practice && practice.linked_topline_id) {
          const downlineId = practice.linked_topline_id;
          orderCountsMap[downlineId] = (orderCountsMap[downlineId] || 0) + 1;
        }
      });

      // Enrich downlines with practice counts and order counts
      const enrichedDownlines: EnrichedDownline[] = downlinesData.map((downline) => ({
        ...downline,
        practiceCount: practiceCountsMap[downline.id] || 0,
        orderCount: orderCountsMap[downline.id] || 0,
      }));

      return enrichedDownlines;
    },
    enabled: !!effectiveUserId,
  });

  const filteredDownlines = downlines?.filter((downline) => {
    const query = searchQuery.toLowerCase();
    return (
      downline.name.toLowerCase().includes(query) ||
      downline.email.toLowerCase().includes(query) ||
      downline.phone?.toLowerCase().includes(query) ||
      downline.company?.toLowerCase().includes(query)
    );
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
    totalItems: filteredDownlines?.length || 0,
    itemsPerPage: 25
  });

  const paginatedDownlines = filteredDownlines?.slice(startIndex, endIndex);

  const totalPractices = downlines?.reduce((sum, d) => sum + d.practiceCount, 0) || 0;

  const handleViewDetails = (downline: EnrichedDownline) => {
    setSelectedDownline(downline);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading downlines...</div>
      </div>
    );
  }

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
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Practices</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDownlines && filteredDownlines.length > 0 ? (
              paginatedDownlines?.map((downline) => (
                <TableRow key={downline.id}>
                  <TableCell className="font-medium">{downline.name}</TableCell>
                  <TableCell>{downline.email}</TableCell>
                  <TableCell>{downline.phone || "—"}</TableCell>
                  <TableCell>{downline.company || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{downline.practiceCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{downline.orderCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={downline.active ? "default" : "secondary"}>
                      {downline.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(downline)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No downlines found matching your search" : "No downlines assigned yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredDownlines && filteredDownlines.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredDownlines.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredDownlines.length)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Downlines</div>
          <div className="text-2xl font-bold text-primary">{downlines?.length || 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Practices</div>
          <div className="text-2xl font-bold text-primary">{totalPractices}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Orders</div>
          <div className="text-2xl font-bold text-primary">
            {downlines?.reduce((sum, d) => sum + d.orderCount, 0) || 0}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Active Downlines</div>
          <div className="text-2xl font-bold text-primary">
            {downlines?.filter((d) => d.active).length || 0}
          </div>
        </div>
      </div>

      {selectedDownline && (
        <DownlineDetailsDialog
          downline={selectedDownline}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      )}
    </div>
  );
}
