import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useResponsive } from "@/hooks/use-mobile";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Eye, Power, PowerOff, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddAccountDialog } from "./AddAccountDialog";
import { AccountDetailsDialog } from "./AccountDetailsDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useAuth } from "@/contexts/AuthContext";

export const AccountsDataTable = () => {
  const { toast } = useToast();
  const { effectiveRole } = useAuth();
  const { isMobile } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ["accounts", roleFilter],
    enabled: !!effectiveRole,
    staleTime: 300000, // 5 minutes - user accounts change infrequently
    queryFn: async () => {
      // First, get all profiles with their roles and patient accounts - only select needed fields
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id, name, email, active, created_at, parent_id, linked_topline_id,
          user_roles(role),
          parent:profiles!parent_id(id, name, email),
          linked_topline:profiles!linked_topline_id(id, name, email),
          patient_accounts(first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Then, get all practice_users to identify which user_ids are providers
      const { data: practiceUsersData, error: practiceUsersError } = await supabase
        .from("practice_users")
        .select("user_id, practice_id, id, role_in_practice");

      if (practiceUsersError) throw practiceUsersError;

      // Fetch all active topline profiles for reliable parent display
      const { data: toplinesData } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "topline")
        .eq("active", true);

      // Fetch all reps to understand downline->topline relationships
      const { data: repsData } = await supabase
        .from("reps")
        .select(`
          id,
          user_id,
          role,
          assigned_topline_id
        `);

      // Create a Set of provider user_ids for quick lookup
      const providerUserIds = new Set(
        (practiceUsersData || [])
          .filter(pu => pu.role_in_practice === 'PROVIDER')
          .map(pu => pu.user_id)
      );

      // Create a map of toplines for quick lookup by user_id
      const toplineMap = new Map(
        (toplinesData || []).map(t => [t.id, { id: t.id, name: t.name, email: t.email }])
      );

      // Create a map to resolve downline -> topline
      const downlineToToplineMap = new Map();
      repsData?.forEach(rep => {
        if (rep.role === 'downline' && rep.assigned_topline_id) {
          // Find the topline rep record
          const toplineRep = repsData?.find(r => r.id === rep.assigned_topline_id);
          if (toplineRep?.user_id) {
            // Get the topline profile from the toplineMap
            const toplineProfile = toplineMap.get(toplineRep.user_id);
            if (toplineProfile) {
              downlineToToplineMap.set(rep.user_id, toplineProfile);
            }
          }
        }
      });

      // Enrich profiles data with provider information and computed topline display
      const enrichedData = profilesData?.map(profile => {
        let resolvedTopline = null;
        
        if (profile.linked_topline_id) {
          // First check if it's directly a topline
          resolvedTopline = toplineMap.get(profile.linked_topline_id);
          
          // If not found in toplineMap, check if it's a downline rep
          if (!resolvedTopline) {
            resolvedTopline = downlineToToplineMap.get(profile.linked_topline_id);
          }
        }
        
        return {
          ...profile,
          // Only mark as provider if they have a provider record where user_id !== practice_id
          // This excludes self-referential provider records (which represent practices)
          isProvider: providersData?.some(
            p => p.user_id === profile.id && p.user_id !== p.practice_id
          ) || false,
          linked_topline_display: resolvedTopline,
        };
      });


      return enrichedData;
    },
  });

  const getDisplayRole = (account: any): string => {
    const baseRole = account.user_roles?.[0]?.role;
    
    if (baseRole === 'doctor') {
      return account.isProvider ? 'provider' : 'practice';
    }
    
    // Fallback: Check if user has patient_accounts entry
    if (!baseRole && account.patient_accounts && account.patient_accounts.length > 0) {
      return 'patient';
    }
    
    return baseRole || 'No role';
  };

  const getDisplayName = (account: any): string => {
    // If name is 'New User' and patient_accounts exists, use patient name
    if ((account.name === 'New User' || !account.name) && 
        account.patient_accounts && 
        account.patient_accounts.length > 0) {
      const patientAccount = account.patient_accounts[0];
      return `${patientAccount.first_name} ${patientAccount.last_name}`.trim();
    }
    return account.name || 'Unknown';
  };

  const cleanupMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('cleanup-test-data', {
        body: { 
          email,
          pendingPracticeId: null
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Cleanup failed');
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
      refetch();
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const toggleAccountStatus = useCallback(async (accountId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !currentStatus })
      .eq("id", accountId);

    if (!error) {
      refetch();
    }
  }, [refetch]);

  const handleDeleteClick = useCallback((account: any) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = () => {
    if (accountToDelete?.email) {
      cleanupMutation.mutate(accountToDelete.email);
    }
  };

  const filteredAccounts = useMemo(() => accounts?.filter((account) => {
    const matchesSearch = account.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const displayRole = getDisplayRole(account);
    const matchesRole = roleFilter === "all" || displayRole === roleFilter;
    
    return matchesSearch && matchesRole;
  }), [accounts, searchQuery, roleFilter]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredAccounts?.length || 0,
    itemsPerPage: 25
  });

  const paginatedAccounts = filteredAccounts?.slice(startIndex, endIndex);

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-accent text-accent-foreground",
      practice: "bg-primary text-primary-foreground",
      provider: "bg-primary/80 text-primary-foreground",
      pharmacy: "bg-secondary text-secondary-foreground",
      topline: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
      downline: "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    };
    return colors[role] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  };

  // Don't run queries until auth is ready
  if (!effectiveRole) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Verifying authentication...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="practice">Practice</SelectItem>
              <SelectItem value="provider">Provider</SelectItem>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
              <SelectItem value="topline">Topline Rep</SelectItem>
              <SelectItem value="downline">Downline Rep</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setAddDialogOpen(true)}>
            Add Account
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        {isMobile ? (
          // Mobile Card View
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredAccounts?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No accounts found</div>
            ) : (
              paginatedAccounts?.map((account) => (
                <Card key={account.id} className="border-0 rounded-none shadow-none">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="font-medium text-base truncate">{getDisplayName(account)}</div>
                        <div className="text-sm text-muted-foreground truncate">{account.email}</div>
                      </div>
                      <Badge className={getRoleBadgeColor(getDisplayRole(account))}>
                        {getDisplayRole(account)}
                      </Badge>
                    </div>
                    
                    {((account.user_roles?.[0]?.role === 'downline' || getDisplayRole(account) === 'practice') && 
                      (account.linked_topline_display?.name || account.linked_topline?.name)) ||
                      account.parent ? (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Parent: </span>
                        <span className="text-foreground">
                          {(account.user_roles?.[0]?.role === 'downline' || getDisplayRole(account) === 'practice') ? (
                            account.linked_topline_display?.name || account.linked_topline?.name || "-"
                          ) : (
                            account.parent?.name || "-"
                          )}
                        </span>
                      </div>
                    ) : null}
                    
                    <div className="flex items-center justify-between pt-2">
                      <Badge variant={account.active ? "default" : "secondary"}>
                        {account.active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(account);
                            setDetailsOpen(true);
                          }}
                          className="h-9 w-9 p-0"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAccountStatus(account.id, account.active)}
                          className="h-9 w-9 p-0"
                          title={account.active ? "Disable Account" : "Enable Account"}
                        >
                          {account.active ? (
                            <PowerOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Power className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(account)}
                          disabled={cleanupMutation.isPending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                          title="Delete Account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          // Desktop/Tablet Table View
          <div className="min-w-[1200px]">
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Parent</TableHead>
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
            ) : filteredAccounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              paginatedAccounts?.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{getDisplayName(account)}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(getDisplayRole(account))}>
                      {getDisplayRole(account)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(account.user_roles?.[0]?.role === 'downline' || getDisplayRole(account) === 'practice') ? (
                      account.linked_topline_display?.name ? (
                        <span className="text-sm">{account.linked_topline_display.name}</span>
                      ) : account.linked_topline?.name ? (
                        <span className="text-sm">{account.linked_topline.name}</span>
                      ) : (
                        "-"
                      )
                    ) : account.parent ? (
                      <span className="text-sm">{account.parent.name}</span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.active ? "default" : "secondary"}>
                      {account.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAccount(account);
                          setDetailsOpen(true);
                        }}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAccountStatus(account.id, account.active)}
                        title={account.active ? "Disable Account" : "Enable Account"}
                      >
                        {account.active ? (
                          <PowerOff className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Power className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(account)}
                        disabled={cleanupMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete Account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        )}
      </div>

      {filteredAccounts && filteredAccounts.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredAccounts.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredAccounts.length)}
        />
      )}

      <AddAccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => refetch()}
      />

      {selectedAccount && (
        <AccountDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          account={selectedAccount}
          onSuccess={() => refetch()}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this account? This will permanently remove:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The user's authentication account</li>
                <li>Their profile data</li>
                <li>Any associated records</li>
              </ul>
              <p className="mt-2 font-semibold">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={cleanupMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cleanupMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
