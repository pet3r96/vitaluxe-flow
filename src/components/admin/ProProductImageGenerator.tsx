import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, RefreshCw, CheckCircle, XCircle, Loader2, ImagePlus } from "lucide-react";
import { useProProducts, ProProduct } from "@/hooks/useProProductsAdmin";

type GenerationStatus = "idle" | "generating" | "success" | "failed";

export function ProProductImageGenerator() {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useProProducts();
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ generated: 0, failed: 0, total: 0 });
  const [singleGenerating, setSingleGenerating] = useState<Record<string, GenerationStatus>>({});

  const missingCount = products.filter((p) => !p.image_url).length;
  const withImageCount = products.filter((p) => p.image_url).length;

  const generateSingleImage = useCallback(async (product: ProProduct) => {
    setSingleGenerating((prev) => ({ ...prev, [product.id]: "generating" }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-pro-product-image", {
        body: { productId: product.id, productName: product.name },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Generation failed");

      setSingleGenerating((prev) => ({ ...prev, [product.id]: "success" }));
      queryClient.invalidateQueries({ queryKey: ["pro-products"] });
      toast.success(`Image generated for ${product.name}`);
    } catch (err: any) {
      setSingleGenerating((prev) => ({ ...prev, [product.id]: "failed" }));
      toast.error(err.message || "Generation failed");
    }
  }, [queryClient]);

  const runBatchGeneration = useCallback(async () => {
    const missing = products.filter((p) => !p.image_url);
    if (missing.length === 0) return;

    setBatchRunning(true);
    setBatchProgress({ generated: 0, failed: 0, total: missing.length });

    let generated = 0;
    let failed = 0;

    for (const product of missing) {
      setSingleGenerating((prev) => ({ ...prev, [product.id]: "generating" }));
      try {
        const { data, error } = await supabase.functions.invoke("generate-pro-product-image", {
          body: { productId: product.id, productName: product.name },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed");

        generated++;
        setSingleGenerating((prev) => ({ ...prev, [product.id]: "success" }));
      } catch {
        failed++;
        setSingleGenerating((prev) => ({ ...prev, [product.id]: "failed" }));
      }
      setBatchProgress({ generated, failed, total: missing.length });

      // Rate limit pause between images
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    queryClient.invalidateQueries({ queryKey: ["pro-products"] });
    toast.success(`Batch complete: ${generated} generated, ${failed} failed`);
    setBatchRunning(false);
  }, [products, queryClient]);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Pro Product Image Generator
          </CardTitle>
          <CardDescription>
            Generate AI images for professional-use products. Each image includes "PROFESSIONAL USE ONLY" on the vial label.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              {products.length} total
            </Badge>
            <Badge variant="default" className="text-sm py-1 px-3">
              {withImageCount} with images
            </Badge>
            {missingCount > 0 && (
              <Badge variant="destructive" className="text-sm py-1 px-3">
                {missingCount} missing
              </Badge>
            )}
          </div>

          {missingCount > 0 && (
            <div className="space-y-3">
              <Button onClick={runBatchGeneration} disabled={batchRunning} className="gap-2">
                {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {batchRunning ? "Generating…" : `Generate All ${missingCount} Missing Images`}
              </Button>

              {batchRunning && (
                <div className="space-y-2">
                  <Progress value={progressPercent} className="h-3" />
                  <p className="text-sm text-muted-foreground">
                    {batchProgress.generated} generated, {batchProgress.failed} failed of {batchProgress.total} · {progressPercent}%
                  </p>
                </div>
              )}
            </div>
          )}

          {missingCount === 0 && (
            <p className="text-sm text-primary font-medium">✓ All pro products have images</p>
          )}
        </CardContent>
      </Card>

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
                <div key={product.id} className="border border-border rounded-lg overflow-hidden bg-card">
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
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
                    <p className="text-xs font-medium truncate" title={product.name}>{product.name}</p>
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
