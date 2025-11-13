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
import { toast } from "sonner";

interface AddProductTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddProductTypeDialog = ({
  open,
  onOpenChange,
}: AddProductTypeDialogProps) => {
  const [typeName, setTypeName] = useState("");
  const queryClient = useQueryClient();

  const addTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke("manage-product-type", {
        body: { operation: "add", typeName: name },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Product type added successfully");
      queryClient.invalidateQueries({ queryKey: ["product-type-usage"] });
      setTypeName("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add product type");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = typeName.trim();
    
    if (!trimmed) {
      toast.error("Product type name cannot be empty");
      return;
    }

    if (trimmed.length > 50) {
      toast.error("Product type name must be less than 50 characters");
      return;
    }

    addTypeMutation.mutate(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Product Type</DialogTitle>
          <DialogDescription>
            Create a new product category. This will be available for selection when creating or editing products.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="typeName">Product Type Name</Label>
              <Input
                id="typeName"
                placeholder="e.g., Supplements"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
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
            <Button type="submit" disabled={addTypeMutation.isPending}>
              {addTypeMutation.isPending ? "Adding..." : "Add Type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
