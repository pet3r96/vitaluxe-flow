import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, TestTube, CheckCircle2, XCircle, AlertCircle, Database, StopCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SeedResult {
  success: boolean;
  message: string;
  dryRun?: boolean;
  summary?: {
    productsCreated: number;
    variantsCreated: number;
    imagesGenerated: number;
    errors: string[];
    totalFamilies?: number;
    nextStartIndex?: number;
    hasMore?: boolean;
  };
}

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  productsProcessed: number;
  variantsCreated: number;
  imagesGenerated: number;
  totalFamilies: number;
  errors: string[];
}

export const SeedViosProducts = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [generateImages, setGenerateImages] = useState(true);
  const [currentProductCount, setCurrentProductCount] = useState<number | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    fetchProductCount();
  }, []);

  const fetchProductCount = async () => {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    if (!error && count !== null) {
      setCurrentProductCount(count);
    }
  };

  const runSeed = async (dryRun: boolean) => {
    if (dryRun) {
      setIsDryRunning(true);
    } else {
      setIsLoading(true);
    }
    setResult(null);
    setBatchProgress(null);
    cancelledRef.current = false;

    try {
      if (dryRun) {
        // Dry run: fetch all at once with large batch
        const { data, error } = await supabase.functions.invoke('seed-vios-products', {
          body: { 
            dryRun: true, 
            generateImages: false,
            batchSize: 1000 // Get all for dry run
          }
        });

        if (error) throw error;
        setResult(data as SeedResult);
        
        if (data?.success) {
          toast({
            title: "Dry Run Complete",
            description: `Found ${data.summary?.totalFamilies} product families with ${(data.summary?.productsCreated || 0) + (data.summary?.variantsCreated || 0)} total items`,
          });
        }
      } else {
        // Live seed: progressive batch processing
        await runProgressiveSeed();
      }
    } catch (error: any) {
      console.error('Seed error:', error);
      setResult({
        success: false,
        message: error.message || 'Failed to invoke seed function',
      });
      toast({
        title: "Error",
        description: error.message || "Failed to run seed function",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsDryRunning(false);
    }
  };

  const runProgressiveSeed = async () => {
    let startIndex = 0;
    let hasMore = true;
    const batchSize = 3; // Process 3 product families per batch (~45-60s with images)
    
    const cumulativeProgress: BatchProgress = {
      currentBatch: 0,
      totalBatches: 0,
      productsProcessed: 0,
      variantsCreated: 0,
      imagesGenerated: 0,
      totalFamilies: 0,
      errors: [],
    };

    while (hasMore && !cancelledRef.current) {
      try {
        const { data, error } = await supabase.functions.invoke('seed-vios-products', {
          body: { 
            dryRun: false, 
            generateImages,
            batchSize,
            startIndex,
            forceOverwrite: startIndex > 0, // Allow continuation after first batch
          }
        });

        if (error) throw error;

        const batchResult = data as SeedResult;
        
        if (!batchResult.success) {
          throw new Error(batchResult.message || 'Batch failed');
        }

        // Update cumulative progress
        const summary = batchResult.summary;
        if (summary) {
          cumulativeProgress.totalFamilies = summary.totalFamilies || 0;
          cumulativeProgress.totalBatches = Math.ceil(cumulativeProgress.totalFamilies / batchSize);
          cumulativeProgress.currentBatch++;
          cumulativeProgress.productsProcessed += summary.productsCreated || 0;
          cumulativeProgress.variantsCreated += summary.variantsCreated || 0;
          cumulativeProgress.imagesGenerated += summary.imagesGenerated || 0;
          cumulativeProgress.errors = [...cumulativeProgress.errors, ...(summary.errors || [])];
          
          startIndex = summary.nextStartIndex || 0;
          hasMore = summary.hasMore ?? false;
        } else {
          hasMore = false;
        }

        setBatchProgress({ ...cumulativeProgress });

      } catch (batchError: any) {
        console.error('Batch error:', batchError);
        cumulativeProgress.errors.push(`Batch ${cumulativeProgress.currentBatch + 1}: ${batchError.message}`);
        setBatchProgress({ ...cumulativeProgress });
        
        // Continue to next batch on error (resilient processing)
        startIndex += batchSize;
        
        // Check if we've exceeded reasonable attempts
        if (cumulativeProgress.errors.length > 10) {
          hasMore = false;
        }
      }
    }

    // Final result
    const finalResult: SeedResult = {
      success: cumulativeProgress.errors.length < 5,
      message: cancelledRef.current 
        ? `Cancelled after ${cumulativeProgress.productsProcessed} products`
        : `Created ${cumulativeProgress.productsProcessed} products with ${cumulativeProgress.variantsCreated} variants`,
      dryRun: false,
      summary: {
        productsCreated: cumulativeProgress.productsProcessed,
        variantsCreated: cumulativeProgress.variantsCreated,
        imagesGenerated: cumulativeProgress.imagesGenerated,
        errors: cumulativeProgress.errors,
        totalFamilies: cumulativeProgress.totalFamilies,
      },
    };

    setResult(finalResult);
    fetchProductCount();

    if (finalResult.success && !cancelledRef.current) {
      toast({
        title: "Catalog Seeded Successfully",
        description: `Created ${cumulativeProgress.productsProcessed} products with ${cumulativeProgress.variantsCreated} variants`,
      });
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    toast({
      title: "Cancelling...",
      description: "Will stop after current batch completes",
    });
  };

  const progressPercent = batchProgress 
    ? Math.round((batchProgress.currentBatch / Math.max(batchProgress.totalBatches, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <Database className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm text-muted-foreground">Current Products in Database</p>
          <p className="text-2xl font-bold">
            {currentProductCount !== null ? currentProductCount : '...'}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={currentProductCount && currentProductCount > 10 ? "default" : "secondary"}>
            {currentProductCount && currentProductCount > 10 ? "Catalog Loaded" : "Needs Seeding"}
          </Badge>
        </div>
      </div>

      {/* Batch Progress */}
      {batchProgress && isLoading && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Seeding in Progress...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Batch {batchProgress.currentBatch} of {batchProgress.totalBatches}</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-2 bg-accent/30 rounded">
                <p className="text-xl font-bold text-primary">{batchProgress.productsProcessed}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
              <div className="p-2 bg-accent/30 rounded">
                <p className="text-xl font-bold text-primary">{batchProgress.variantsCreated}</p>
                <p className="text-xs text-muted-foreground">Variants</p>
              </div>
              <div className="p-2 bg-accent/30 rounded">
                <p className="text-xl font-bold text-primary">{batchProgress.imagesGenerated}</p>
                <p className="text-xs text-muted-foreground">Images</p>
              </div>
            </div>

            {batchProgress.errors.length > 0 && (
              <p className="text-xs text-destructive">
                {batchProgress.errors.length} error(s) - will continue processing
              </p>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCancel}
              className="w-full"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Cancel After Current Batch
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Catalog Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vios Compounding Catalog</CardTitle>
          <CardDescription>
            The seed function contains 517 product entries that will be grouped into ~100 product families with variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-accent/30 rounded-lg">
              <p className="text-2xl font-bold text-primary">517</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
            <div className="p-3 bg-accent/30 rounded-lg">
              <p className="text-2xl font-bold text-primary">~100</p>
              <p className="text-xs text-muted-foreground">Product Families</p>
            </div>
            <div className="p-3 bg-accent/30 rounded-lg">
              <p className="text-2xl font-bold text-primary">4</p>
              <p className="text-xs text-muted-foreground">Pricing Tiers</p>
            </div>
            <div className="p-3 bg-accent/30 rounded-lg">
              <p className="text-2xl font-bold text-primary">AI</p>
              <p className="text-xs text-muted-foreground">Generated Images</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seed Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="generate-images">Generate AI Images</Label>
              <p className="text-sm text-muted-foreground">
                Creates product images using AI (~35 min for full catalog)
              </p>
            </div>
            <Switch 
              id="generate-images" 
              checked={generateImages}
              onCheckedChange={setGenerateImages}
              disabled={isLoading || isDryRunning}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={() => runSeed(true)}
          disabled={isLoading || isDryRunning}
          className="flex-1"
        >
          {isDryRunning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4 mr-2" />
          )}
          Test Dry Run
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              disabled={isLoading || isDryRunning}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Seed Full Catalog
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Seed Vios Product Catalog?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create ~100 product families with ~517 variants and link them to Vios Compounding pharmacy.
                {generateImages && (
                  <span className="block mt-2 font-medium">
                    AI image generation is enabled - this will take ~35 minutes with progress tracking.
                  </span>
                )}
                {!generateImages && (
                  <span className="block mt-2 font-medium">
                    Without images, this will complete in under 2 minutes.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => runSeed(false)}>
                Start Seeding
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Results */}
      {result && !isLoading && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {result.success 
              ? (result.dryRun ? "Dry Run Successful" : "Seeding Complete") 
              : "Error"
            }
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p>{result.message}</p>
            
            {result.dryRun && result.summary?.totalFamilies && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>Product Families: <strong>{result.summary.totalFamilies}</strong></div>
                <div>Total Items: <strong>{(result.summary.productsCreated || 0) + (result.summary.variantsCreated || 0)}</strong></div>
              </div>
            )}

            {!result.dryRun && result.summary && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div>Products: <strong>{result.summary.productsCreated}</strong></div>
                  <div>Variants: <strong>{result.summary.variantsCreated}</strong></div>
                  <div>Images: <strong>{result.summary.imagesGenerated}</strong></div>
                </div>
                
                {result.summary.errors && result.summary.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-destructive font-medium">Errors ({result.summary.errors.length}):</p>
                    <ul className="list-disc list-inside text-xs">
                      {result.summary.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.summary.errors.length > 5 && (
                        <li>...and {result.summary.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning */}
      {currentProductCount !== null && currentProductCount > 50 && !isLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Catalog Already Loaded</AlertTitle>
          <AlertDescription>
            There are already {currentProductCount} products in the database. Running the seed again may create duplicates.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
