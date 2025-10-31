import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Plus } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface Vitals {
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
}

interface VitalsSectionProps {
  patientAccountId?: string;
  latestVitals?: Vitals;
}

export function VitalsSection({ patientAccountId, latestVitals }: VitalsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  
  const metrics = latestVitals ? [
    latestVitals.height && { label: "Height", value: `${latestVitals.height} ${latestVitals.height_unit || ""}` },
    latestVitals.weight && { label: "Weight", value: `${latestVitals.weight} ${latestVitals.weight_unit || ""}` },
    latestVitals.bmi && { label: "BMI", value: latestVitals.bmi.toFixed(1) },
    latestVitals.blood_pressure_systolic && latestVitals.blood_pressure_diastolic && { label: "Blood Pressure", value: `${latestVitals.blood_pressure_systolic}/${latestVitals.blood_pressure_diastolic}` },
    latestVitals.pulse && { label: "Pulse", value: `${latestVitals.pulse} bpm` },
    latestVitals.temperature && { label: "Temperature", value: `${latestVitals.temperature}°${latestVitals.temperature_unit || ""}` },
    latestVitals.oxygen_saturation && { label: "O2 Saturation", value: `${latestVitals.oxygen_saturation}%` },
    latestVitals.cholesterol && { label: "Cholesterol", value: `${latestVitals.cholesterol} mg/dL` },
    latestVitals.blood_sugar && { label: "Blood Sugar", value: `${latestVitals.blood_sugar} mg/dL` },
  ].filter(Boolean) as Array<{ label: string; value: string }> : [];
  
  const visibleMetrics = expanded ? metrics : metrics.slice(0, 3);
  
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
      {/* Animated border glow effect */}
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
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {latestVitals && metrics.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {visibleMetrics.map((metric) => (
                <div key={metric.label} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="font-medium">{metric.value}</p>
                </div>
              ))}
            </div>
            {metrics.length > 3 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              </div>
            )}
            {latestVitals.date_recorded && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Recorded: {format(new Date(latestVitals.date_recorded), 'MMM dd, yyyy h:mm a')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No vitals recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
