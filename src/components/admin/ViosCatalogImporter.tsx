import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertTriangle, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { useViosCatalogCount } from "@/hooks/useViosCatalog";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
}

export function ViosCatalogImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [parseProgress, setParseProgress] = useState<string | null>(null);
  
  const { data: catalogCount = 0, refetch: refetchCount } = useViosCatalogCount();

  const importMutation = useMutation({
    mutationFn: async (products: any[]): Promise<ImportResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("import-vios-catalog", {
        body: { products },
      });

      if (response.error) {
        throw new Error(response.error.message || "Import failed");
      }

      return response.data as ImportResult;
    },
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported} products${result.errors > 0 ? ` (${result.errors} errors)` : ""}`);
      refetchCount();
      setFile(null);
      setParseProgress(null);
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const parseCSV = useCallback((text: string): any[] => {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    
    const products: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle CSV with quoted values
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length >= 2) {
        products.push({
          med_id: values[0],
          product_name: values[1],
          form: values[2] || null,
          strength: values[3] || null,
          units: values[4] || null,
          package: values[5] || null,
          schedule: values[6] || null,
        });
      }
      
      if (i % 10000 === 0) {
        setParseProgress(`Parsed ${i.toLocaleString()} / ${lines.length.toLocaleString()} rows...`);
      }
    }
    
    return products;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setParseProgress("Reading file...");
    
    const text = await file.text();
    setParseProgress("Parsing CSV...");
    
    const products = parseCSV(text);
    
    if (products.length === 0) {
      toast.error("No valid products found in CSV");
      setParseProgress(null);
      return;
    }

    setParseProgress(`Importing ${products.length.toLocaleString()} products...`);
    
    // Import in chunks to avoid timeout
    const chunkSize = 5000;
    let totalImported = 0;
    let totalErrors = 0;

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      setParseProgress(`Importing ${i.toLocaleString()} - ${Math.min(i + chunkSize, products.length).toLocaleString()} of ${products.length.toLocaleString()}...`);
      
      try {
        const result = await importMutation.mutateAsync(chunk);
        totalImported += result.imported;
        totalErrors += result.errors;
      } catch (error) {
        console.error(`Chunk error at ${i}:`, error);
        totalErrors += chunk.length;
      }
    }

    toast.success(`Import complete: ${totalImported.toLocaleString()} imported, ${totalErrors} errors`);
    refetchCount();
    setFile(null);
    setParseProgress(null);
  }, [file, parseCSV, importMutation, refetchCount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          VIOS Product Catalog
        </CardTitle>
        <CardDescription>
          Import VIOS pharmacy product catalog from CSV. This enables product code lookup when configuring variants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium">Current catalog size</p>
            <p className="text-2xl font-bold">{catalogCount.toLocaleString()} products</p>
          </div>
          {catalogCount > 0 && (
            <CheckCircle className="h-8 w-8 text-green-500" />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv-file">Upload CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={importMutation.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Expected format: Med ID, Product Name, Form, Strength, Units, Package, Schedule
          </p>
        </div>

        {file && (
          <Alert>
            <Upload className="h-4 w-4" />
            <AlertDescription>
              Ready to import: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </AlertDescription>
          </Alert>
        )}

        {parseProgress && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>{parseProgress}</AlertDescription>
          </Alert>
        )}

        {importMutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {importMutation.error?.message || "Import failed"}
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleImport}
          disabled={!file || importMutation.isPending}
          className="w-full"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Import Catalog
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
