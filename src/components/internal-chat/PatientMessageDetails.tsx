import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, ExternalLink, Trash2, CheckCircle, RotateCcw, Mail, Phone, Calendar, FolderOpen } from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PatientMessageDetailsProps {
  message: any;
  onMarkResolved: () => Promise<void>;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function PatientMessageDetails({
  message,
  onMarkResolved,
  onReopen,
  onDelete
}: PatientMessageDetailsProps) {
  const navigate = useNavigate();

  if (!message) {
    return null;
  }

  return (
    <div className="w-full lg:w-[340px] border-l bg-background">
      <ScrollArea className="h-full p-6 space-y-6">
        {/* Message Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <div className="mt-1">
                <PriorityBadge priority={message.urgency || 'medium'} />
              </div>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Created</label>
              <p className="text-sm mt-1">{format(new Date(message.created_at), 'PPpp')}</p>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Sent By</label>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {['provider', 'staff', 'practice'].includes(message.sender_type)
                      ? (message.sender?.name || 'P').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                      : 'PT'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {['provider', 'staff', 'practice'].includes(message.sender_type)
                    ? (message.sender?.name || 'Practice')
                    : 'Patient'}
                </span>
              </div>
            </div>

            {message.resolved && (
              <div>
                <label className="text-xs text-muted-foreground">Resolved</label>
                <p className="text-sm mt-1">{format(new Date(message.resolved_at), 'PPpp')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient Info Section */}
        {message.patient && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/patients/${message.patient_id}`)}
              >
                <User className="mr-2 h-4 w-4" />
                {message.patient.name}
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/patients/${message.patient_id}`)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                View Patient File
              </Button>

              {message.patient.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{message.patient.email}</span>
                </div>
              )}

              {message.patient.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{message.patient.phone}</span>
                </div>
              )}

              {message.patient.dob && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    DOB: {format(new Date(message.patient.dob), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!message.resolved ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onMarkResolved}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Resolved
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onReopen}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reopen Message
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Message
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Message</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this message? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
