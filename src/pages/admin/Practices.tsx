import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, MapPin } from "lucide-react";

export default function Practices() {
  const { data: practices, isLoading } = useQuery({
    queryKey: ['admin-practices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          phone,
          address_formatted,
          active,
          created_at,
          verified_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Practices</h1>
        <p className="text-muted-foreground">Manage all practice accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Practices ({practices?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading practices...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practice Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {practices?.map((practice) => (
                  <TableRow key={practice.id}>
                    <TableCell className="font-medium">{practice.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {practice.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {practice.email}
                          </div>
                        )}
                        {practice.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {practice.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {practice.address_formatted ? (
                        <div className="flex items-start gap-1 text-sm">
                          <MapPin className="h-3 w-3 mt-0.5" />
                          <span className="line-clamp-2">{practice.address_formatted}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No address</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={practice.active ? "default" : "secondary"}>
                        {practice.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(practice.created_at).toLocaleDateString()}
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
