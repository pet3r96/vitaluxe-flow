import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const ToplineProductVisibilityManager = () => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);

  // Only topline reps can access this component
  if (effectiveRole !== "topline") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Only topline representatives can manage product visibility.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get current rep's ID
  const { data: repData } = useQuery({
    queryKey: ["current-rep", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("id")
        .eq("user_id", effectiveUserId)
        .eq("role", "topline")
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Get all products with visibility settings
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-with-visibility", repData?.id],
    enabled: !!repData?.id,
    queryFn: async () => {
      const { data: allProducts, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          dosage,
          active,
          product_types(name)
        `)
        .eq("active", true)
        .order("name");

      if (productsError) throw productsError;

      // Get visibility settings
      const { data: visibilitySettings, error: visError } = await supabase
        .from("rep_product_visibility" as any)
        .select("product_id, visible") as any;

      if (visError) throw visError;

      // Filter by topline_rep_id manually since types aren't updated yet
      const filteredSettings = visibilitySettings?.filter((v: any) => v.topline_rep_id === repData.id) || [];

      // Merge visibility data
      const visibilityMap = new Map<string, boolean>(
        filteredSettings.map((v: any) => [v.product_id, v.visible as boolean])
      );

      return allProducts.map(product => ({
        ...product,
        visible: visibilityMap.get(product.id) ?? true, // Default to visible
      })) as Array<{
        id: string;
        name: string;
        dosage: string | null;
        active: boolean;
        product_types: { name: string } | null;
        visible: boolean;
      }>;
    },
  });

  // Toggle visibility mutation
  const toggleVisibility = useMutation({
    mutationFn: async ({ productId, currentVisible }: { productId: string; currentVisible: boolean }) => {
      const { error } = await supabase
        .from("rep_product_visibility" as any)
        .upsert({
          topline_rep_id: repData!.id,
          product_id: productId,
          visible: !currentVisible,
          updated_at: new Date().toISOString(),
        } as any, {
          onConflict: "topline_rep_id,product_id"
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-with-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product visibility updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update visibility");
    },
  });

  // Reset all to visible
  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      // Delete all visibility records for this topline (defaults to visible)
      const { error } = await supabase
        .from("rep_product_visibility" as any)
        .delete()
        .eq("topline_rep_id", repData!.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["products-with-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("All products set to visible");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset visibility");
    } finally {
      setIsResetting(false);
    }
  };

  const visibleCount = products?.filter(p => p.visible).length || 0;
  const hiddenCount = products?.filter(p => !p.visible).length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Product Visibility Control</CardTitle>
            <CardDescription>
              Control which products your network can see and order
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {visibleCount} Visible
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <EyeOff className="h-3 w-3" />
                {hiddenCount} Hidden
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={isResetting || hiddenCount === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Show All Products
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading products...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Dosage</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.dosage || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {product.product_types?.name || "Uncategorized"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {product.visible ? (
                        <Badge variant="default" className="gap-1">
                          <Eye className="h-3 w-3" />
                          Visible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <EyeOff className="h-3 w-3" />
                          Hidden
                        </Badge>
                      )}
                      <Switch
                        checked={product.visible}
                        onCheckedChange={() =>
                          toggleVisibility.mutate({
                            productId: product.id,
                            currentVisible: product.visible,
                          })
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
