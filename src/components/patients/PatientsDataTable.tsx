import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
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
import { Plus, Search, Edit } from "lucide-react";
import { PatientDialog } from "./PatientDialog";
import { format } from "date-fns";

export const PatientsDataTable = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: patients, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["patients", effectiveRole, effectiveUserId],
    queryFn: async () => {
      let patientsQuery = supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });

      // If user is a provider (doctor), only show their patients
      if (effectiveRole === "doctor" && effectiveUserId) {
        patientsQuery = patientsQuery.eq("provider_id", effectiveUserId);
      }

      const { data: patientsData, error: patientsError } = await patientsQuery;
      if (patientsError) {
        console.error("Error fetching patients:", patientsError);
        throw patientsError;
      }

      // Fetch provider details for all patients
      if (patientsData && patientsData.length > 0) {
        const providerIds = [...new Set(patientsData.map(p => p.provider_id).filter(Boolean))];
        
        if (providerIds.length > 0) {
          const { data: providersData } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", providerIds);

          // Map provider data to patients
          const providersMap = new Map(providersData?.map(p => [p.id, p]) || []);
          return patientsData.map(patient => ({
            ...patient,
            provider: providersMap.get(patient.provider_id)
          }));
        }
      }

      return patientsData || [];
    },
  });

  const filteredPatients = patients?.filter(patient =>
    patient.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleAddPatient = () => {
    setSelectedPatient(null);
    setDialogOpen(true);
  };

  const handleEditPatient = (patient: any) => {
    setSelectedPatient(patient);
    setDialogOpen(true);
  };

  const isAdmin = effectiveRole === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isAdmin && (
          <Button onClick={handleAddPatient}>
            <Plus className="mr-2 h-4 w-4" />
            Add Patient
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              {isAdmin && <TableHead>Provider</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center">
                  Loading patients...
                </TableCell>
              </TableRow>
            ) : filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                  {searchQuery ? "No patients found matching your search." : "No patients found. Add your first patient to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{patient.email || "-"}</TableCell>
                  <TableCell>{patient.phone || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">{patient.address || "-"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      {patient.provider?.name || "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {!isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPatient(patient)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patient={selectedPatient}
        onSuccess={() => {
          refetch();
          setDialogOpen(false);
        }}
      />
    </div>
  );
};
