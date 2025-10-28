import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone } from "lucide-react";

export default function PracticePatients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatients();
  }, [user]);

  const loadPatients = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("patient_accounts")
      .select("*")
      .eq("practice_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setPatients(data);
    }
    setLoading(false);
  };

  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Patients</h1>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4">
          {filteredPatients.map(patient => (
            <Card key={patient.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">
                    {patient.first_name} {patient.last_name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {patient.email}
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {patient.phone}
                    </div>
                  )}
                  {patient.address && (
                    <p className="text-sm text-muted-foreground">
                      {patient.address}, {patient.city}, {patient.state} {patient.zip_code}
                    </p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  <div>Status: <span className="capitalize">{patient.status}</span></div>
                  <div>Joined: {new Date(patient.created_at).toLocaleDateString()}</div>
                  {patient.last_login_at && (
                    <div>Last Login: {new Date(patient.last_login_at).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
