import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export function RepsManagement() {
  const queryClient = useQueryClient();

  const { data: reps, isLoading } = useQuery({
    queryKey: ["all-reps"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            phone,
            company
          ),
          topline:assigned_topline_id (
            id,
            profiles:user_id (name)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: repStats } = useQuery({
    queryKey: ["rep-stats"],
    staleTime: 0,
    queryFn: async () => {
      const { count: toplineCount } = await supabase
        .from("reps")
        .select("*", { count: 'exact', head: true })
        .eq("role", "topline")
        .eq("active", true);
      
      const { count: downlineCount } = await supabase
        .from("reps")
        .select("*", { count: 'exact', head: true })
        .eq("role", "downline")
        .eq("active", true);
      
      return {
        toplineCount: toplineCount || 0,
        downlineCount: downlineCount || 0,
      };
    },
  });

  const toggleRepStatus = useMutation({
    mutationFn: async ({ repId, currentStatus }: { repId: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from("reps")
        .update({ active: !currentStatus })
        .eq("id", repId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reps"] });
      queryClient.invalidateQueries({ queryKey: ["rep-stats"] });
      toast.success("Rep status updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update rep status");
      console.error(error);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Representatives Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage topline and downline sales representatives
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Rep
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Topline Reps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repStats?.toplineCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Downline Reps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repStats?.downlineCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Representatives</CardTitle>
        </CardHeader>
        <CardContent>
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
              ) : reps?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No representatives found
                  </TableCell>
                </TableRow>
              ) : (
                reps?.map((rep: any) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">
                      {rep.profiles?.name || "-"}
                    </TableCell>
                    <TableCell>{rep.profiles?.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={rep.role === 'topline' ? 'default' : 'secondary'}>
                        {rep.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rep.role === 'downline' && rep.topline
                        ? rep.topline.profiles?.name || "Unknown"
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rep.active ? 'default' : 'secondary'}>
                        {rep.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleRepStatus.mutate({
                          repId: rep.id,
                          currentStatus: rep.active,
                        })}
                      >
                        {rep.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
