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
import { Search, UserPlus, Eye, Power, PowerOff, Users, TrendingUp, Users2 } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AddRepresentativeDialog } from "./AddRepresentativeDialog";
import { RepDetailsDialog } from "./RepDetailsDialog";

const formatPhoneNumber = (phone: string | null | undefined) => {
  if (!phone) return "Not Set";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

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

  // Fetch 2FA phone numbers for all reps
  const { data: twoFAPhones } = useQuery({
    queryKey: ["rep-2fa-phones"],
    queryFn: async () => {
      if (!reps) return {};
      
      const userIds = reps.map(r => r.user_id).filter(Boolean);
      if (userIds.length === 0) return {};
      
      const { data: settings } = await supabase
        .from("user_2fa_settings")
        .select("user_id, phone_number_encrypted, is_enrolled, phone_verified")
        .in("user_id", userIds);
      
      if (!settings) return {};
      
      const phoneMap: Record<string, string | null> = {};
      
      for (const setting of settings) {
        if (setting.is_enrolled && setting.phone_number_encrypted) {
          const { data: decrypted } = await supabase.rpc("decrypt_2fa_phone", {
            p_encrypted_phone: setting.phone_number_encrypted
          });
          phoneMap[setting.user_id] = decrypted;
        } else {
          phoneMap[setting.user_id] = null;
        }
      }
      
      return phoneMap;
    },
    enabled: !!reps && reps.length > 0,
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
    <div className="space-y-6">
      {/* Summary Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card variant="glass" className="shadow-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Representatives</p>
                <div className="text-3xl font-bold gold-text-modern">{stats.totalReps}</div>
              </div>
              <div className="h-12 w-12 rounded-full bg-gold1/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-gold1" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="glass" className="shadow-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Active Topline</p>
                <div className="text-3xl font-bold text-primary">{stats.activeTopline}</div>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="glass" className="shadow-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Active Downline</p>
                <div className="text-3xl font-bold text-success">{stats.activeDownline}</div>
              </div>
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <Users2 className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-11 glass-card border-border/50"
          />
        </div>
        <Button 
          onClick={() => setAddDialogOpen(true)}
          className="accent-gold-primary h-11 px-6 shadow-hover"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Add Representative
        </Button>
      </div>

      {/* Data Table */}
      <Card variant="glass" className="shadow-elevated overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <h3 className="text-lg font-semibold">All Representatives</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredReps?.length || 0} total • {stats.activeTopline} topline • {stats.activeDownline} downline
          </p>
        </div>
        <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="h-12 px-6 font-semibold">Name</TableHead>
                  <TableHead className="h-12 px-6 font-semibold">Email</TableHead>
                  <TableHead className="h-12 px-6 font-semibold">Phone</TableHead>
                  <TableHead className="h-12 px-6 font-semibold">Role</TableHead>
                  <TableHead className="h-12 px-6 font-semibold">Assigned To</TableHead>
                  <TableHead className="h-12 px-6 font-semibold">Status</TableHead>
                  <TableHead className="h-12 px-6 font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-32">
                      <div className="flex items-center justify-center">
                        <div className="h-8 w-8 border-4 border-gold1 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !filteredReps || filteredReps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="h-12 w-12 text-muted-foreground/50" />
                        <p>No representatives found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedReps?.map((rep) => (
                    <TableRow key={rep.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="font-medium px-6 py-4">{rep.profiles?.name || "-"}</TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground">{rep.profiles?.email || "-"}</TableCell>
                      <TableCell className="px-6 py-4">
                        {twoFAPhones?.[rep.user_id] ? (
                          <span className="font-mono text-sm">{formatPhoneNumber(twoFAPhones[rep.user_id])}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not Set</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={rep.role === "topline" ? "accent-gold-light" : "accent-success"}>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border">
                            {rep.role === "topline" ? "Topline" : "Downline"}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground text-sm">
                        {rep.role === "downline" && rep.topline_rep?.profiles?.name 
                          ? rep.topline_rep.profiles.name 
                          : rep.role === "topline" 
                          ? "—" 
                          : "Unassigned"}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={rep.profiles?.active ? "accent-success" : "bg-muted/20 text-muted border-border"}>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border">
                            {rep.profiles?.active ? "Active" : "Inactive"}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRep(rep);
                              setDetailsOpen(true);
                            }}
                            className="h-9 w-9 p-0 hover:bg-gold1/10"
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
                            className="h-9 w-9 p-0 hover:bg-destructive/10"
                          >
                            {rep.profiles?.active ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-success" />
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
      </Card>

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
