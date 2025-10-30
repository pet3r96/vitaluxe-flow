import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MultiPatientSelectProps {
  selectedPatientIds: string[];
  onSelectedChange: (ids: string[]) => void;
}

export function MultiPatientSelect({ selectedPatientIds, onSelectedChange }: MultiPatientSelectProps) {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: patients, isLoading, error: queryError } = useQuery({
    queryKey: ["patients-select", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];
      console.log("Fetching patients for practice:", effectivePracticeId);
      const { data, error } = await supabase
        .from("patients")
        .select("id, name")
        .eq("practice_id", effectivePracticeId)
        .order("name");
      if (error) {
        console.error("Error fetching patients:", error);
        throw error;
      }
      console.log("Patients fetched:", data?.length || 0);
      return data || [];
    },
    enabled: !!effectivePracticeId,
    staleTime: 0,
  });

  // Real-time subscription for instant patient list updates
  useEffect(() => {
    if (!effectivePracticeId) return;

    const channel = supabase
      .channel('patients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patients-select", effectivePracticeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectivePracticeId, queryClient]);

  if (queryError) {
    console.error("Query error:", queryError);
  }

  const selectedPatients = patients?.filter(p => selectedPatientIds.includes(p.id)) || [];

  const filteredPatients = patients?.filter(patient => {
    if (!searchQuery) return true;
    return patient.name.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const togglePatient = (patientId: string) => {
    if (selectedPatientIds.includes(patientId)) {
      onSelectedChange(selectedPatientIds.filter(id => id !== patientId));
    } else {
      onSelectedChange([...selectedPatientIds, patientId]);
    }
  };

  const removePatient = (patientId: string) => {
    onSelectedChange(selectedPatientIds.filter(id => id !== patientId));
  };

  const clearAll = () => {
    onSelectedChange([]);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected Patients Badges */}
      {selectedPatients.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Selected:</span>
          {selectedPatients.map(patient => (
            <Badge key={patient.id} variant="secondary" className="gap-1">
              {patient.name}
              <button
                type="button"
                onClick={() => removePatient(patient.id)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 px-2 text-xs"
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Searchable Command List */}
      <Command className="border rounded-lg">
        <CommandInput 
          placeholder="Search patients..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList className="max-h-[200px]">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <Users className="h-8 w-8 opacity-50" />
              <p className="text-sm">No patients found</p>
            </div>
          </CommandEmpty>
          <CommandGroup>
            {filteredPatients.map(patient => {
              const isSelected = selectedPatientIds.includes(patient.id);
              return (
                <CommandItem
                  key={patient.id}
                  value={patient.name}
                  onSelect={() => togglePatient(patient.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => togglePatient(patient.id)}
                  />
                  <span>
                    {patient.name}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>

      {/* Selection Count */}
      {selectedPatientIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedPatientIds.length} patient{selectedPatientIds.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );
}
