import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Loader2 } from 'lucide-react';
import { generateProductCatalogPDF } from '@/lib/productCatalogPdfGenerator';
import { toast } from 'sonner';

export function ProductCatalogDownload() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const handleDownload = async () => {
    setGenerating(true);
    setProgress('Starting...');
    try {
      const blob = await generateProductCatalogPDF((msg) => setProgress(msg));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vitaluxe-Product-Catalog-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Product catalog downloaded!');
    } catch (err) {
      console.error('Catalog generation failed:', err);
      toast.error('Failed to generate catalog. Please try again.');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Catalog PDF</CardTitle>
        <CardDescription>
          Download a professionally branded catalog with all products, images, and pricing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleDownload} disabled={generating} size="lg" className="gap-2">
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress}
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Download Product Catalog
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
