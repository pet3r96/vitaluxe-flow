import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePatientChartData } from "@/hooks/usePatientChartData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
}

export default function PatientChartDrawer({ open, onClose, patientId }: Props) {
  const { chart, loading, refresh } = usePatientChartData(patientId);
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Loading patient chart…</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!chart?.patient) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Patient not found</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    );
  }

  const p = chart.patient;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return format(new Date(d), "MM/dd/yyyy");
  };

  const handleSaveNotes = async () => {
    if (!noteText.trim()) {
      toast({
        title: "Empty Note",
        description: "Please enter some text before saving.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to save notes.",
          variant: "destructive",
        });
        return;
      }

      // Fetch user profile to get name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, name, staff_role_type")
        .eq("id", user.id)
        .single();

      const userName = profile?.full_name || profile?.name || "Provider";
      const userRole = profile?.staff_role_type || "provider";

      const { error } = await supabase
        .from("patient_notes")
        .insert({
          patient_account_id: patientId,
          note_content: noteText,
          created_by_user_id: user.id,
          created_by_role: userRole,
          created_by_name: userName,
        });

      if (error) throw error;

      toast({
        title: "Note Saved",
        description: "Provider note has been saved successfully.",
      });

      setNoteText("");
      refresh();
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="h-[100vh] md:h-[92vh] bg-background border-l">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-semibold flex items-center justify-between">
            <span>Patient Chart</span>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DrawerTitle>
        </DrawerHeader>

        <Separator />

        <ScrollArea className="h-full px-6 py-4 space-y-8">

          {/* ------------------------------- */}
          {/* Patient Header                  */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Patient Info</h3>
            <div className="mt-3 space-y-1 text-sm">
              <p><span className="font-medium">Name:</span> {p.fullName}</p>
              <p><span className="font-medium">DOB:</span> {formatDate(p.dob)}</p>
              <p><span className="font-medium">Gender:</span> {p.gender ?? "—"}</p>
              <p><span className="font-medium">Email:</span> {p.email ?? "—"}</p>
              <p><span className="font-medium">Phone:</span> {p.phone ?? "—"}</p>
            </div>
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Vitals                          */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Vitals</h3>
            <div className="mt-3 space-y-2">
              {chart.vitals.length === 0 ? (
                <p className="text-sm opacity-70">No vitals recorded.</p>
              ) : (
                chart.vitals.map((v: any) => (
                  <div key={v.id} className="border rounded-md p-3 text-sm">
                    <p>Height: {v.height ?? "—"}</p>
                    <p>Weight: {v.weight ?? "—"}</p>
                    <p>Blood Pressure: {v.blood_pressure ?? "—"}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {formatDate(v.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Medications                     */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Medications</h3>
            <div className="mt-3 space-y-2">
              {chart.medications.length === 0 ? (
                <p className="text-sm opacity-70">No medications on file.</p>
              ) : (
                chart.medications.map((m: any) => (
                  <div key={m.id} className="border p-3 rounded-md text-sm">
                    <p className="font-medium">{m.name}</p>
                    <p>Dosage: {m.dosage ?? "—"}</p>
                    <p>Notes: {m.notes ?? "—"}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Conditions                      */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Conditions</h3>
            <div className="mt-3 space-y-2">
              {chart.conditions.length === 0 ? (
                <p className="text-sm opacity-70">No documented conditions.</p>
              ) : (
                chart.conditions.map((c: any) => (
                  <div key={c.id} className="border p-3 rounded-md text-sm">
                    <p className="font-medium">{c.condition}</p>
                    <p>Notes: {c.notes ?? "—"}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Allergies                       */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Allergies</h3>
            <div className="mt-3 space-y-2">
              {chart.allergies.length === 0 ? (
                <p className="text-sm opacity-70">No allergies listed.</p>
              ) : (
                chart.allergies.map((a: any) => (
                  <div key={a.id} className="border p-3 rounded-md text-sm">
                    <p className="font-medium">{a.allergy}</p>
                    <p>Severity: {a.severity ?? "—"}</p>
                    <p>Notes: {a.notes ?? "—"}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Surgeries                       */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Surgical History</h3>
            <div className="mt-3 space-y-2">
              {chart.surgeries.length === 0 ? (
                <p className="text-sm opacity-70">No surgical history.</p>
              ) : (
                chart.surgeries.map((s: any) => (
                  <div key={s.id} className="border p-3 rounded-md text-sm">
                    <p className="font-medium">{s.surgery}</p>
                    <p>Date: {formatDate(s.date)}</p>
                    <p>Notes: {s.notes ?? "—"}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Immunizations                   */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Immunizations</h3>
            {chart.immunizations.length === 0 ? (
              <p className="text-sm opacity-70 mt-3">No immunizations recorded.</p>
            ) : (
              chart.immunizations.map((i: any) => (
                <div key={i.id} className="border p-3 rounded-md text-sm mt-3">
                  <p className="font-medium">{i.vaccine}</p>
                  <p>Date: {formatDate(i.date)}</p>
                </div>
              ))
            )}
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Pharmacies                      */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Pharmacy</h3>
            {chart.pharmacies.length === 0 ? (
              <p className="text-sm opacity-70 mt-3">No pharmacy information.</p>
            ) : (
              chart.pharmacies.map((ph: any) => (
                <div key={ph.id} className="border p-3 rounded-md text-sm mt-3">
                  <p className="font-medium">{ph.name}</p>
                  <p>{ph.address}</p>
                  <p>{ph.phone}</p>
                </div>
              ))
            )}
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Documents                       */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Documents</h3>
            {chart.documents.length === 0 ? (
              <p className="text-sm opacity-70 mt-3">No documents uploaded.</p>
            ) : (
              chart.documents.map((d: any) => (
                <div key={d.id} className="border p-3 rounded-md text-sm mt-3">
                  <p className="font-medium">{d.title}</p>
                  <p className="opacity-70">{d.description}</p>
                </div>
              ))
            )}
          </section>

          <Separator />

          {/* ------------------------------- */}
          {/* Provider Notes (Editable)       */}
          {/* ------------------------------- */}
          <section>
            <h3 className="text-base font-semibold">Provider Notes</h3>

            <Textarea
              placeholder="Write notes here…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="mt-3"
              rows={6}
              disabled={saving}
            />

            <Button 
              className="mt-2" 
              onClick={handleSaveNotes}
              disabled={saving || !noteText.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Save Note"}
            </Button>

            {chart.notes.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium">Previous Notes:</h4>
                {chart.notes.map((note: any) => (
                  <div key={note.id} className="border rounded-md p-3 text-sm bg-muted/50">
                    <p className="whitespace-pre-wrap">{note.note_content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {note.created_by_name} - {formatDate(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="pb-16"></div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
