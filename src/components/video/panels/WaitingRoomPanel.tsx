import { Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WaitingPatient } from '@/hooks/video/useVideoEvents';
import { formatDistanceToNow } from 'date-fns';

export interface WaitingRoomPanelProps {
  waitingPatients: WaitingPatient[];
  onAdmitPatient: (uid: string) => void;
  className?: string;
}

export const WaitingRoomPanel = ({
  waitingPatients,
  onAdmitPatient,
  className,
}: WaitingRoomPanelProps) => {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Waiting Room</h2>
          </div>
          {waitingPatients.length > 0 && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              {waitingPatients.length}
            </span>
          )}
        </div>
      </div>

      {/* Waiting Patients List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {waitingPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No patients waiting</p>
            <p className="text-xs text-muted-foreground mt-1">
              Patients will appear here when they join
            </p>
          </div>
        ) : (
          waitingPatients.map((patient) => (
            <div
              key={patient.uid}
              className="p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Patient Avatar */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {patient.name?.charAt(0).toUpperCase() || 'P'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {patient.name || `Patient ${patient.uid.slice(-4)}`}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatDistanceToNow(patient.joinedAt, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Admit Button */}
                  <Button
                    size="sm"
                    onClick={() => onAdmitPatient(patient.uid)}
                    className="w-full"
                  >
                    Admit Patient
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
