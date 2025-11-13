import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface EditProductTypeDialogProps {
  typeName: string;
  productCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditProductTypeDialog = ({
  typeName,
  productCount,
  open,
  onOpenChange,
}: EditProductTypeDialogProps) => {
  const [newTypeName, setNewTypeName] = useState(typeName);
  const queryClient = useQueryClient();

  const updateTypeMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-product-type", {
        body: { operation: "update", oldTypeName: oldName, newTypeName: newName },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Product type updated successfully");
      queryClient.invalidateQueries({ queryKey: ["product-type-usage"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update product type");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTypeName.trim();
    
    if (!trimmed) {
      toast.error("Product type name cannot be empty");
      return;
    }

    if (trimmed.length > 50) {
      toast.error("Product type name must be less than 50 characters");
      return;
    }

    if (trimmed === typeName) {
      toast.error("New name must be different from current name");
      return;
    }

    updateTypeMutation.mutate({ oldName: typeName, newName: trimmed });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Product Type</DialogTitle>
          <DialogDescription>
            Rename this product category. All products using this type will be automatically updated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {productCount > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will update {productCount} product{productCount !== 1 ? "s" : ""} currently using "{typeName}".
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentTypeName">Current Name</Label>
              <Input
                id="currentTypeName"
                value={typeName}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTypeName">New Name</Label>
              <Input
                id="newTypeName"
                placeholder="Enter new product type name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateTypeMutation.isPending}>
              {updateTypeMutation.isPending ? "Updating..." : "Update Type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
