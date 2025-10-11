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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Eye, Power, PowerOff } from "lucide-react";
import { AddAccountDialog } from "./AddAccountDialog";
import { AccountDetailsDialog } from "./AccountDetailsDialog";
import { DataSyncButton } from "./DataSyncButton";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const AccountsDataTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ["accounts", roleFilter],
    queryFn: async () => {
      // First, get all profiles with their roles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles(role),
          parent:profiles!parent_id(id, name, email),
          linked_topline:profiles!linked_topline_id(id, name, email)
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Then, get all providers to identify which user_ids are providers
      const { data: providersData, error: providersError } = await supabase
        .from("providers")
        .select("user_id, practice_id, id");

      if (providersError) throw providersError;

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

      // Create a Set of provider user_ids for quick lookup
      const providerUserIds = new Set(providersData?.map(p => p.user_id) || []);

      // Create a map of toplines for quick lookup by user_id
      const toplineMap = new Map(
        (toplinesData || []).map(t => [t.id, { id: t.id, name: t.name, email: t.email }])
      );

      // Enrich profiles data with provider information and computed topline display
      const enrichedData = profilesData?.map(profile => ({
        ...profile,
        isProvider: providerUserIds.has(profile.id),
        linked_topline_display: profile.linked_topline_id ? toplineMap.get(profile.linked_topline_id) : null,
      }));

      // Debug logging for data verification
      console.log('Sample account data:', enrichedData?.[0]);

      return enrichedData;
    },
  });

  const getDisplayRole = (account: any): string => {
    const baseRole = account.user_roles?.[0]?.role;
    
    if (baseRole === 'doctor') {
      return account.isProvider ? 'provider' : 'practice';
    }
    
    return baseRole || 'No role';
  };

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !currentStatus })
      .eq("id", accountId);

    if (!error) {
      refetch();
    }
  };

  const filteredAccounts = accounts?.filter((account) => {
    const matchesSearch = account.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const displayRole = getDisplayRole(account);
    const matchesRole = roleFilter === "all" || displayRole === roleFilter;
    
    return matchesSearch && matchesRole;
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
      topline: "bg-muted text-muted-foreground",
      downline: "bg-card text-card-foreground",
    };
    return colors[role] || "bg-muted";
  };

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
          <DataSyncButton onSyncComplete={() => refetch()} />
          <Button onClick={() => setAddDialogOpen(true)}>
            Add Account
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="min-w-[1400px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAccounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              paginatedAccounts?.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
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
                  <TableCell>{account.company || "-"}</TableCell>
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
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAccountStatus(account.id, account.active)}
                      >
                        {account.active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
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
    </div>
  );
};
