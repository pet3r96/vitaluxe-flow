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
import { AddStaffDialog } from "./AddStaffDialog";
import { StaffDetailsDialog } from "./StaffDetailsDialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const StaffDataTable = () => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const { data: staff, isLoading, refetch } = useQuery({
    queryKey: ["staff", effectiveUserId, effectiveRole],
    staleTime: 300000, // 5 minutes
    queryFn: async () => {
      // Step 1: Fetch all staff for this practice
      let staffQuery = supabase
        .from("practice_staff")
        .select("*")
        .order("created_at", { ascending: false });
      
      // If doctor role, only show their own staff
      if (effectiveRole === "doctor") {
        staffQuery = staffQuery.eq("practice_id", effectiveUserId);
      }
      
      const { data: staffData, error: staffError } = await staffQuery;
      if (staffError) throw staffError;

      if (!staffData || staffData.length === 0) {
        return [];
      }

      // Step 2: Fetch all user profiles for these staff members
      const userIds = staffData.map(s => s.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, staff_role_type")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Step 3: Fetch practice information
      const practiceIds = [...new Set(staffData.map(s => s.practice_id))];
      const { data: practicesData, error: practicesError } = await supabase
        .from("profiles")
        .select("id, name, company")
        .in("id", practiceIds);

      if (practicesError) throw practicesError;

      // Step 4: Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const practicesMap = new Map(practicesData?.map(p => [p.id, p]) || []);

      // Step 5: Merge the data
      const enrichedStaff = staffData.map(staffMember => ({
        ...staffMember,
        profiles: profilesMap.get(staffMember.user_id) || null,
        practice: practicesMap.get(staffMember.practice_id) || null,
      }));

      return enrichedStaff;
    },
    enabled: !!effectiveUserId
  });

  const toggleStatus = async (staffId: string, currentStatus: boolean) => {
    const { data, error } = await supabase.functions.invoke('manage-staff-status', {
      body: { staffId, active: !currentStatus }
    });

    const serverMessage = (error as any)?.message || (typeof data === 'object' && (data as any)?.error);
    if (error || serverMessage) {
      toast.error(serverMessage || 'Failed to update staff status');
      return;
    }

    toast.success(currentStatus ? 'Staff member deactivated' : 'Staff member activated');
    refetch();
  };

  const filteredStaff = staff?.filter((staffMember) =>
    staffMember.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staffMember.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staffMember.role_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staffMember.practice?.name?.toLowerCase().includes(searchQuery.toLowerCase())
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
    totalItems: filteredStaff?.length || 0,
    itemsPerPage: 25
  });

  const paginatedStaff = filteredStaff?.slice(startIndex, endIndex);

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading staff...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1000px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Practice</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff && filteredStaff.length > 0 ? (
              paginatedStaff?.map((staffMember) => (
                <TableRow key={staffMember.id}>
                  <TableCell className="font-medium">{staffMember.profiles?.name}</TableCell>
                  <TableCell>{staffMember.practice?.name || staffMember.practice?.company}</TableCell>
                  <TableCell>{staffMember.profiles?.email}</TableCell>
                  <TableCell>{staffMember.profiles?.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{staffMember.role_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={staffMember.active ? "default" : "secondary"}>
                      {staffMember.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedStaff(staffMember);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={staffMember.active}
                        onCheckedChange={() => toggleStatus(staffMember.id, staffMember.active)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No staff members found. Add your first staff member to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {filteredStaff && filteredStaff.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredStaff.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredStaff.length)}
        />
      )}

      <AddStaffDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refetch}
      />

      {selectedStaff && (
        <StaffDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          staff={selectedStaff}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};
