import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Plus, Edit, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { EmergencyContactDialog } from "./dialogs/EmergencyContactDialog";

interface EmergencyContactsSectionProps {
  patientAccountId?: string;
}

export function EmergencyContactsSection({ patientAccountId }: EmergencyContactsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view">("add");
  
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

  return (
    <Card className="group relative overflow-visible border-0 bg-gradient-to-br from-rose-500/10 to-pink-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg flex-shrink-0">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent font-bold">
              Emergency Contacts
            </span>
          </CardTitle>
          <Button 
            size="sm" 
            onClick={() => {
              setSelectedContact(null);
              setDialogMode("add");
              setDialogOpen(true);
            }}
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300 flex-shrink-0"
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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{contact.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {contact.relationship}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  {contact.email && (
                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                  )}
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
