import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ImageIcon, RefreshCw, CheckCircle, XCircle, Loader2, ImagePlus } from "lucide-react";

interface ProductWithImage {
  id: string;
  name: string;
  dosage_form: string | null;
  image_url: string | null;
  active: boolean;
}

type GenerationStatus = "idle" | "generating" | "success" | "failed";

export function ProductImageGenerator() {
  const queryClient = useQueryClient();
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ generated: 0, failed: 0, total: 0 });
  const [singleGenerating, setSingleGenerating] = useState<Record<string, GenerationStatus>>({});

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-product-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, dosage_form, image_url, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as ProductWithImage[];
    },
  });

  const missingCount = products.filter((p) => !p.image_url).length;
  const withImageCount = products.filter((p) => p.image_url).length;
  const totalCount = products.length;

  const generateSingleImage = useCallback(async (product: ProductWithImage) => {
    setSingleGenerating((prev) => ({ ...prev, [product.id]: "generating" }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-image", {
        body: { productName: product.name, dosageForm: product.dosage_form || "injection" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Generation failed");

      // Update local cache
      await supabase
        .from("products")
        .update({ image_url: data.imageUrl })
        .eq("id", product.id);

      setSingleGenerating((prev) => ({ ...prev, [product.id]: "success" }));
      queryClient.invalidateQueries({ queryKey: ["admin-product-images"] });
      toast({ title: "Image generated", description: `Generated image for ${product.name}` });
    } catch (err: any) {
      setSingleGenerating((prev) => ({ ...prev, [product.id]: "failed" }));
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }
  }, [queryClient]);

  const runBatchGeneration = useCallback(async () => {
    setBatchRunning(true);
    setBatchProgress({ generated: 0, failed: 0, total: missingCount });

    let startFrom = 0;
    let totalGenerated = 0;
    let totalFailed = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("batch-generate-product-images", {
          body: { batchSize: 5, startFrom },
        });

        if (error) throw error;

        totalGenerated += data.imagesGenerated || 0;
        totalFailed += data.imagesFailed || 0;
        hasMore = data.hasMore || false;
        startFrom = data.nextStartFrom || 0;

        setBatchProgress({ generated: totalGenerated, failed: totalFailed, total: missingCount });

        if (data.errors?.length) {
          console.warn("Batch errors:", data.errors);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin-product-images"] });
      toast({
        title: "Batch complete",
        description: `Generated ${totalGenerated} images. ${totalFailed} failed.`,
      });
    } catch (err: any) {
      toast({ title: "Batch failed", description: err.message, variant: "destructive" });
    } finally {
      setBatchRunning(false);
    }
  }, [missingCount, queryClient]);

  const progressPercent =
    batchProgress.total > 0
      ? Math.round(((batchProgress.generated + batchProgress.failed) / batchProgress.total) * 100)
      : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Loading products…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            AI Product Image Generator
          </CardTitle>
          <CardDescription>
            Generate professional pharmaceutical product images using AI. Images are created with medication names visible on labels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              {totalCount} total products
            </Badge>
            <Badge variant="default" className="text-sm py-1 px-3">
              {withImageCount} with images
            </Badge>
            {missingCount > 0 && (
              <Badge variant="destructive" className="text-sm py-1 px-3">
                {missingCount} missing images
              </Badge>
            )}
          </div>

          {missingCount > 0 && (
            <div className="space-y-3">
              <Button
                onClick={runBatchGeneration}
                disabled={batchRunning}
                className="gap-2"
              >
                {batchRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {batchRunning ? "Generating…" : `Generate All ${missingCount} Missing Images`}
              </Button>

              {batchRunning && (
                <div className="space-y-2">
                  <Progress value={progressPercent} className="h-3" />
                  <p className="text-sm text-muted-foreground">
                    {batchProgress.generated} generated, {batchProgress.failed} failed of {batchProgress.total} total
                    {" · "}{progressPercent}%
                  </p>
                </div>
              )}
            </div>
          )}

          {missingCount === 0 && (
            <p className="text-sm text-primary font-medium">✓ All products have images</p>
          )}
        </CardContent>
      </Card>

      {/* Product Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Product Images</CardTitle>
          <CardDescription>Click regenerate to create a new AI image for any product</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {products.map((product) => {
              const status = singleGenerating[product.id] || "idle";
              return (
                <div
                  key={product.id}
                  className="border border-border rounded-lg overflow-hidden bg-card"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    )}
                    {status === "generating" && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    {status === "success" && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    {status === "failed" && (
                      <div className="absolute top-1 right-1">
                        <XCircle className="h-5 w-5 text-destructive" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-medium truncate" title={product.name}>
                      {product.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {product.dosage_form || "—"}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs gap-1"
                      disabled={status === "generating" || batchRunning}
                      onClick={() => generateSingleImage(product)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {product.image_url ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
