import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { EmergencyContactDialog } from "./dialogs/EmergencyContactDialog";
import { formatPhoneNumber } from "@/lib/validators";
import { toast } from "@/hooks/use-toast";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface EmergencyContactsSectionProps {
  patientAccountId?: string;
}

const formatTimestamp = (dateString?: string | null) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return format(date, 'MMM dd, yyyy h:mm a');
  } catch {
    return '';
  }
};

export function EmergencyContactsSection({ patientAccountId }: EmergencyContactsSectionProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  const { effectiveUserId, effectiveRole } = useAuth();
  
  const { data: contacts } = useQuery({
    queryKey: ["patient-emergency-contacts", patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from("patient_emergency_contacts")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("contact_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });
  
  const visibleContacts = expanded 
    ? (contacts || []) 
    : (contacts || []).slice(0, 2);

  const handleDelete = async (contact: any) => {
    if (!confirm(`Are you sure you want to delete ${contact.name}?`)) return;
    
    try {
      const { error } = await supabase
        .from("patient_emergency_contacts")
        .delete()
        .eq("id", contact.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["patient-emergency-contacts", patientAccountId] });
      toast({ title: "Success", description: "Contact deleted successfully" });
      if (patientAccountId) {
        await logMedicalVaultChange({
          patientAccountId,
          actionType: 'deleted',
          entityType: 'emergency_contact',
          entityId: contact.id,
          entityName: contact.name,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: contact,
          changeSummary: `Deleted emergency contact: ${contact.name}`,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    }
  };

  return (
    <Card className="group relative overflow-visible border-0 bg-gradient-to-br from-rose-500/10 to-pink-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg flex-shrink-0">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent break-words">
              Emergency Contacts
            </CardTitle>
          </div>
          <Button 
            size="sm" 
            onClick={() => {
              setSelectedContact(null);
              setDialogMode("add");
              setDialogOpen(true);
            }}
            variant="outline"
            className="shadow-sm flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {contacts && contacts.length > 0 ? (
          <div className="space-y-3">
            {visibleContacts.map((contact) => (
              <div key={contact.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{contact.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {contact.relationship}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatPhoneNumber(contact.phone)}</p>
                    {contact.email && (
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Recorded: {formatTimestamp(contact.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedContact(contact);
                      setDialogMode("view");
                      setDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedContact(contact);
                      setDialogMode("edit");
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDelete(contact)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {contacts.length > 2 && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No emergency contacts recorded
          </p>
        )}
      </CardContent>

      <EmergencyContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientAccountId={patientAccountId || ""}
        contact={selectedContact}
        mode={dialogMode}
      />
    </Card>
  );
}
