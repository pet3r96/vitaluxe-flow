import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";

export function PatientQuickSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { effectivePracticeId } = useAuth();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-search", effectivePracticeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name, date_of_birth, phone")
        .eq("practice_id", effectivePracticeId)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectivePracticeId && open,
  });

  const handleSelect = (patientId: string) => {
    setOpen(false);
    navigate(`/patients/${patientId}`);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search patients...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search patients by name..." />
        <CommandList>
          <CommandEmpty>No patients found.</CommandEmpty>
          <CommandGroup heading="Patients">
            {patients.map((patient) => (
              <CommandItem
                key={patient.id}
                value={`${patient.first_name} ${patient.last_name}`}
                onSelect={() => handleSelect(patient.id)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center flex-1">
                  <User className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <span>
                      {patient.first_name} {patient.last_name}
                    </span>
                    {patient.date_of_birth && (
                      <span className="text-xs text-muted-foreground">
                        DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <PatientQuickAccessButton
                    patientId={patient.id}
                    patientName={`${patient.first_name} ${patient.last_name}`}
                    variant="icon"
                    size="sm"
                  />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
