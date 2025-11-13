import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

const COLOR_OPTIONS = [
  { value: "bg-muted text-muted-foreground", label: "Gray" },
  { value: "bg-primary text-primary-foreground", label: "Primary" },
  { value: "bg-secondary text-secondary-foreground", label: "Secondary" },
  { value: "bg-accent text-accent-foreground", label: "Accent" },
  { value: "bg-destructive text-destructive-foreground", label: "Destructive" },
  { value: "bg-blue-500 text-white", label: "Blue" },
  { value: "bg-green-500 text-white", label: "Green" },
  { value: "bg-amber-500 text-white", label: "Amber" },
  { value: "bg-purple-500 text-white", label: "Purple" },
];

export const OrderStatusManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<any>(null);
  const [formData, setFormData] = useState({
    status_key: "",
    display_name: "",
    description: "",
    color_class: "bg-muted text-muted-foreground",
    sort_order: 10,
    is_active: true,
  });

  const { data: statusConfigs, isLoading } = useQuery({
    queryKey: ["order-status-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_configs")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      return data;
    },
  });

  const createStatusMutation = useMutation({
    mutationFn: async (statusConfig: any) => {
      const { data, error } = await supabase.functions.invoke("manage-status-configs", {
        body: { operation: "create", statusConfig },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-status-configs"] });
      toast({ title: "Status created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (statusConfig: any) => {
      const { data, error } = await supabase.functions.invoke("manage-status-configs", {
        body: { operation: "update", statusConfig },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-status-configs"] });
      toast({ title: "Status updated successfully" });
      setDialogOpen(false);
      setEditingStatus(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("manage-status-configs", {
        body: { operation: "delete", statusConfig: { id } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-status-configs"] });
      toast({ title: "Status deactivated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      status_key: "",
      display_name: "",
      description: "",
      color_class: "bg-muted text-muted-foreground",
      sort_order: 10,
      is_active: true,
    });
  };

  const handleEdit = (status: any) => {
    setEditingStatus(status);
    setFormData({
      status_key: status.status_key,
      display_name: status.display_name,
      description: status.description || "",
      color_class: status.color_class,
      sort_order: status.sort_order,
      is_active: status.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingStatus) {
      updateStatusMutation.mutate({ ...formData, id: editingStatus.id });
    } else {
      createStatusMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Order Status Management</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingStatus(null); resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Status
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingStatus ? "Edit" : "Create"} Order Status</DialogTitle>
              <DialogDescription>
                {editingStatus ? "Update" : "Create a new"} custom order status configuration
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status_key">Status Key</Label>
                  <Input
                    id="status_key"
                    value={formData.status_key}
                    onChange={(e) => setFormData({ ...formData, status_key: e.target.value })}
                    placeholder="e.g., on_hold"
                    required
                    disabled={!!editingStatus}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="e.g., On Hold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this status"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color_class">Color</Label>
                  <Select
                    value={formData.color_class}
                    onValueChange={(value) => setFormData({ ...formData, color_class: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <Badge className={option.value}>{option.label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingStatus ? "Update" : "Create"} Status
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Sort Order</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>System</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statusConfigs?.map((status) => (
            <TableRow key={status.id}>
              <TableCell className="font-medium">{status.display_name}</TableCell>
              <TableCell className="text-muted-foreground">{status.description || "—"}</TableCell>
              <TableCell>
                <Badge className={status.color_class}>{status.status_key}</Badge>
              </TableCell>
              <TableCell>{status.sort_order}</TableCell>
              <TableCell>
                <Badge variant={status.is_active ? "default" : "secondary"}>
                  {status.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                {status.is_system_default && <Badge variant="outline">System</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(status)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!status.is_system_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteStatusMutation.mutate(status.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};