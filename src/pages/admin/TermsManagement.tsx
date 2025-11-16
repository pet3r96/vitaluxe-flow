import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export default function TermsManagement() {
  const { data: terms, isLoading } = useQuery({
    queryKey: ['admin-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terms_and_conditions')
        .select('*')
        .order('version', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Terms & Conditions Management</h1>
        <p className="text-muted-foreground">Manage terms and conditions versions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Terms Versions ({terms?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading terms...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms?.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">v{term.version}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{term.role || 'all'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(term.effective_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(term.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
