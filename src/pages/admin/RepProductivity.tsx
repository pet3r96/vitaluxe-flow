import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Users, DollarSign } from "lucide-react";

export default function RepProductivity() {
  const { data: reps, isLoading } = useQuery({
    queryKey: ['admin-rep-productivity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select(`
          id,
          user_id,
          rep_type,
          created_at,
          profiles!inner(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rep Productivity</h1>
        <p className="text-muted-foreground">Track representative performance and metrics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Representative Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading representatives...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Representative</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps?.map((rep: any) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">
                      {rep.profiles?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="capitalize">{rep.rep_type}</TableCell>
                    <TableCell className="text-sm">{rep.profiles?.email || 'N/A'}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(rep.created_at).toLocaleDateString()}
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
