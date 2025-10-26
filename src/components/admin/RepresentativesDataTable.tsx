import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, Eye, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AddRepresentativeDialog } from "./AddRepresentativeDialog";
import { RepDetailsDialog } from "./RepDetailsDialog";

export const RepresentativesDataTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all reps with profile data and topline assignments
  const { data: reps, isLoading, refetch } = useQuery({
    queryKey: ["all-representatives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            active
          ),
          topline_rep:assigned_topline_id (
            id,
            profiles:user_id (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Filter reps based on search query
  const filteredReps = reps?.filter((rep) => {
    const profile = rep.profiles;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      profile?.name?.toLowerCase().includes(searchLower) ||
      profile?.email?.toLowerCase().includes(searchLower) ||
      rep.role?.toLowerCase().includes(searchLower);
    
    return matchesSearch;
  });

  // Apply pagination (25 items per page)
  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredReps?.length || 0,
    itemsPerPage: 25
  });

  // Slice data for current page
  const paginatedReps = filteredReps?.slice(startIndex, endIndex);

  // Calculate stats
  const stats = {
    totalReps: reps?.length || 0,
    activeTopline: reps?.filter(r => r.role === "topline" && r.profiles?.active).length || 0,
    activeDownline: reps?.filter(r => r.role === "downline" && r.profiles?.active).length || 0,
  };

  // Toggle account status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ profileId, currentStatus }: { profileId: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ active: !currentStatus })
        .eq("id", profileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Representative status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["all-representatives"] });
    },
    onError: (error: any) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  return (
    <div className="space-y-4">
      {/* Summary Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalReps}</div>
            <p className="text-xs text-muted-foreground">Total Representatives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.activeTopline}</div>
            <p className="text-xs text-muted-foreground">Active Topline Reps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.activeDownline}</div>
            <p className="text-xs text-muted-foreground">Active Downline Reps</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Representative
        </Button>
      </div>

      {/* Data Table */}
      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1000px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
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
              ) : !filteredReps || filteredReps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No representatives found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReps?.map((rep) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">{rep.profiles?.name || "-"}</TableCell>
                    <TableCell>{rep.profiles?.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={rep.role === "topline" ? "default" : "secondary"}>
                        {rep.role === "topline" ? "Topline" : "Downline"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rep.role === "downline" && rep.topline_rep?.profiles?.name 
                        ? rep.topline_rep.profiles.name 
                        : rep.role === "topline" 
                        ? "-" 
                        : "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rep.profiles?.active ? "default" : "secondary"}>
                        {rep.profiles?.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRep(rep);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatusMutation.mutate({
                            profileId: rep.profiles?.id,
                            currentStatus: rep.profiles?.active
                          })}
                        >
                          {rep.profiles?.active ? (
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

      {/* Pagination Component */}
      {filteredReps && filteredReps.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredReps.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredReps.length)}
        />
      )}

      {/* Dialogs */}
      <AddRepresentativeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => refetch()}
      />

      {selectedRep && (
        <RepDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          rep={selectedRep}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
