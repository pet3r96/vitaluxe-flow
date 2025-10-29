import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, UserPlus, Edit, Archive, Copy } from "lucide-react";
import { format } from "date-fns";

interface FormCardProps {
  form: any;
  onAssign: (formId: string) => void;
  onEdit: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
}

export function FormCard({ form, onAssign, onEdit, onArchive, onDuplicate }: FormCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{form.form_name}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAssign(form.id)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign to Patient
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="text-destructive">
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{form.form_type}</p>
          
          <div className="flex items-center gap-2">
            {form.is_pdf_template ? (
              <Badge variant="secondary">PDF Template</Badge>
            ) : (
              <Badge variant="secondary">Digital Form</Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Created {format(new Date(form.created_at), "MMM d, yyyy")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
