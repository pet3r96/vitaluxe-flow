import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSignedUrl } from "@/lib/storageStrategy";
import { format } from "date-fns";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SignedAgreementSectionProps {
  userId: string;
}

export function SignedAgreementSection({ userId }: SignedAgreementSectionProps) {
  const { effectiveRole } = useAuth();
  const isPatient = effectiveRole === 'patient';

  // Fetch terms acceptance based on role
  const { data: termsData, isLoading } = useQuery({
    queryKey: ['signed-agreement', userId, effectiveRole],
    queryFn: async () => {
      if (isPatient) {
        const { data, error } = await supabase
          .from('patient_terms_acceptances')
          .select('id, accepted_at, signature_name, signed_pdf_url, terms_version')
          .eq('user_id', userId)
          .order('accepted_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('user_terms_acceptances')
          .select('id, accepted_at, signature_name, signed_pdf_url, terms_version, role')
          .eq('user_id', userId)
          .order('accepted_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      }
    },
  });

  const handleDownload = async () => {
    if (!termsData?.signed_pdf_url) {
      toast.error("No signed agreement available");
      return;
    }

    try {
      const result = await getSignedUrl('terms-signed', termsData.signed_pdf_url, 300);
      
      if (!result.success || !result.signed_url) {
        toast.error("Failed to generate download link");
        return;
      }

      // Fetch the PDF as a blob
      const response = await fetch(result.signed_url);
      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }
      const blob = await response.blob();

      // Create object URL from blob (same-origin)
      const blobUrl = URL.createObjectURL(blob);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Terms_Agreement_${format(new Date(termsData.accepted_at), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      URL.revokeObjectURL(blobUrl);
      
      toast.success("Agreement downloaded successfully");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download agreement");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            <FileText className="h-5 w-5 text-primary" />
            Signed Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!termsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            <FileText className="h-5 w-5 text-primary" />
            Signed Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              No signed agreement found. You will be prompted to accept terms when required.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
          <FileText className="h-5 w-5 text-primary" />
          Signed Agreement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-sm font-medium">Signed Date</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(termsData.accepted_at), 'MMMM d, yyyy \'at\' h:mm a')}
              </p>
            </div>
            <Button onClick={handleDownload} size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium">Signed By</p>
            <p className="text-sm text-muted-foreground">{termsData.signature_name}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium">Version</p>
            <p className="text-sm text-muted-foreground">Version {termsData.terms_version}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
