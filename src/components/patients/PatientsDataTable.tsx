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
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const PatientsDataTable = () => {
  const { effectiveRole, effectivePracticeId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: patients, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["patients", effectiveRole, effectivePracticeId],
    queryFn: async () => {
      console.debug('Patients query params', { effectiveRole, effectivePracticeId });
      let patientsQuery = supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });

      // If user is a practice (doctor) or provider, only show their practice's patients
      if ((effectiveRole === "doctor" || effectiveRole === "provider") && effectivePracticeId) {
        patientsQuery = patientsQuery.eq("practice_id", effectivePracticeId);
      }

      const { data: patientsData, error: patientsError } = await patientsQuery;
      if (patientsError) {
        console.error("Error fetching patients:", patientsError);
        throw patientsError;
      }

      console.debug('Patients fetched', patientsData?.length || 0);

      // Fetch practice details for all patients
      if (patientsData && patientsData.length > 0) {
        const practiceIds = [...new Set(patientsData.map(p => p.practice_id).filter(Boolean))];
        
        if (practiceIds.length > 0) {
          const { data: practicesData } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", practiceIds);

          // Map practice data to patients
          const practicesMap = new Map(practicesData?.map(p => [p.id, p]) || []);
          return patientsData.map(patient => ({
            ...patient,
            practice: practicesMap.get(patient.practice_id)
          }));
        }
      }

      return patientsData || [];
    },
    enabled: effectiveRole === "admin" || effectiveRole === "doctor" || (effectiveRole === "provider" && !!effectivePracticeId),
  });

  const filteredPatients = patients?.filter(patient =>
    patient.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredPatients?.length || 0,
    itemsPerPage: 25
  });

  const paginatedPatients = filteredPatients?.slice(startIndex, endIndex);

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

      <div className="rounded-md border bg-card overflow-x-auto">
        <div className="min-w-[800px]">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              {isAdmin && <TableHead>Practice</TableHead>}
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
              paginatedPatients?.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{patient.email || "-"}</TableCell>
                  <TableCell>{patient.phone || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {patient.address_formatted || 
                     (patient.address_street ? 
                       `${patient.address_street}${patient.address_city ? ', ' + patient.address_city : ''}${patient.address_state ? ', ' + patient.address_state : ''} ${patient.address_zip || ''}`.trim() 
                       : patient.address || "-")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {patient.practice?.name || "-"}
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
      </div>

      {filteredPatients && filteredPatients.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredPatients.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredPatients.length)}
        />
      )}

      <PatientDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedPatient(null);
          }
        }}
        patient={selectedPatient}
        onSuccess={() => {
          refetch();
          setSelectedPatient(null);
          setDialogOpen(false);
        }}
      />
    </div>
  );
};
