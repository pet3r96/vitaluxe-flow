import { Activity, AlertCircle, Heart, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface PatientIdentityPanelProps {
  patientId: string;
  patient?: {
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: string;
    allergies?: Array<{ allergen: string; severity: string }>;
  };
  vitals?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
  };
  className?: string;
}

export const PatientIdentityPanel = ({
  patient,
  vitals,
  className,
}: PatientIdentityPanelProps) => {
  if (!patient) {
    return (
      <div className={cn('p-4 space-y-4', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>
    );
  }

  const age = patient.birth_date
    ? new Date().getFullYear() - new Date(patient.birth_date).getFullYear()
    : null;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Patient</h2>
      </div>

      {/* Patient Info */}
      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <h3 className="text-xl font-bold text-foreground">
            {patient.first_name} {patient.last_name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{age ? `${age}y` : 'N/A'}</span>
            <span>•</span>
            <span className="capitalize">{patient.gender || 'N/A'}</span>
          </div>
        </div>

        {/* DOB */}
        {patient.birth_date && (
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">
              Date of Birth
            </p>
            <p className="text-sm text-foreground">
              {format(new Date(patient.birth_date), 'MMM dd, yyyy')}
            </p>
          </div>
        )}

        {/* Allergies Alert */}
        {patient.allergies && patient.allergies.length > 0 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                  Allergies
                </p>
                <div className="space-y-1">
                  {patient.allergies.map((allergy, index) => (
                    <div key={index} className="text-xs text-red-600 dark:text-red-300">
                      {allergy.allergen}
                      {allergy.severity && (
                        <span className="ml-1 text-red-500">({allergy.severity})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Vitals */}
        {vitals && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase font-medium">
              Quick Vitals
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* Blood Pressure */}
              {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic && (
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground">BP</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic}
                  </p>
                </div>
              )}

              {/* Heart Rate */}
              {vitals.heart_rate && (
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Heart className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs text-muted-foreground">HR</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {vitals.heart_rate} bpm
                  </p>
                </div>
              )}

              {/* Temperature */}
              {vitals.temperature && (
                <div className="p-2 rounded-lg bg-muted/50 border border-border col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Temp</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {vitals.temperature}°F
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
