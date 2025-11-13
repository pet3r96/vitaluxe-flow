import { Card } from "@/components/ui/card";

export default function MiniPatientSummary({ chart }: { chart: any }) {
  if (!chart?.patient) return null;

  const p = chart.patient;

  return (
    <Card className="p-3 text-sm bg-secondary border-border shadow-sm">
      <div className="font-semibold text-base mb-1">
        {p.first_name} {p.last_name}
      </div>

      <div className="space-y-1 opacity-80">
        {p.birth_date && (
          <div>DOB: {new Date(p.birth_date).toLocaleDateString()}</div>
        )}

        {p.gender_at_birth && <div>Gender: {p.gender_at_birth}</div>}

        {p.email && <div>Email: {p.email}</div>}

        {p.phone && <div>Phone: {p.phone}</div>}
      </div>
    </Card>
  );
}
