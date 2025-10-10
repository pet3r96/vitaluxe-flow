import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Edit } from "lucide-react";
import { PharmacyDialog } from "./PharmacyDialog";
import { toast } from "sonner";

export const PharmaciesDataTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: pharmacies, isLoading, refetch } = useQuery({
    queryKey: ["pharmacies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            active
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const togglePharmacyStatus = async (pharmacyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("pharmacies")
      .update({ active: !currentStatus })
      .eq("id", pharmacyId);

    if (!error) {
      toast.success(`Pharmacy ${!currentStatus ? "activated" : "deactivated"}`);
      refetch();
    } else {
      toast.error("Failed to update pharmacy status");
    }
  };

  const filteredPharmacies = pharmacies?.filter((pharmacy) =>
    pharmacy.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharmacy.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pharmacies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setSelectedPharmacy(null);
            setDialogOpen(true);
          }}
        >
          Add Pharmacy
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>States Serviced</TableHead>
              <TableHead>Priority Map</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPharmacies?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No pharmacies found
                </TableCell>
              </TableRow>
            ) : (
              filteredPharmacies?.map((pharmacy) => (
                <TableRow key={pharmacy.id}>
                  <TableCell className="font-medium">{pharmacy.name}</TableCell>
                  <TableCell>{pharmacy.contact_email}</TableCell>
                  <TableCell>
                    {pharmacy.states_serviced && pharmacy.states_serviced.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {pharmacy.states_serviced.slice(0, 3).map((state: string) => (
                          <Badge key={state} variant="secondary" className="text-xs">
                            {state}
                          </Badge>
                        ))}
                        {pharmacy.states_serviced.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{pharmacy.states_serviced.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {pharmacy.priority_map && Object.keys(pharmacy.priority_map).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(pharmacy.priority_map)
                          .slice(0, 3)
                          .map(([state, priority]: [string, any]) => (
                            <Badge key={state} variant="outline" className="text-xs">
                              {state}({priority})
                            </Badge>
                          ))}
                        {Object.keys(pharmacy.priority_map).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(pharmacy.priority_map).length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not configured</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={pharmacy.active}
                      onCheckedChange={() => togglePharmacyStatus(pharmacy.id, pharmacy.active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPharmacy(pharmacy);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PharmacyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pharmacy={selectedPharmacy}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
