import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface EditDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: any;
}

export function EditDocumentDialog({ open, onOpenChange, document }: EditDocumentDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    document_name: "",
    document_type: "",
    tags: [] as string[],
    notes: "",
    status: "",
    assigned_patient_id: "",
    assigned_staff_id: "",
    is_internal: false,
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (document) {
      setFormData({
        document_name: document.document_name || "",
        document_type: document.document_type || "",
        tags: document.tags || [],
        notes: document.notes || "",
        status: document.status || "uploaded",
        assigned_patient_id: document.assigned_patient_id || "none",
        assigned_staff_id: document.assigned_staff_id || "none",
        is_internal: document.is_internal || false,
      });
    }
  }, [document]);

  const { data: patients } = useQuery({
    queryKey: ["patients-for-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or("role.eq.admin,role.eq.provider")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {
        document_name: formData.document_name,
        document_type: formData.document_type,
        tags: formData.tags,
        notes: formData.notes,
        status: formData.status,
        assigned_patient_id: (formData.assigned_patient_id && formData.assigned_patient_id !== "none") ? formData.assigned_patient_id : null,
        assigned_staff_id: (formData.assigned_staff_id && formData.assigned_staff_id !== "none") ? formData.assigned_staff_id : null,
        is_internal: formData.is_internal,
      };

      if (formData.status === "reviewed" && document.status !== "reviewed") {
        updates.reviewed_by = (await supabase.auth.getUser()).data.user?.id;
        updates.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("provider_documents" as any)
        .update(updates)
        .eq("id", document.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-documents"] });
      toast.success("Document updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update document: " + error.message);
    },
  });

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Document Name</Label>
            <Input
              value={formData.document_name}
              onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
            />
          </div>

          <div>
            <Label>Document Type</Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) => setFormData({ ...formData, document_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lab_results">Lab Results</SelectItem>
                <SelectItem value="referrals">Referrals</SelectItem>
                <SelectItem value="consents">Consents</SelectItem>
                <SelectItem value="prescriptions">Prescriptions</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="internal_docs">Internal Docs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
              />
              <Button type="button" onClick={addTag}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <div key={tag} className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm flex items-center gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive">×</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Assign to Patient</Label>
            <Select
              value={formData.assigned_patient_id}
              onValueChange={(value) => setFormData({ ...formData, assigned_patient_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select patient (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {patients?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assign to Staff</Label>
            <Select
              value={formData.assigned_staff_id}
              onValueChange={(value) => setFormData({ ...formData, assigned_staff_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select staff (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="internal"
              checked={formData.is_internal}
              onCheckedChange={(checked) => setFormData({ ...formData, is_internal: checked as boolean })}
            />
            <Label htmlFor="internal">Internal (staff-only)</Label>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
