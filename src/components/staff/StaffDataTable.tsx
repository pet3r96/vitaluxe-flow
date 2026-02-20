import { logger } from "@/lib/logger";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EdgeFunctionResponse, isEdgeFunctionError } from "@/types/edgeFunction";
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
import { useResponsive } from "@/hooks/use-mobile";
import { MobileDataTable, MobileTableRowProps } from "@/components/responsive/MobileDataTable";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { AddStaffDialog } from "./AddStaffDialog";
import { AddStaffDialog } from "./AddStaffDialog";
import { StaffDetailsDialog } from "./StaffDetailsDialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const StaffDataTable = () => {
  const { effectiveUserId, effectiveRole, effectivePracticeId } = useAuth();
  const { isMobile } = useResponsive();
  const [inputValue, setInputValue] = useState("");
  const searchQuery = useDebounce(inputValue, 300);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const { data: staff, isLoading, refetch } = useQuery({
    queryKey: ["staff", effectiveUserId, effectiveRole, effectivePracticeId],
    staleTime: 300000, // 5 minutes
    queryFn: async () => {
      logger.info('[StaffDataTable] Fetching staff via edge function', {
        effectiveUserId,
        effectiveRole,
        effectivePracticeId
      });
      
      // Use edge function to get staff with full profile data
      const { data, error } = await supabase.functions.invoke('list-staff', {
        body: effectivePracticeId ? { practice_id: effectivePracticeId } : {}
      });

      if (error) {
        logger.error('[StaffDataTable] Error from edge function', error);
        throw error;
      }

      const staffList = data?.staff || [];
      logger.info('[StaffDataTable] Received staff:', {
        count: staffList.length,
        sample: staffList[0] ? {
          id: staffList[0].id,
          hasProfile: !!staffList[0].profiles,
          fullName: staffList[0].profiles?.full_name,
          name: staffList[0].profiles?.name,
          email: staffList[0].profiles?.email
        } : null
      });
      
      // Log any missing data
      staffList.forEach((s: any, idx: number) => {
        if (!s.profiles?.full_name && !s.profiles?.name && !s.profiles?.email) {
          logger.warn('[StaffDataTable] ⚠️ Staff missing display fields:', {
            index: idx,
            staffId: s.id,
            userId: s.user_id,
            profileData: s.profiles
          });
        }
      });

      return staffList;
    },
    enabled: !!(effectiveUserId || effectivePracticeId)
  });

  const toggleStatus = async (staffUserId: string, currentStatus: boolean) => {
    const { data, error } = await supabase.functions.invoke('manage-entity-status', {
      body: { action: 'staff-status', staffId: staffUserId, active: !currentStatus }
    });

    const serverMessage = error?.message || (isEdgeFunctionError(data) ? data.error : undefined);
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
    return <TableSkeleton rows={10} columns={6} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => debouncedSetSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {isMobile ? (
        // Mobile Card View
        <div className="space-y-2 p-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading staff...</div>
          ) : !filteredStaff || filteredStaff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No staff members found</div>
          ) : (
            <MobileDataTable
              rows={paginatedStaff?.map((staffMember): MobileTableRowProps => ({
                title: staffMember.profiles?.full_name || staffMember.profiles?.name || 'Unknown',
                subtitle: staffMember.profiles?.email || 'N/A',
                fields: [
                  { label: "Practice", value: staffMember.practice?.name || staffMember.practice?.company || '-' },
                  { label: "Phone", value: staffMember.profiles?.phone || 'N/A' },
                  { label: "Role", value: staffMember.role_type, badge: true, badgeVariant: 'outline' },
                  { label: "Ordering", value: staffMember.can_order ? "Allowed" : "Restricted", badge: true, badgeVariant: staffMember.can_order ? 'default' : 'secondary' },
                  { label: "Status", value: staffMember.active ? "Active" : "Inactive", badge: true, badgeVariant: staffMember.active ? 'default' : 'secondary' }
                ],
                actions: [
                  { label: "View Details", onClick: () => { setSelectedStaff(staffMember); setDetailsDialogOpen(true); } },
                  { label: staffMember.active ? "Deactivate" : "Activate", onClick: () => toggleStatus(staffMember.user_id, staffMember.active) }
                ]
              })) || []}
              emptyMessage="No staff members found"
            />
          )}
        </div>
      ) : (
        // Desktop Table View
        <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="min-w-[1000px]">
            <Table className="table-fixed">
          <colgroup>
            <col style={{ width: '160px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '120px' }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Practice</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role Type</TableHead>
              <TableHead>Ordering</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff && filteredStaff.length > 0 ? (
              paginatedStaff?.map((staffMember) => (
                <TableRow key={staffMember.id}>
                  <TableCell className="font-medium">{staffMember.profiles?.full_name || staffMember.profiles?.name || staffMember.profiles?.email || 'Unknown'}</TableCell>
                  <TableCell>{staffMember.practice?.name || staffMember.practice?.company}</TableCell>
                  <TableCell>{staffMember.profiles?.email || 'N/A'}</TableCell>
                  <TableCell>{staffMember.profiles?.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{staffMember.role_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={staffMember.can_order ? "default" : "secondary"}>
                      {staffMember.can_order ? "Allowed" : "Restricted"}
                    </Badge>
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
                        onCheckedChange={() => toggleStatus(staffMember.user_id, staffMember.active)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No staff members found. Add your first staff member to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
          </div>
        </div>
      )}

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
