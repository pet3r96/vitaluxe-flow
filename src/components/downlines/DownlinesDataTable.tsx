import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Search } from "lucide-react";
import { DownlineDetailsDialog } from "./DownlineDetailsDialog";

interface EnrichedDownline {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  active: boolean;
  practiceCount: number;
}

export function DownlinesDataTable() {
  const { effectiveUserId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDownline, setSelectedDownline] = useState<EnrichedDownline | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: downlines, isLoading } = useQuery({
    queryKey: ["downlines-table", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      // Get downlines for this topline
      const { data: downlinesData, error: downlinesError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, company, active")
        .eq("linked_topline_id", effectiveUserId)
        .eq("active", true);

      if (downlinesError) throw downlinesError;
      if (!downlinesData || downlinesData.length === 0) return [];

      // Get practice counts for each downline
      const downlineIds = downlinesData.map((d) => d.id);
      const { data: practices, error: practicesError } = await supabase
        .from("profiles")
        .select("id, linked_topline_id")
        .in("linked_topline_id", downlineIds)
        .eq("active", true);

      if (practicesError) throw practicesError;

      // Create practice counts map
      const practiceCountsMap: Record<string, number> = {};
      practices?.forEach((practice) => {
        const downlineId = practice.linked_topline_id;
        if (downlineId) {
          practiceCountsMap[downlineId] = (practiceCountsMap[downlineId] || 0) + 1;
        }
      });

      // Enrich downlines with practice counts
      const enrichedDownlines: EnrichedDownline[] = downlinesData.map((downline) => ({
        ...downline,
        practiceCount: practiceCountsMap[downline.id] || 0,
      }));

      return enrichedDownlines;
    },
    enabled: !!effectiveUserId,
  });

  const filteredDownlines = downlines?.filter((downline) => {
    const query = searchQuery.toLowerCase();
    return (
      downline.name.toLowerCase().includes(query) ||
      downline.email.toLowerCase().includes(query) ||
      downline.phone?.toLowerCase().includes(query) ||
      downline.company?.toLowerCase().includes(query)
    );
  });

  const totalPractices = downlines?.reduce((sum, d) => sum + d.practiceCount, 0) || 0;

  const handleViewDetails = (downline: EnrichedDownline) => {
    setSelectedDownline(downline);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading downlines...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search downlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Practices</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDownlines && filteredDownlines.length > 0 ? (
              filteredDownlines.map((downline) => (
                <TableRow key={downline.id}>
                  <TableCell className="font-medium">{downline.name}</TableCell>
                  <TableCell>{downline.email}</TableCell>
                  <TableCell>{downline.phone || "—"}</TableCell>
                  <TableCell>{downline.company || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{downline.practiceCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={downline.active ? "default" : "secondary"}>
                      {downline.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(downline)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No downlines found matching your search" : "No downlines assigned yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Downlines</div>
          <div className="text-2xl font-bold text-primary">{downlines?.length || 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Practices</div>
          <div className="text-2xl font-bold text-primary">{totalPractices}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Active Downlines</div>
          <div className="text-2xl font-bold text-primary">
            {downlines?.filter((d) => d.active).length || 0}
          </div>
        </div>
      </div>

      {selectedDownline && (
        <DownlineDetailsDialog
          downline={selectedDownline}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      )}
    </div>
  );
}
