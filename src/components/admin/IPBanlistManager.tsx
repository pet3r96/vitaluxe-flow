import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { ShieldBan, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface IPBan {
  id: string;
  ip_address: string;
  description: string | null;
  banned_reason: string;
  banned: boolean;
  banned_by: string | null;
  banned_at: string;
  created_at: string;
  updated_at: string;
  banned_by_profile?: {
    name: string;
    email: string;
  };
}

interface IPBanFormData {
  ip_address: string;
  description: string;
  banned_reason: string;
  banned: boolean;
}

export function IPBanlistManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBan, setSelectedBan] = useState<IPBan | null>(null);
  const [formData, setFormData] = useState<IPBanFormData>({
    ip_address: "",
    description: "",
    banned_reason: "",
    banned: true,
  });
  const [currentIP, setCurrentIP] = useState<string | null>(null);

  // Fetch current user's IP
  useQuery({
    queryKey: ["current-user-ip"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_ip");
      if (error) throw error;
      setCurrentIP(data);
      return data;
    },
  });

  // Fetch ban list
  const { data: banList, isLoading } = useQuery({
    queryKey: ["admin-ip-banlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_ip_banlist")
        .select("*")
        .order("banned_at", { ascending: false });

      if (error) throw error;

      // Fetch profile names separately for banned_by users
      if (data && data.length > 0) {
        const userIds = data
          .map((ban) => ban.banned_by)
          .filter((id): id is string => id !== null);

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds);

          // Merge profile data
          return data.map((ban) => ({
            ...ban,
            banned_by_profile: profiles?.find((p) => p.id === ban.banned_by),
          })) as IPBan[];
        }
      }

      return data as IPBan[];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const resetForm = () => {
    setFormData({
      ip_address: "",
      description: "",
      banned_reason: "",
      banned: true,
    });
  };

  const handleAdd = async () => {
    if (!formData.ip_address || !formData.banned_reason) {
      toast.error("IP address and reason are required");
      return;
    }

    // Warn if banning own IP
    if (formData.ip_address === currentIP) {
      toast.warning("⚠️ You are about to ban your own IP address!");
    }

    const { error } = await supabase.from("admin_ip_banlist").insert({
      ip_address: formData.ip_address,
      banned_reason: formData.banned_reason,
      description: formData.description || null,
      banned: formData.banned,
      banned_by: user?.id,
    });

    if (error) {
      toast.error(`Failed to add IP ban: ${error.message}`);
    } else {
      toast.success("IP address banned successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-ip-banlist"] });
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  const handleEdit = async () => {
    if (!selectedBan) return;

    if (!formData.ip_address || !formData.banned_reason) {
      toast.error("IP address and reason are required");
      return;
    }

    // Warn if banning own IP
    if (formData.ip_address === currentIP && formData.banned) {
      toast.warning("⚠️ You are about to ban your own IP address!");
    }

    const { error } = await supabase
      .from("admin_ip_banlist")
      .update({
        ip_address: formData.ip_address,
        banned_reason: formData.banned_reason,
        description: formData.description || null,
        banned: formData.banned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedBan.id);

    if (error) {
      toast.error(`Failed to update IP ban: ${error.message}`);
    } else {
      toast.success("IP ban updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-ip-banlist"] });
      setIsEditDialogOpen(false);
      setSelectedBan(null);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!selectedBan) return;

    const { error } = await supabase
      .from("admin_ip_banlist")
      .delete()
      .eq("id", selectedBan.id);

    if (error) {
      toast.error(`Failed to delete IP ban: ${error.message}`);
    } else {
      toast.success("IP ban removed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-ip-banlist"] });
      setIsDeleteDialogOpen(false);
      setSelectedBan(null);
    }
  };

  const openEditDialog = (ban: IPBan) => {
    setSelectedBan(ban);
    setFormData({
      ip_address: ban.ip_address,
      description: ban.description || "",
      banned_reason: ban.banned_reason,
      banned: ban.banned,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (ban: IPBan) => {
    setSelectedBan(ban);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Current IP Display */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Your Current IP Address</AlertTitle>
        <AlertDescription>
          {currentIP ? (
            <code className="px-2 py-1 rounded bg-muted">{currentIP}</code>
          ) : (
            "Loading..."
          )}
          <span className="ml-2 text-xs text-muted-foreground">
            Be careful not to ban your own IP address
          </span>
        </AlertDescription>
      </Alert>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldBan className="h-5 w-5" />
                IP Ban List
              </CardTitle>
              <CardDescription>
                Manage banned IP addresses. By default, all IPs have access unless explicitly banned.
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add IP Ban
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading IP ban list...
            </div>
          ) : !banList || banList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No IP addresses banned. All IPs have access by default.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Banned By</TableHead>
                    <TableHead>Banned At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banList.map((ban) => (
                    <TableRow key={ban.id}>
                      <TableCell>
                        <code className="px-2 py-1 rounded bg-muted text-sm">
                          {ban.ip_address}
                        </code>
                        {ban.ip_address === currentIP && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Your IP
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {ban.description || "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {ban.banned_reason}
                      </TableCell>
                      <TableCell>
                        {ban.banned_by_profile?.name || ban.banned_by_profile?.email || "System"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ban.banned_at), "PPp")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ban.banned ? "destructive" : "outline"}>
                          {ban.banned ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(ban)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(ban)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add IP Ban</DialogTitle>
            <DialogDescription>
              Ban an IP address from accessing sensitive features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip_address">IP Address *</Label>
              <Input
                id="ip_address"
                placeholder="192.168.1.1"
                value={formData.ip_address}
                onChange={(e) =>
                  setFormData({ ...formData, ip_address: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banned_reason">Reason *</Label>
              <Textarea
                id="banned_reason"
                placeholder="Reason for banning this IP"
                value={formData.banned_reason}
                onChange={(e) =>
                  setFormData({ ...formData, banned_reason: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="banned"
                checked={formData.banned}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, banned: checked })
                }
              />
              <Label htmlFor="banned">Banned (active)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Ban</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit IP Ban</DialogTitle>
            <DialogDescription>
              Update the IP ban details or toggle its status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_ip_address">IP Address *</Label>
              <Input
                id="edit_ip_address"
                placeholder="192.168.1.1"
                value={formData.ip_address}
                onChange={(e) =>
                  setFormData({ ...formData, ip_address: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Input
                id="edit_description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_banned_reason">Reason *</Label>
              <Textarea
                id="edit_banned_reason"
                placeholder="Reason for banning this IP"
                value={formData.banned_reason}
                onChange={(e) =>
                  setFormData({ ...formData, banned_reason: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_banned"
                checked={formData.banned}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, banned: checked })
                }
              />
              <Label htmlFor="edit_banned">Banned (active)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Update Ban</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the IP ban for{" "}
              <code className="px-2 py-1 rounded bg-muted">
                {selectedBan?.ip_address}
              </code>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
