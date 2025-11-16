import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Download, Save, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

type AppRole = 'doctor' | 'provider' | 'topline' | 'downline' | 'pharmacy' | 'subscription' | 'patient' | 'staff';

const ROLE_LABELS: Record<AppRole, string> = {
  doctor: 'Practice',
  provider: 'Provider',
  topline: 'Topline Rep',
  downline: 'Downline Rep',
  pharmacy: 'Pharmacy',
  subscription: 'VitaLuxePro Subscription',
  patient: 'Patient Portal',
  staff: 'Practice Staff'
};

export default function AdminTermsManagement() {
  const [activeTab, setActiveTab] = useState('editor');
  const [activeRole, setActiveRole] = useState<AppRole>('doctor');
  const [terms, setTerms] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loadingAcceptances, setLoadingAcceptances] = useState(false);
  
  // Checkout Attestation state
  const [attestation, setAttestation] = useState<any>(null);
  const [attestationTitle, setAttestationTitle] = useState("");
  const [attestationSubtitle, setAttestationSubtitle] = useState("");
  const [attestationContent, setAttestationContent] = useState("");
  const [attestationCheckboxText, setAttestationCheckboxText] = useState("");
  const [savingAttestation, setSavingAttestation] = useState(false);
  const [loadingAttestation, setLoadingAttestation] = useState(true);

  useEffect(() => {
    loadTerms();
  }, [activeRole]);

  useEffect(() => {
    loadAcceptances();
    loadAttestation();
  }, []);

  const loadTerms = async () => {
    let data: any = null;
    let error: any = null;

    if (activeRole === 'patient') {
      const res = await supabase
        .from('patient_portal_terms')
        .select('*')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = res.data;
      error = res.error;
    } else {
      const res = await supabase
        .from('terms_and_conditions')
        .select('*')
        .eq('role', activeRole as any)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = res.data;
      error = res.error;
    }

    if (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error loading terms', error);
      });
      toast.error("Failed to load terms");
      return;
    }

    if (data) {
      setTerms(data);
      setTitle(data.title);
      setContent(data.content);
    } else {
      // No terms exist yet for this role - initialize empty state
      setTerms(null);
      setTitle("");
      setContent("");
    }
  };

  const loadAcceptances = async () => {
    setLoadingAcceptances(true);
    try {
      // 1) Fetch acceptances without embedding
      const { data: accepts, error: aErr } = await supabase
        .from('user_terms_acceptances')
        .select('*')
        .order('accepted_at', { ascending: false });

      if (aErr) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Error loading acceptances', aErr);
        });
        toast.error('Failed to load acceptances');
        setAcceptances([]);
        return;
      }

      if (!accepts || accepts.length === 0) {
        setAcceptances([]);
        return;
      }

      // 2) Fetch corresponding profiles
      const userIds = Array.from(new Set(accepts.map((a: any) => a.user_id).filter(Boolean)));

      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds as string[]);

        if (pErr) {
          import('@/lib/logger').then(({ logger }) => {
            logger.warn('Could not load profiles for acceptances', pErr);
          });
        } else if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
        }
      }

      // 3) Merge back into the same shape the UI expects (acceptance.profiles?.name/email)
      const enriched = accepts.map((a: any) => ({
        ...a,
        profiles: profilesMap[a.user_id] || null,
      }));

      setAcceptances(enriched);
    } catch (e) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Unexpected error loading acceptances', e);
      });
      toast.error('Failed to load acceptances');
      setAcceptances([]);
    } finally {
      setLoadingAcceptances(false);
    }
  };

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: acceptances.length,
    itemsPerPage: 25
  });

  const paginatedAcceptances = acceptances.slice(startIndex, endIndex);

  useEffect(() => {
    if (acceptances.length > 0) {
      goToPage(1);
    }
  }, [acceptances.length]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    setSaving(true);

    try {
      const currentUser = (await supabase.auth.getUser()).data.user?.id;

      if (activeRole === 'patient') {
        if (terms?.id) {
          // Update existing patient portal terms
          const { error } = await supabase
            .from('patient_portal_terms')
            .update({
              title,
              content,
              version: (terms?.version || 0) + 1,
              updated_at: new Date().toISOString(),
              updated_by: currentUser
            })
            .eq('id', terms.id);

          if (error) throw error;
        } else {
          // Insert new patient portal terms
          const { error } = await supabase
            .from('patient_portal_terms')
            .insert({
              title,
              content,
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              updated_by: currentUser
            });

          if (error) throw error;
        }
      } else {
        if (terms?.id) {
          // Update existing terms
          const { error } = await supabase
            .from('terms_and_conditions')
            .update({
              title,
              content,
              version: (terms?.version || 0) + 1,
              updated_at: new Date().toISOString(),
              updated_by: currentUser
            })
            .eq('id', terms.id);

          if (error) throw error;
        } else {
          // Insert new terms
          const { error } = await supabase
            .from('terms_and_conditions')
            .insert({
              role: activeRole as any,
              title,
              content,
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              updated_by: currentUser
            });

          if (error) throw error;
        }
      }

      toast.success("Terms saved successfully");
      await loadTerms();
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error saving terms', error);
      });
      toast.error(error.message || "Failed to save terms");
    } finally {
      setSaving(false);
    }
  };

  const loadAttestation = async () => {
    setLoadingAttestation(true);
    
    const { data, error } = await supabase
      .from('checkout_attestation')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error loading attestation', error);
      });
      toast.error("Failed to load checkout attestation");
      setLoadingAttestation(false);
      return;
    }

    if (data) {
      setAttestation(data);
      setAttestationTitle(data.title);
      setAttestationSubtitle(data.subtitle || "");
      setAttestationContent(data.content);
      setAttestationCheckboxText(data.checkbox_text);
    }
    
    setLoadingAttestation(false);
  };

  const handleSaveAttestation = async () => {
    if (!attestationTitle.trim() || !attestationContent.trim()) {
      toast.error("Title and content are required");
      return;
    }

    setSavingAttestation(true);

    try {
      const { error } = await supabase
        .from('checkout_attestation')
        .update({
          title: attestationTitle,
          subtitle: attestationSubtitle,
          content: attestationContent,
          checkbox_text: attestationCheckboxText,
          version: (attestation?.version || 0) + 1,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', attestation.id);

      if (error) throw error;

      toast.success("Checkout attestation updated successfully");
      await loadAttestation();
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error saving attestation', error);
      });
      toast.error(error.message || "Failed to save attestation");
    } finally {
      setSavingAttestation(false);
    }
  };

  const downloadPDF = async (pdfUrl: string, userName: string) => {
    try {
      // Get signed URL from Supabase
      const { data, error } = await supabase.storage
        .from('terms-signed')
        .createSignedUrl(pdfUrl, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        // Fetch the PDF as a blob
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        
        const blob = await response.blob();
        
        // Create blob URL and trigger download
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${userName.replace(/[^a-z0-9]/gi, '_')}_terms_acceptance.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        toast.success("PDF downloaded successfully");
      }
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error downloading PDF', error);
      });
      toast.error("Failed to download PDF");
    }
  };

  return (
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">Terms & Conditions Management</h1>
        <p className="text-muted-foreground mt-2">Manage terms and conditions for each user role</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              setActiveRole('subscription');
              setActiveTab('editor');
            }}
          >
            Edit Subscription Terms
          </Button>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid-cols-1 sm:grid-cols-4">
          <TabsTrigger value="editor">Terms Editor</TabsTrigger>
          <TabsTrigger value="acceptances">User Acceptances</TabsTrigger>
          <TabsTrigger value="checkout">Checkout Attestation</TabsTrigger>
          <TabsTrigger value="subscription">Subscription Terms</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Role</CardTitle>
              <CardDescription>Choose which role's terms you want to edit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                  <Button
                    key={role}
                    variant={activeRole === role ? "default" : "outline"}
                    onClick={() => setActiveRole(role)}
                  >
                    {ROLE_LABELS[role]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Edit {ROLE_LABELS[activeRole]} Terms</CardTitle>
                  <CardDescription>
                    Current Version: {terms?.version || 0} | Last Updated: {terms?.updated_at ? format(new Date(terms.updated_at), 'PPp') : 'Never'}
                  </CardDescription>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content (Markdown supported)</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter terms and conditions content"
                  className="min-h-[500px] font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Use Markdown formatting. Example: # Heading, ## Subheading, **bold**, - bullet point
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acceptances">
          <Card>
            <CardHeader>
              <CardTitle>User Acceptances</CardTitle>
              <CardDescription>
                View all users who have accepted terms and conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAcceptances ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="mt-4 text-muted-foreground">Loading acceptances...</p>
                </div>
              ) : acceptances.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No acceptances yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Accepted Date</TableHead>
                      <TableHead>Signature</TableHead>
                      <TableHead>PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAcceptances.map((acceptance) => (
                      <TableRow key={acceptance.id}>
                        <TableCell>{acceptance.profiles?.name || 'N/A'}</TableCell>
                        <TableCell>{acceptance.profiles?.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ROLE_LABELS[acceptance.role as AppRole]}
                          </Badge>
                        </TableCell>
                        <TableCell>v{acceptance.terms_version}</TableCell>
                        <TableCell>
                          {format(new Date(acceptance.accepted_at), 'PP p')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {acceptance.signature_name}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadPDF(acceptance.signed_pdf_url, acceptance.profiles?.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {acceptances.length > 0 && (
              <div className="px-6 pb-4">
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  hasNextPage={hasNextPage}
                  hasPrevPage={hasPrevPage}
                  totalItems={acceptances.length}
                  startIndex={startIndex}
                  endIndex={Math.min(endIndex, acceptances.length)}
                />
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="checkout" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Edit Checkout Attestation</CardTitle>
                  <CardDescription>
                    This text appears on the order confirmation page.
                    {attestation && (
                      <> Version: {attestation.version} | Last Updated: {format(new Date(attestation.updated_at), 'PPp')}</>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={handleSaveAttestation} disabled={savingAttestation || loadingAttestation}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingAttestation ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingAttestation ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 w-48 bg-muted rounded mx-auto"></div>
                    <div className="h-4 w-32 bg-muted rounded mx-auto"></div>
                  </div>
                  <p className="text-muted-foreground mt-4">Loading attestation data...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="attestation-title">Title</Label>
                    <Input
                      id="attestation-title"
                      value={attestationTitle}
                      onChange={(e) => setAttestationTitle(e.target.value)}
                      placeholder="e.g., Medical Attestation Required"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="attestation-subtitle">Subtitle</Label>
                    <Input
                      id="attestation-subtitle"
                      value={attestationSubtitle}
                      onChange={(e) => setAttestationSubtitle(e.target.value)}
                      placeholder="e.g., Please read and confirm the following statement"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="attestation-content">Attestation Points</Label>
                    <Textarea
                      id="attestation-content"
                      value={attestationContent}
                      onChange={(e) => setAttestationContent(e.target.value)}
                      placeholder="Enter attestation points (one per line, use - for bullets)"
                      className="min-h-[200px] font-mono"
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter each attestation point on a new line. Start lines with "-" for bullet points.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="attestation-checkbox">Checkbox Text</Label>
                    <Input
                      id="attestation-checkbox"
                      value={attestationCheckboxText}
                      onChange={(e) => setAttestationCheckboxText(e.target.value)}
                      placeholder="e.g., I agree to all of the above."
                    />
                  </div>

                  <div className="mt-6 p-4 border rounded-lg bg-accent/10">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Preview
                    </h4>
                    <Card className="border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                          <AlertCircle className="h-5 w-5" />
                          {attestationTitle}
                        </CardTitle>
                        <CardDescription>
                          {attestationSubtitle}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm leading-relaxed">
                            By checking the box below, you attest that:
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                              {attestationContent.split('\n').map((line, idx) => {
                                const cleanedLine = line.trim().replace(/^-\s*/, '');
                                return cleanedLine ? <li key={idx}>{cleanedLine}</li> : null;
                              })}
                            </ul>
                          </AlertDescription>
                        </Alert>

                        <div className="flex items-start space-x-3 p-4 rounded-lg bg-accent/50 border border-border">
                          <Checkbox disabled className="mt-1" />
                          <div className="flex-1">
                            <Label className="text-sm font-medium leading-relaxed">
                              {attestationCheckboxText}
                            </Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>VitaLuxePro Subscription Terms</CardTitle>
              <CardDescription>View and manage subscription-specific terms and conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Use the "Edit Subscription Terms" button in the Quick Actions section above to edit subscription terms.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}