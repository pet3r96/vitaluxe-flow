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
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

type AppRole = 'doctor' | 'provider' | 'topline' | 'downline' | 'pharmacy';

const ROLE_LABELS: Record<AppRole, string> = {
  doctor: 'Practice',
  provider: 'Provider',
  topline: 'Topline Rep',
  downline: 'Downline Rep',
  pharmacy: 'Pharmacy'
};

export default function AdminTermsManagement() {
  const [activeRole, setActiveRole] = useState<AppRole>('doctor');
  const [terms, setTerms] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loadingAcceptances, setLoadingAcceptances] = useState(false);

  useEffect(() => {
    loadTerms();
  }, [activeRole]);

  useEffect(() => {
    loadAcceptances();
  }, []);

  const loadTerms = async () => {
    const { data, error } = await supabase
      .from('terms_and_conditions')
      .select('*')
      .eq('role', activeRole)
      .single();

    if (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error loading terms', error);
      });
      toast.error("Failed to load terms");
      return;
    }

    setTerms(data);
    setTitle(data.title);
    setContent(data.content);
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
      const { error } = await supabase
        .from('terms_and_conditions')
        .update({
          title,
          content,
          version: (terms?.version || 0) + 1,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', terms.id);

      if (error) throw error;

      toast.success("Terms updated successfully");
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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Terms & Conditions Management</h1>
        <p className="text-muted-foreground">Manage terms and conditions for each user role</p>
      </div>

      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList className="grid-cols-1 sm:grid-cols-2">
          <TabsTrigger value="editor">Terms Editor</TabsTrigger>
          <TabsTrigger value="acceptances">User Acceptances</TabsTrigger>
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
      </Tabs>
    </div>
  );
}