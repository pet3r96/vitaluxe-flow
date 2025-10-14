import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AddProductTypeDialog } from "./AddProductTypeDialog";
import { EditProductTypeDialog } from "./EditProductTypeDialog";
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

interface ProductTypeUsage {
  product_type: string;
  count: number;
}

export const ProductTypeManager = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch product type usage
  const { data: typeUsage, isLoading } = useQuery({
    queryKey: ["product-type-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("product_type");

      if (error) throw error;

      // Count occurrences of each type
      const counts: Record<string, number> = {};
      data?.forEach((product) => {
        if (product.product_type) {
          counts[product.product_type] = (counts[product.product_type] || 0) + 1;
        }
      });

      // Get all possible enum values by querying the database
      const allTypes = [
        "Vitamins",
        "R & D Products",
        "Peptides",
        "GLP 1",
        "GLP 2",
        "GLP 3",
        "Supplies",
        "Vitamin IV's",
      ];

      return allTypes.map((type) => ({
        product_type: type,
        count: counts[type] || 0,
      }));
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (typeName: string) => {
      const { data, error } = await supabase.functions.invoke("manage-product-type", {
        body: { operation: "delete", typeName },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Product type deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["product-type-usage"] });
      setDeletingType(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete product type");
    },
  });

  const handleDelete = (typeName: string, count: number) => {
    if (count > 0) {
      toast.error("Cannot delete product type that is in use");
      return;
    }
    setDeletingType(typeName);
  };

  const confirmDelete = () => {
    if (deletingType) {
      deleteTypeMutation.mutate(deletingType);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Product Type Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage product categories and track usage
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Type</TableHead>
              <TableHead className="text-center">Products Using</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading product types...
                </TableCell>
              </TableRow>
            ) : typeUsage && typeUsage.length > 0 ? (
              typeUsage.map((type) => (
                <TableRow key={type.product_type}>
                  <TableCell className="font-medium">
                    {type.product_type}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{type.count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={type.count > 0 ? "default" : "outline"}>
                      {type.count > 0 ? "Active" : "Unused"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingType(type.product_type)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(type.product_type, type.count)}
                      disabled={type.count > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  No product types found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddProductTypeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      {editingType && (
        <EditProductTypeDialog
          typeName={editingType}
          productCount={
            typeUsage?.find((t) => t.product_type === editingType)?.count || 0
          }
          open={!!editingType}
          onOpenChange={(open) => !open && setEditingType(null)}
        />
      )}

      <AlertDialog open={!!deletingType} onOpenChange={(open) => !open && setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the product type "{deletingType}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
