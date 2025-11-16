import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const AccountSecurityManager = () => {
  const { data: lockouts, isLoading, refetch } = useQuery({
    queryKey: ["account-lockouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_lockouts")
        .select("*")
        .is("unlocked_at", null)
        .order("locked_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = usePagination({
    totalItems: lockouts?.length || 0,
    itemsPerPage: 25,
  });

  const paginatedLockouts = lockouts?.slice(startIndex, endIndex);

  const handleUnlock = async (lockoutId: string) => {
    const { error } = await supabase
      .from("account_lockouts")
      .update({
        unlocked_at: new Date().toISOString(),
        unlocked_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", lockoutId);

    if (error) {
      toast.error("Failed to unlock account");
      return;
    }

    toast.success("Account unlocked successfully");
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Account Security & Lockouts
        </CardTitle>
        <CardDescription>
          Manage locked accounts, IP blocks, and security settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : lockouts && lockouts.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Locked At</TableHead>
                  <TableHead>Locked Until</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLockouts?.map((lockout) => (
                  <TableRow key={lockout.id}>
                    <TableCell className="font-medium">{lockout.user_email}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{lockout.lockout_reason}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {lockout.ip_address || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(lockout.locked_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lockout.locked_until
                        ? new Date(lockout.locked_until).toLocaleString()
                        : "Permanent"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlock(lockout.id)}
                        className="gap-2"
                      >
                        <Unlock className="h-4 w-4" />
                        Unlock
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              hasNextPage={hasNextPage}
              hasPrevPage={hasPrevPage}
              totalItems={lockouts?.length || 0}
              startIndex={startIndex}
              endIndex={endIndex}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Lock className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No Locked Accounts</p>
            <p className="text-sm">
              No accounts are currently locked due to security reasons.
              <br />
              Accounts can be locked automatically after repeated failed login attempts.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
