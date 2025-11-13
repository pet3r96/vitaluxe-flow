import { Card } from "@/components/ui/card";

export default function MiniPatientSummary({ chart }: { chart: any }) {
  if (!chart?.patient) return null;

  const p = chart.patient;

  return (
    <Card className="p-3 text-sm bg-secondary border-border shadow-sm w-64">
      <div className="font-semibold text-base mb-2">
        {p.fullName}
      </div>

      <div className="space-y-1 text-xs opacity-80">
        {p.dob && (
          <div>DOB: {new Date(p.dob).toLocaleDateString()}</div>
        )}

        {p.gender && <div>Gender: {p.gender}</div>}

        {p.email && <div>Email: {p.email}</div>}

        {p.phone && <div>Phone: {p.phone}</div>}
      </div>
    </Card>
  );
}
