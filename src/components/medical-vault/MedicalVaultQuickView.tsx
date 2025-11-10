import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MedicalVaultView } from "@/components/medical-vault/MedicalVaultView";

interface MedicalVaultQuickViewProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MedicalVaultQuickView({
  patientId,
  patientName,
  open,
  onOpenChange,
}: MedicalVaultQuickViewProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[80vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Medical Vault - {patientName}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <MedicalVaultView
            patientAccountId={patientId}
            mode="practice"
            canEdit={true}
            showHeader={false}
            patientName={patientName}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
