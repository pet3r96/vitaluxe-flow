import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, Edit, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { VitalsDialog } from "./dialogs/VitalsDialog";

interface VitalRecord {
  id: string;
  patient_account_id: string;
  vital_type?: string;
  height?: number;
  height_unit?: string;
  weight?: number;
  weight_unit?: string;
  bmi?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse?: number;
  temperature?: number;
  temperature_unit?: string;
  oxygen_saturation?: number;
  cholesterol?: number;
  blood_sugar?: number;
  date_recorded?: string;
  created_at: string;
  updated_at: string;
}

interface VitalsSectionProps {
  patientAccountId?: string;
  vitals?: VitalRecord[];
}

export function VitalsSection({ patientAccountId, vitals = [] }: VitalsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVital, setSelectedVital] = useState<VitalRecord | null>(null);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | "view" | "add-basic" | "add-timeseries">("add");
  const [basicVitalType, setBasicVitalType] = useState<"height" | "weight" | null>(null);

  // Helper function to format height display
  const formatHeight = (height: number, unit: string): string => {
    if (unit === 'in') {
      const feet = Math.floor(height / 12);
      const inches = Math.round(height % 12);
      return `${feet}'${inches}" (${height} in)`;
    }
    return `${height} ${unit}`;
  };

  // Separate height and weight records
  const heightRecord = vitals.find(v => v.vital_type === 'height');
  const weightRecord = vitals.find(v => v.vital_type === 'weight');

  // Calculate BMI if both height and weight exist
  const calculateBMI = () => {
    if (!heightRecord?.height || !weightRecord?.weight) return null;
    
    const heightInches = heightRecord.height_unit === "cm" 
      ? heightRecord.height / 2.54 
      : heightRecord.height;
    const weightLbs = weightRecord.weight_unit === "kg" 
      ? weightRecord.weight * 2.20462 
      : weightRecord.weight;
    
    return ((weightLbs / (heightInches * heightInches)) * 703).toFixed(1);
  };

  // Group time-series vitals by type
  const groupedTimeSeriesVitals: Record<string, VitalRecord[]> = {};
  vitals.forEach(vital => {
    if (!vital.vital_type || vital.vital_type === 'height' || vital.vital_type === 'weight') {
      // Check if this is an old-style record (no vital_type but has time-series data)
      const hasTimeSeriesData = vital.blood_pressure_systolic || vital.pulse || 
        vital.temperature || vital.oxygen_saturation || vital.cholesterol || vital.blood_sugar;
      
      if (hasTimeSeriesData) {
        // Handle legacy records by grouping them based on which field is populated
        if (vital.blood_pressure_systolic && vital.blood_pressure_diastolic) {
          if (!groupedTimeSeriesVitals['blood_pressure']) groupedTimeSeriesVitals['blood_pressure'] = [];
          groupedTimeSeriesVitals['blood_pressure'].push(vital);
        }
        if (vital.pulse) {
          if (!groupedTimeSeriesVitals['pulse']) groupedTimeSeriesVitals['pulse'] = [];
          groupedTimeSeriesVitals['pulse'].push(vital);
        }
        if (vital.temperature) {
          if (!groupedTimeSeriesVitals['temperature']) groupedTimeSeriesVitals['temperature'] = [];
          groupedTimeSeriesVitals['temperature'].push(vital);
        }
        if (vital.oxygen_saturation) {
          if (!groupedTimeSeriesVitals['oxygen_saturation']) groupedTimeSeriesVitals['oxygen_saturation'] = [];
          groupedTimeSeriesVitals['oxygen_saturation'].push(vital);
        }
        if (vital.cholesterol) {
          if (!groupedTimeSeriesVitals['cholesterol']) groupedTimeSeriesVitals['cholesterol'] = [];
          groupedTimeSeriesVitals['cholesterol'].push(vital);
        }
        if (vital.blood_sugar) {
          if (!groupedTimeSeriesVitals['blood_sugar']) groupedTimeSeriesVitals['blood_sugar'] = [];
          groupedTimeSeriesVitals['blood_sugar'].push(vital);
        }
      }
    } else {
      if (!groupedTimeSeriesVitals[vital.vital_type]) {
        groupedTimeSeriesVitals[vital.vital_type] = [];
      }
      groupedTimeSeriesVitals[vital.vital_type].push(vital);
    }
  });

  const hasTimeSeriesVitals = Object.keys(groupedTimeSeriesVitals).length > 0;

  const openDialog = (mode: "add" | "edit" | "view" | "add-basic" | "add-timeseries", vital?: VitalRecord, type?: "height" | "weight") => {
    setDialogMode(mode);
    setSelectedVital(vital || null);
    setBasicVitalType(type || null);
    setDialogOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return "";
    }
  };

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy h:mm a');
    } catch {
      return "";
    }
  };

  const getVitalLabel = (type: string) => {
    const labels: Record<string, string> = {
      blood_pressure: "Blood Pressure",
      pulse: "Pulse",
      temperature: "Temperature",
      oxygen_saturation: "Oxygen Saturation",
      cholesterol: "Cholesterol",
      blood_sugar: "Blood Sugar",
    };
    return labels[type] || type;
  };

  const formatVitalValue = (vital: VitalRecord, type: string) => {
    switch (type) {
      case 'blood_pressure':
        return `${vital.blood_pressure_systolic}/${vital.blood_pressure_diastolic} mmHg`;
      case 'pulse':
        return `${vital.pulse} bpm`;
      case 'temperature':
        return `${vital.temperature}°${vital.temperature_unit || 'F'}`;
      case 'oxygen_saturation':
        return `${vital.oxygen_saturation}%`;
      case 'cholesterol':
        return `${vital.cholesterol} mg/dL`;
      case 'blood_sugar':
        return `${vital.blood_sugar} mg/dL`;
      default:
        return "";
    }
  };

  const bmi = calculateBMI();

  return (
    <>
      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-bold">
                Vitals / Biometrics
              </span>
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline"
              className="shadow-sm"
              onClick={() => openDialog("add-timeseries")}
              disabled={!patientAccountId}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          {/* Quick Look - Height & Weight */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Quick Look</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Height */}
              <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Height</p>
                  <div className="flex gap-1">
                    {heightRecord && (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openDialog("view", heightRecord)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openDialog("add-basic", heightRecord, "height")}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {heightRecord ? (
                  <p className="text-2xl font-bold">
                    {heightRecord.height_unit === 'in' 
                      ? formatHeight(heightRecord.height || 0, heightRecord.height_unit)
                      : `${heightRecord.height} ${heightRecord.height_unit}`
                    }
                  </p>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-1"
                    onClick={() => openDialog("add-basic", undefined, "height")}
                    disabled={!patientAccountId}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Height
                  </Button>
                )}
              </div>

              {/* Weight */}
              <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Weight</p>
                  <div className="flex gap-1">
                    {weightRecord && (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openDialog("view", weightRecord)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openDialog("add-basic", weightRecord, "weight")}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {weightRecord ? (
                  <p className="text-2xl font-bold">{weightRecord.weight} {weightRecord.weight_unit}</p>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-1"
                    onClick={() => openDialog("add-basic", undefined, "weight")}
                    disabled={!patientAccountId}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Weight
                  </Button>
                )}
              </div>
            </div>

            {/* BMI Display */}
            {bmi && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">BMI (Auto-calculated)</span>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {bmi}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Additional Vitals Section */}
          {hasTimeSeriesVitals && (
            <div className="pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full justify-between text-muted-foreground hover:text-foreground mb-3"
              >
                <span className="text-sm font-semibold">Additional Vitals</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              {expanded && (
                <div className="space-y-4">
                  {Object.entries(groupedTimeSeriesVitals).map(([type, records]) => (
                    <div key={type}>
                      <h4 className="text-sm font-semibold mb-2 text-foreground">{getVitalLabel(type)}</h4>
                      <div className="space-y-2">
                        {records.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{formatVitalValue(record, type)}</span>
                                <span className="text-sm text-muted-foreground">•</span>
                                <span className="text-sm text-muted-foreground">{formatDate(record.date_recorded)}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Recorded: {formatTimestamp(record.created_at)}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDialog("view", record)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDialog("edit", record)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasTimeSeriesVitals && !heightRecord && !weightRecord && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No vitals recorded
            </p>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <VitalsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          patientAccountId={patientAccountId || ""}
          vitals={selectedVital}
          mode={dialogMode}
          basicVitalType={basicVitalType}
        />
      )}
    </>
  );
}
