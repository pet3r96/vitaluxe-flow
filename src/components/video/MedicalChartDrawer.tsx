import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface MedicalChartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: any;
  patientId: string;
}

export function MedicalChartDrawer({ open, onOpenChange, chart }: MedicalChartDrawerProps) {
  if (!chart?.patient) return null;

  const { patient, medications, allergies, conditions, vitals, surgeries, immunizations, documents, notes } = chart;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Medical Chart - {patient.fullName}</DrawerTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            {patient.dob && <p>DOB: {format(new Date(patient.dob), "MMM dd, yyyy")}</p>}
            {patient.gender && <p>Gender: {patient.gender}</p>}
            {patient.email && <p>Email: {patient.email}</p>}
            {patient.phone && <p>Phone: {patient.phone}</p>}
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="medications">Medications</TabsTrigger>
              <TabsTrigger value="allergies">Allergies</TabsTrigger>
              <TabsTrigger value="conditions">Conditions</TabsTrigger>
              <TabsTrigger value="vitals">Vitals</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Active Medications:</strong> {medications?.length || 0}</p>
                  <p><strong>Known Allergies:</strong> {allergies?.length || 0}</p>
                  <p><strong>Active Conditions:</strong> {conditions?.length || 0}</p>
                  <p><strong>Recent Vitals:</strong> {vitals?.length || 0} recorded</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="medications" className="space-y-4 mt-4">
              {medications?.length > 0 ? (
                medications.map((med: any) => (
                  <Card key={med.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{med.medication_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {med.dosage && <p><strong>Dosage:</strong> {med.dosage}</p>}
                      {med.frequency && <p><strong>Frequency:</strong> {med.frequency}</p>}
                      {med.prescribing_provider && <p><strong>Prescribed by:</strong> {med.prescribing_provider}</p>}
                      {med.start_date && <p><strong>Started:</strong> {format(new Date(med.start_date), "MMM dd, yyyy")}</p>}
                      {med.notes && <p className="text-muted-foreground">{med.notes}</p>}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No medications recorded</p>
              )}
            </TabsContent>

            <TabsContent value="allergies" className="space-y-4 mt-4">
              {allergies?.length > 0 ? (
                allergies.map((allergy: any) => (
                  <Card key={allergy.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{allergy.allergen}</CardTitle>
                        {allergy.severity && (
                          <Badge variant={allergy.severity === "severe" ? "destructive" : "secondary"}>
                            {allergy.severity}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {allergy.reaction && <p><strong>Reaction:</strong> {allergy.reaction}</p>}
                      {allergy.notes && <p className="text-muted-foreground">{allergy.notes}</p>}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No allergies recorded</p>
              )}
            </TabsContent>

            <TabsContent value="conditions" className="space-y-4 mt-4">
              {conditions?.length > 0 ? (
                conditions.map((condition: any) => (
                  <Card key={condition.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{condition.condition_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {condition.diagnosed_date && <p><strong>Diagnosed:</strong> {format(new Date(condition.diagnosed_date), "MMM dd, yyyy")}</p>}
                      {condition.status && <p><strong>Status:</strong> {condition.status}</p>}
                      {condition.notes && <p className="text-muted-foreground">{condition.notes}</p>}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No conditions recorded</p>
              )}
            </TabsContent>

            <TabsContent value="vitals" className="space-y-4 mt-4">
              {vitals?.length > 0 ? (
                vitals.map((vital: any) => (
                  <Card key={vital.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {vital.created_at && format(new Date(vital.created_at), "MMM dd, yyyy HH:mm")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-sm">
                      {vital.blood_pressure && <p><strong>BP:</strong> {vital.blood_pressure}</p>}
                      {vital.heart_rate && <p><strong>HR:</strong> {vital.heart_rate} bpm</p>}
                      {vital.temperature && <p><strong>Temp:</strong> {vital.temperature}°F</p>}
                      {vital.weight && <p><strong>Weight:</strong> {vital.weight} lbs</p>}
                      {vital.height && <p><strong>Height:</strong> {vital.height} in</p>}
                      {vital.oxygen_saturation && <p><strong>O2:</strong> {vital.oxygen_saturation}%</p>}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No vitals recorded</p>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Surgeries</CardTitle>
                </CardHeader>
                <CardContent>
                  {surgeries?.length > 0 ? (
                    <div className="space-y-3">
                      {surgeries.map((surgery: any) => (
                        <div key={surgery.id} className="border-l-2 border-primary pl-3">
                          <p className="font-medium">{surgery.procedure_name}</p>
                          {surgery.surgery_date && <p className="text-sm text-muted-foreground">{format(new Date(surgery.surgery_date), "MMM dd, yyyy")}</p>}
                          {surgery.notes && <p className="text-sm mt-1">{surgery.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No surgeries recorded</p>
                  )}
                </CardContent>
              </Card>

              <Separator />

              <Card>
                <CardHeader>
                  <CardTitle>Immunizations</CardTitle>
                </CardHeader>
                <CardContent>
                  {immunizations?.length > 0 ? (
                    <div className="space-y-3">
                      {immunizations.map((imm: any) => (
                        <div key={imm.id} className="border-l-2 border-secondary pl-3">
                          <p className="font-medium">{imm.vaccine_name}</p>
                          {imm.administration_date && <p className="text-sm text-muted-foreground">{format(new Date(imm.administration_date), "MMM dd, yyyy")}</p>}
                          {imm.lot_number && <p className="text-sm">Lot: {imm.lot_number}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No immunizations recorded</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-4">
              {documents?.length > 0 ? (
                documents.map((doc: any) => (
                  <Card key={doc.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{doc.document_name || "Untitled Document"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {doc.document_type && <p><strong>Type:</strong> {doc.document_type}</p>}
                      {doc.created_at && <p><strong>Uploaded:</strong> {format(new Date(doc.created_at), "MMM dd, yyyy")}</p>}
                      {doc.notes && <p className="text-muted-foreground">{doc.notes}</p>}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No documents uploaded</p>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              {notes?.length > 0 ? (
                notes.map((note: any) => (
                  <Card key={note.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {note.created_at && format(new Date(note.created_at), "MMM dd, yyyy HH:mm")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {note.note_type && <Badge variant="outline">{note.note_type}</Badge>}
                      {note.content && <p className="mt-2 whitespace-pre-wrap">{note.content}</p>}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No notes recorded</p>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
